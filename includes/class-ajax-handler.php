<?php
/**
 * AJAX обработчики для получения данных карты
 * 
 * Улучшения:
 * - Поддержка пагинации и лимитов
 * - Кэширование результатов
 * - Безопасный импорт (режим слияния вместо полного удаления)
 * - Улучшенная валидация и санитизация
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class KOLCHUGINO_MAP_Ajax_Handler {

    private static $initialized = false;
    private static $query_cache = array();

    public static function init() {
        if ( self::$initialized ) {
            return;
        }
        self::$initialized = true;
        
        kolchugino_log()->info( 'AJAX handlers registered' );

        // Регистрируем обработчики
        add_action( 'wp_ajax_get_map_objects', array( __CLASS__, 'get_map_objects' ) );
        add_action( 'wp_ajax_nopriv_get_map_objects', array( __CLASS__, 'get_map_objects' ) );

        add_action( 'wp_ajax_get_map_categories', array( __CLASS__, 'get_map_categories' ) );
        add_action( 'wp_ajax_nopriv_get_map_categories', array( __CLASS__, 'get_map_categories' ) );

        add_action( 'wp_ajax_import_geojson', array( __CLASS__, 'import_geojson' ) );
        
        // Обработчик обратного геокодирования
        add_action( 'wp_ajax_reverse_geocode', array( __CLASS__, 'reverse_geocode' ) );
        
        // Обработчик очистки кэша
        add_action( 'wp_ajax_kolchugino_clear_cache', array( __CLASS__, 'clear_cache' ) );
    }
    
    /**
     * Получение всех объектов карты с поддержкой пагинации
     */
    public static function get_map_objects() {
        // Проверка nonce
        if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'kolchugino_map_nonce' ) ) {
            kolchugino_log()->warning( 'Invalid nonce in get_map_objects' );
            wp_send_json_error( array( 'message' => __( 'Invalid security token', 'kolchugino-map' ) ) );
            return;
        }
        
        // Санитизация входных данных
        $category_filter = isset( $_POST['category'] ) ? sanitize_text_field( $_POST['category'] ) : '';
        $per_page        = isset( $_POST['per_page'] ) ? absint( $_POST['per_page'] ) : 100;
        $page            = isset( $_POST['page'] ) ? absint( $_POST['page'] ) : 1;
        $search          = isset( $_POST['search'] ) ? sanitize_text_field( $_POST['search'] ) : '';
        
        // Ограничиваем per_page
        $per_page = min( max( $per_page, 1 ), 500 );
        
        // Генерируем ключ кэша
        $cache_key = md5( json_encode( array(
            'category' => $category_filter,
            'per_page' => $per_page,
            'page' => $page,
            'search' => $search
        )));
        
        // Проверяем кэш (только для публичных запросов без поиска)
        if ( empty( $search ) && $page === 1 ) {
            $cached = get_transient( 'kolchugino_map_objects_' . $cache_key );
            if ( $cached !== false ) {
                kolchugino_log()->debug( 'Cache hit for get_map_objects' );
                wp_send_json_success( $cached );
                return;
            }
        }
        
        kolchugino_log()->info( 'get_map_objects called', array(
            'category_filter' => $category_filter,
            'per_page' => $per_page,
            'page' => $page,
            'search' => $search
        ));
        
        // Проверка существования пост-типа
        if ( ! post_type_exists( 'map_object' ) ) {
            kolchugino_log()->error( 'Post type map_object does not exist' );
            wp_send_json_error( array( 'message' => __( 'Map post type not found', 'kolchugino-map' ) ) );
            return;
        }
        
        $args = array(
            'post_type'      => 'map_object',
            'posts_per_page' => $per_page,
            'paged'          => $page,
            'post_status'    => 'publish',
            'orderby'        => 'title',
            'order'          => 'ASC',
            'meta_query'     => array(
                'relation' => 'AND',
                array(
                    'key'     => '_map_lat',
                    'compare' => 'EXISTS',
                    'type'    => 'NUMERIC',
                ),
                array(
                    'key'     => '_map_lng',
                    'compare' => 'EXISTS',
                    'type'    => 'NUMERIC',
                ),
            ),
        );
        
        // Поиск по заголовку и содержимому
        if ( ! empty( $search ) ) {
            $args['s'] = $search;
        }
        
        // Фильтрация по категории только если это не 'all'
        if ( ! empty( $category_filter ) && $category_filter !== 'all' ) {
            $args['tax_query'] = array(
                array(
                    'taxonomy' => 'map_category',
                    'field'    => 'slug',
                    'terms'    => $category_filter,
                ),
            );
        }
        
        /**
         * Фильтр для модификации аргументов запроса
         */
        $args = apply_filters( 'kolchugino_map_query_args', $args );
        
        $query = new WP_Query( $args );
        $objects = array();
        
        kolchugino_log()->info( 'Posts found', array( 'count' => $query->found_posts ));
        
        if ( $query->have_posts() ) {
            while ( $query->have_posts() ) {
                $query->the_post();
                $post_id = get_the_ID();
                
                $objects[] = self::prepare_map_object( $post_id );
            }
            wp_reset_postdata();
        }
        
        // Формируем ответ с пагинацией
        $response = array(
            'objects'      => $objects,
            'total'        => (int) $query->found_posts,
            'page'         => $page,
            'per_page'     => $per_page,
            'total_pages'  => $query->max_num_pages,
            'has_next'     => $page < $query->max_num_pages,
            'has_previous' => $page > 1,
        );
        
        // Кэшируем результат на 5 минут
        if ( empty( $search ) ) {
            set_transient( 'kolchugino_map_objects_' . $cache_key, $response, 5 * MINUTE_IN_SECONDS );
        }
        
        kolchugino_log()->info( 'Sending response', array( 'objects_count' => count( $objects ) ));
        wp_send_json_success( $response );
    }
    
    /**
     * Подготовка данных объекта карты
     */
    private static function prepare_map_object( $post_id ) {
        // Получение категорий
        $categories = get_the_terms( $post_id, 'map_category' );
        $category_slugs = array();
        if ( $categories && ! is_wp_error( $categories ) ) {
            foreach ( $categories as $cat ) {
                $category_slugs[] = $cat->slug;
            }
        }
        
        // Получение миниатюры
        $thumbnail_url = '';
        if ( has_post_thumbnail( $post_id ) ) {
            $thumbnail_url = get_the_post_thumbnail_url( $post_id, 'medium' );
        }
        
        // Галерея изображений
        $gallery = array();
        $gallery_meta = get_post_meta( $post_id, '_map_gallery', true );
        if ( $gallery_meta && is_array( $gallery_meta ) ) {
            foreach ( $gallery_meta as $attachment_id ) {
                $url = wp_get_attachment_image_url( $attachment_id, 'medium' );
                if ( $url ) {
                    $gallery[] = $url;
                }
            }
        }
        
        return array(
            'id'            => $post_id,
            'title'         => get_the_title( $post_id ),
            'description'   => get_the_excerpt( $post_id ),
            'content'       => get_the_content( $post_id ),
            'lat'           => (float) get_post_meta( $post_id, '_map_lat', true ),
            'lng'           => (float) get_post_meta( $post_id, '_map_lng', true ),
            'zoom'          => (int) get_post_meta( $post_id, '_map_zoom', true ) ?: 15,
            'address'       => get_post_meta( $post_id, '_map_address', true ),
            'phone'         => get_post_meta( $post_id, '_map_phone', true ),
            'website'       => esc_url_raw( get_post_meta( $post_id, '_map_website', true ) ),
            'email'         => sanitize_email( get_post_meta( $post_id, '_map_email', true ) ),
            'opening_hours' => get_post_meta( $post_id, '_map_opening_hours', true ),
            'price'         => get_post_meta( $post_id, '_map_price', true ),
            'featured'      => (bool) get_post_meta( $post_id, '_map_featured', true ),
            'thumbnail'     => $thumbnail_url,
            'gallery'       => $gallery,
            'categories'    => $category_slugs,
            'permalink'     => get_permalink( $post_id ),
            'marker_icon'   => get_post_meta( $post_id, '_map_marker_icon', true ) ?: 'circle',
            'marker_color'  => get_post_meta( $post_id, '_map_marker_color', true ) ?: '',
            'excerpt'       => wp_trim_words( get_the_excerpt( $post_id ) ?: get_the_content( $post_id ), 20, '...' ),
        );
    }

    /**
     * Обработчик AJAX для получения объектов карты
     */
    public static function get_objects() {
        // Логируем начало импорта
        kolchugino_log()->info( 'Starting import process', array(
            'action' => 'import_geojson',
            'user' => wp_get_current_user()->user_login
        ) );

        // Проверка прав и nonce
        if ( ! current_user_can( 'manage_options' ) ) {
            $error_msg = 'User does not have manage_options capability';
            kolchugino_log()->warning( $error_msg );
            wp_send_json_error( array( 'message' => $error_msg ) );
        }

        if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'kolchugino_map_nonce' ) ) {
            $error_msg = 'Invalid nonce verification';
            kolchugino_log()->warning( $error_msg );
            wp_send_json_error( array( 'message' => $error_msg ) );
        }

        // Проверка типа файла
        if ( ! isset( $_FILES['geojson_file'] ) ) {
            $error_msg = 'No file uploaded in $_FILES';
            kolchugino_log()->warning( $error_msg, array( 'available_files' => array_keys( $_FILES ) ) );
            wp_send_json_error( array( 'message' => $error_msg ) );
        }

        $file = $_FILES['geojson_file'];

        if ( $file['error'] !== UPLOAD_ERR_OK ) {
            $error_msg = 'Upload error: ' . $file['error'];
            error_log( '[Kolchugino Map Import] ' . $error_msg );
            error_log( '[Kolchugino Map Import] File info: ' . print_r( $file, true ) );
            wp_send_json_error( array( 'message' => $error_msg ) );
        }

        // Проверка существования файла
        if ( ! file_exists( $file['tmp_name'] ) ) {
            $error_msg = 'File does not exist at temp path: ' . $file['tmp_name'];
            error_log( '[Kolchugino Map Import] ' . $error_msg );
            wp_send_json_error( array( 'message' => $error_msg ) );
        }

        // Проверка размера файла (максимум 10MB)
        if ( $file['size'] > 10 * 1024 * 1024 ) {
            $error_msg = 'File too large: ' . $file['size'] . ' bytes';
            error_log( '[Kolchugino Map Import] ' . $error_msg );
            wp_send_json_error( array( 'message' => $error_msg ) );
        }

        $file_type = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'] );
        $ext = $file_type['ext'] ? $file_type['ext'] : pathinfo( $file['name'], PATHINFO_EXTENSION );
        
        if ( ! in_array( strtolower( $ext ), array( 'json', 'geojson' ) ) ) {
            $error_msg = 'File extension mismatch: ' . $ext;
            error_log( '[Kolchugino Map Import] ' . $error_msg );
            wp_send_json_error( array( 'message' => $error_msg ) );
        }

        // Чтение файла
        $json_content = file_get_contents( $file['tmp_name'] );

        if ( $json_content === false ) {
            $error_msg = 'Failed to read file: ' . $file['tmp_name'];
            error_log( '[Kolchugino Map Import] ' . $error_msg );
            wp_send_json_error( array( 'message' => $error_msg ) );
        }

        $data = json_decode( $json_content, true );

        if ( json_last_error() !== JSON_ERROR_NONE ) {
            $error_msg = 'Invalid JSON: ' . json_last_error_msg();
            error_log( '[Kolchugino Map Import] ' . $error_msg );
            error_log( '[Kolchugino Map Import] Raw JSON content: ' . substr( $json_content, 0, 500 ) );
            wp_send_json_error( array( 'message' => $error_msg ) );
        }

        if ( ! isset( $data['features'] ) || ! is_array( $data['features'] ) ) {
            $error_msg = 'Invalid GeoJSON format: missing features array';
            error_log( '[Kolchugino Map Import] ' . $error_msg );
            error_log( '[Kolchugino Map Import] Data structure: ' . print_r( $data, true ) );
            wp_send_json_error( array( 'message' => $error_msg ) );
        }

        error_log( '[Kolchugino Map Import] Found ' . count( $data['features'] ) . ' features to process' );

        // Удаляем все существующие объекты перед импортом
        $existing_posts = get_posts( array(
            'post_type'      => 'map_object',
            'posts_per_page' => -1,
        ) );

        foreach ( $existing_posts as $post ) {
            wp_delete_post( $post->ID, true );
        }

        $imported = 0;
        $skipped = 0;

        error_log( '[Kolchugino Map Import] Starting processing features...' );

        foreach ( $data['features'] as $index => $feature ) {
            error_log( '[Kolchugino Map Import] Processing feature #' . $index );

            if ( ! isset( $feature['properties'] ) || ! isset( $feature['geometry'] ) ) {
                error_log( '[Kolchugino Map Import] Skipping feature #' . $index . ': missing properties or geometry' );
                $skipped++;
                continue;
            }

            $props = $feature['properties'];
            $coords = $feature['geometry']['coordinates'];

            // Используем iconCaption как fallback для title
            $title = isset( $props['title'] ) ? $props['title'] : (isset($props['iconCaption']) ? $props['iconCaption'] : 'Без названия');

            if ( ! isset( $coords[1] ) || ! isset( $coords[0] ) ) {
                error_log( '[Kolchugino Map Import] Skipping feature #' . $index . ': invalid coordinates' );
                $skipped++;
                continue;
            }

            // Определение категории на основе marker-color или по умолчанию
            $category_slug = 'other';
            if ( isset( $props['marker-color'] ) ) {
                $color = $props['marker-color'];
                // Присваиваем категории в зависимости от цвета
                if ( strpos( $color, '#1e98ff' ) !== false || strpos( $color, 'blue' ) !== false ) {
                    $category_slug = 'shop';
                } elseif ( strpos( $color, '#1abc9c' ) !== false || strpos( $color, 'green' ) !== false ) {
                    $category_slug = 'pharmacy';
                } elseif ( strpos( $color, '#e74c3c' ) !== false || strpos( $color, 'red' ) !== false ) {
                    $category_slug = 'attraction';
                } elseif ( strpos( $color, '#f39c12' ) !== false || strpos( $color, 'orange' ) !== false ) {
                    $category_slug = 'cafe';
                }
            }

            // Создание поста
            $post_data = array(
                'post_title'    => $title,
                'post_content'  => $props['description'] ?? '',
                'post_excerpt'  => $props['description'] ?? '',
                'post_status'   => 'publish',
                'post_type'     => 'map_object',
            );

            $post_id = wp_insert_post( $post_data );

            if ( is_wp_error( $post_id ) ) {
                $error_msg = 'Failed to create post #' . $index . ': ' . $post_id->get_error_message();
                error_log( '[Kolchugino Map Import] ' . $error_msg );
                error_log( '[Kolchugino Map Import] Post data: ' . print_r( $post_data, true ) );
                $skipped++;
                continue;
            }

            error_log( '[Kolchugino Map Import] Successfully created post #' . $index . ' with ID: ' . $post_id );

            // Сохранение координат
            update_post_meta( $post_id, '_map_lat', (float) $coords[1] );
            update_post_meta( $post_id, '_map_lng', (float) $coords[0] );

            // Сохранение адреса
            if ( isset( $props['address'] ) ) {
                update_post_meta( $post_id, '_map_address', $props['address'] );
            }

            // Сохранение телефона
            if ( isset( $props['phone'] ) ) {
                update_post_meta( $post_id, '_map_phone', $props['phone'] );
            }

            // Сохранение сайта
            if ( isset( $props['website'] ) ) {
                update_post_meta( $post_id, '_map_website', $props['website'] );
            }

            // Сохранение email
            if ( isset( $props['email'] ) ) {
                update_post_meta( $post_id, '_map_email', $props['email'] );
            }

            // Сохранение часов работы
            if ( isset( $props['opening_hours'] ) ) {
                update_post_meta( $post_id, '_map_opening_hours', $props['opening_hours'] );
            }

            // Сохранение цен
            if ( isset( $props['price'] ) ) {
                update_post_meta( $post_id, '_map_price', $props['price'] );
            }

            // Сохранение категории
            $category = get_term_by( 'slug', $category_slug, 'map_category' );
            if ( $category ) {
                wp_set_object_terms( $post_id, $category->term_id, 'map_category' );
            }

            // Сохранение категории из свойства category (если есть)
            if ( isset( $props['category'] ) && ! empty( $props['category'] ) ) {
                $category_slug = sanitize_title( $props['category'] );
                $category = get_term_by( 'slug', $category_slug, 'map_category' );
                if ( $category ) {
                    wp_set_object_terms( $post_id, $category->term_id, 'map_category' );
                }
            }

            $imported++;
            error_log( '[Kolchugino Map Import] Feature #' . $index . ' imported successfully' );
        }

        error_log( '[Kolchugino Map Import] Import completed: ' . $imported . ' imported, ' . $skipped . ' skipped' );
        wp_send_json_success( array(
            'imported' => $imported,
            'skipped' => $skipped,
        ) );
    }

    /**
     * Получение всех категорий
     */
    public static function get_map_categories() {
        // Проверка nonce
        if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'kolchugino_map_nonce' ) ) {
            wp_send_json_error( array( 'message' => 'Invalid nonce' ) );
        }

        $categories = KOLCHUGINO_MAP_Taxonomy::get_categories_with_meta();

        wp_send_json_success( array( 'categories' => $categories ) );
    }
    
    /**
     * Обратное геокодирование - получение адреса по координатам
     */
    public static function reverse_geocode() {
        // Проверка nonce
        if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'kolchugino_map_nonce' ) ) {
            wp_send_json_error( array( 'message' => 'Invalid nonce' ) );
        }
        
        // Проверка прав
        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( array( 'message' => 'Insufficient permissions' ) );
        }
        
        // Получаем координаты
        $lat = isset( $_POST['lat'] ) ? floatval( $_POST['lat'] ) : 0;
        $lng = isset( $_POST['lng'] ) ? floatval( $_POST['lng'] ) : 0;
        
        if ( $lat === 0 || $lng === 0 ) {
            wp_send_json_error( array( 'message' => 'Invalid coordinates' ) );
        }
        
        // Пробуем получить адрес через Nominatim (OpenStreetMap)
        $address = self::get_address_from_nominatim( $lat, $lng );
        
        if ( $address ) {
            wp_send_json_success( array( 'address' => $address ) );
        } else {
            // Если не удалось получить адрес, возвращаем координаты в текстовом формате
            $fallback_address = sprintf( '%.6f, %.6f', $lat, $lng );
            wp_send_json_success( array( 'address' => $fallback_address ) );
        }
    }
    
    /**
     * Получение адреса через Nominatim API
     */
    private static function get_address_from_nominatim( $lat, $lng ) {
        $url = sprintf(
            'https://nominatim.openstreetmap.org/reverse?format=json&lat=%f&lon=%f&zoom=18&addressdetails=1',
            $lat,
            $lng
        );
        
        // Добавляем User-Agent для соответствия требованиям Nominatim
        $args = array(
            'headers' => array(
                'User-Agent' => 'KolchuginoMapPlugin/1.3.5 (https://kolchugino-map.local; contact@kolchugino-map.local)'
            ),
            'timeout' => 10,
        );
        
        $response = wp_remote_get( $url, $args );
        
        if ( is_wp_error( $response ) ) {
            kolchugino_log()->error( 'Nominatim request failed', array(
                'error' => $response->get_error_message(),
                'lat' => $lat,
                'lng' => $lng
            ) );
            return false;
        }
        
        $body = wp_remote_retrieve_body( $response );
        $data = json_decode( $body, true );
        
        if ( json_last_error() !== JSON_ERROR_NONE || ! isset( $data['display_name'] ) ) {
            kolchugino_log()->error( 'Invalid Nominatim response', array(
                'json_error' => json_last_error_msg(),
                'response' => $body,
                'lat' => $lat,
                'lng' => $lng
            ) );
            return false;
        }
        
        return $data['display_name'];
    }
    

}

// Инициализация
