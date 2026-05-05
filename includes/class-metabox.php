<?php
/**
 * Мета-боксы для объектов карты
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class KOLCHUGINO_MAP_Metabox {
    
    public static function init() {
        add_action( 'add_meta_boxes', array( __CLASS__, 'add_metaboxes' ) );
        add_action( 'save_post', array( __CLASS__, 'save_metabox_data' ) );
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_admin_scripts' ) );
    }
    
    public static function enqueue_admin_scripts( $hook ) {
        kolchugino_log()->info( 'enqueue_admin_scripts called', array( 'hook' => $hook ) );
        
        // Подключаем скрипты только на страницах редактирования пост-типа map_object
        if ( $hook === 'post.php' || $hook === 'post-new.php' ) {
            // Для новых постов get_post_type() может вернуть false, проверяем по глобальному $post
            global $post;
            $post_type = $post ? get_post_type( $post->ID ) : '';
            
            // Также проверяем URL параметр post_type для новых постов
            if ( empty( $post_type ) && isset( $_GET['post_type'] ) ) {
                $post_type = sanitize_text_field( $_GET['post_type'] );
            }
            
            kolchugino_log()->info( 'Post type detected', array( 'post_type' => $post_type, 'post_id' => $post ? $post->ID : null ) );
            
            if ( $post_type === 'map_object' ) {
                // ОБЯЗАТЕЛЬНО: Подключаем Media Uploader для загрузки фото
                wp_enqueue_media();
                
                // Подключаем стили и JS OpenLayers в админку
                $vendor_url = KOLCHUGINO_MAP_PLUGIN_URL . 'assets/vendor/openlayers';
                wp_enqueue_style( 'openlayers-css', $vendor_url . '/ol.css', array(), '10.3.1' );
                wp_enqueue_script( 'openlayers-js', $vendor_url . '/ol.js', array(), '10.3.1', true );
                
                // Подключаем наш админский JS С УКАЗАНИЕМ ЗАВИСИМОСТИ ОТ openlayers-js
                wp_enqueue_script(
                    'kolchugino-map-admin-js',
                    KOLCHUGINO_MAP_PLUGIN_URL . 'assets/js/map-admin.js',
                    array( 'jquery', 'openlayers-js' ), // <--- ДОБАВЛЕНА ЗАВИСИМОСТЬ
                    '1.3.5',
                    true
                );
                
                // Передаем данные в JavaScript
                $existing_data = [];
                if ( $post && $post->ID > 0 ) {
                    $existing_data = [
                        'title'       => get_the_title( $post->ID ),
                        'lat'         => (float) get_post_meta( $post->ID, '_map_lat', true ),
                        'lng'         => (float) get_post_meta( $post->ID, '_map_lng', true ),
                        'phone'       => get_post_meta( $post->ID, '_map_phone', true ),
                        'email'       => get_post_meta( $post->ID, '_map_email', true ),
                        'website'     => get_post_meta( $post->ID, '_map_website', true ),
                        'description' => get_the_excerpt( $post->ID ) ?: get_post_meta( $post->ID, '_map_description', true ),
                        'thumbnail'   => get_the_post_thumbnail_url( $post->ID, 'medium' ) ?: '',
                    ];
                }

                wp_localize_script( 'kolchugino-map-admin-js', 'kolchuginoMapData', [
                    'centerLat'    => KOLCHUGINO_MAP_Settings::get_center()['lat'],
                    'centerLng'    => KOLCHUGINO_MAP_Settings::get_center()['lng'],
                    'hasOfflineTiles' => false,
                    'tilesUrl'     => '',
                    'version'      => '1.3.5',
                    'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
                    'nonce'        => wp_create_nonce( 'kolchugino_map_nonce' ),
                    'postId'       => $post ? $post->ID : 0,
                    'existingData' => $existing_data,
                ] );
            }
        }
    }
    
    /**
     * Добавление мета-боксов
     */
    public static function add_metaboxes() {
        add_meta_box(
            'kolchugino_map_location',
            __( 'Местоположение на карте', 'kolchugino-map' ),
            array( __CLASS__, 'render_location_metabox' ),
            'map_object',
            'normal',
            'high'
        );
        
        add_meta_box(
            'kolchugino_map_contact',
            __( 'Контактная информация', 'kolchugino-map' ),
            array( __CLASS__, 'render_contact_metabox' ),
            'map_object',
            'normal',
            'default'
        );
        
        add_meta_box(
            'kolchugino_map_additional',
            __( 'Дополнительная информация', 'kolchugino-map' ),
            array( __CLASS__, 'render_additional_metabox' ),
            'map_object',
            'side',
            'default'
        );
    }
    
    /**
     * Рендер мета-бокса местоположения
     */
    public static function render_location_metabox( $post ) {
        wp_nonce_field( 'kolchugino_map_location', 'kolchugino_map_location_nonce' );
        
        $lat = get_post_meta( $post->ID, '_map_lat', true );
        $lng = get_post_meta( $post->ID, '_map_lng', true );
        $zoom = get_post_meta( $post->ID, '_map_zoom', true ) ?: 15;
        
        ?>
        <div id="kolchugino-map-admin" style="height: 400px; margin-bottom: 10px;"></div>
        <input type="hidden" id="map_lat" name="map_lat" value="<?php echo esc_attr( $lat ); ?>" />
        <input type="hidden" id="map_lng" name="map_lng" value="<?php echo esc_attr( $lng ); ?>" />
        <input type="hidden" id="map_zoom" name="map_zoom" value="<?php echo esc_attr( $zoom ); ?>" />
        
        <!-- Поля для кастомных маркеров -->
        <input type="hidden" id="_map_marker_icon" name="_map_marker_icon" value="<?php echo esc_attr( get_post_meta( $post->ID, '_map_marker_icon', true ) ); ?>" />
        <input type="hidden" id="_map_marker_color" name="_map_marker_color" value="<?php echo esc_attr( get_post_meta( $post->ID, '_map_marker_color', true ) ); ?>" />
        
        <!-- Селектор маркеров -->
        <div style="margin: 15px 0;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                <?php _e( 'Выберите иконку маркера:', 'kolchugino-map' ); ?>
            </label>
            <div id="marker-selector" class="marker-selector">
                <button type="button" class="marker-option" data-icon="circle" data-color="#e74c3c" title="Круг">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="10"/>
                    </svg>
                </button>
                <button type="button" class="marker-option" data-icon="star" data-color="#f39c12" title="Звезда">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                </button>
                <button type="button" class="marker-option" data-icon="pin" data-color="#3498db" title="Штырь">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                </button>
                <button type="button" class="marker-option" data-icon="house" data-color="#27ae60" title="Дом">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                    </svg>
                </button>
                <button type="button" class="marker-option" data-icon="shop" data-color="#9b59b6" title="Магазин">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 7h-3V6a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V10h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM9 6h6v1H9V6zm10 11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V10h2v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V10h2v7z"/>
                    </svg>
                </button>
                <button type="button" class="marker-option" data-icon="cafe" data-color="#e67e22" title="Кафе">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 8h-2.81c.43-.78.81-1.62.81-2.5 0-1.38-1.12-2.5-2.5-2.5-1.93 0-3.5 1.57-3.5 3.5 0 .88.38 1.72.81 2.5H8.19c.43-.78.81-1.62.81-2.5 0-1.38-1.12-2.5-2.5-2.5S4 4.12 4 5.5c0 .88.38 1.72.81 2.5H2v10h20V8zm-7-2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5S13 6.33 13 5.5zM5 5.5c0-.83.67-1.5 1.5-1.5S8 4.67 8 5.5 7.33 7 6.5 7 5 6.33 5 5.5zm13 10.5H6v-5h12v5z"/>
                    </svg>
                </button>
            </div>
        </div>
        
        <p>
            <label for="map_address">
                <strong><?php _e( 'Адрес:', 'kolchugino-map' ); ?></strong>
            </label>
            <input type="text" id="map_address" class="large-text"
                   value="<?php echo esc_attr( get_post_meta( $post->ID, '_map_address', true ) ); ?>"
                   name="map_address"
                   placeholder="<?php _e( 'Введите адрес объекта', 'kolchugino-map' ); ?>" />
        </p>
        
        <p>
            <label for="map_lat_input">
                <strong><?php _e( 'Широта (Latitude):', 'kolchugino-map' ); ?></strong>
            </label>
            <input type="number" id="map_lat_input" class="regular-text"
                   value="<?php echo esc_attr( $lat ); ?>"
                   name="map_lat_input"
                   step="0.000001"
                   placeholder="<?php _e( 'Пример: 56.294425', 'kolchugino-map' ); ?>" />
        </p>
        
        <p>
            <label for="map_lng_input">
                <strong><?php _e( 'Долгота (Longitude):', 'kolchugino-map' ); ?></strong>
            </label>
            <input type="number" id="map_lng_input" class="regular-text"
                   value="<?php echo esc_attr( $lng ); ?>"
                   name="map_lng_input"
                   step="0.000001"
                   placeholder="<?php _e( 'Пример: 39.375751', 'kolchugino-map' ); ?>" />
        </p>
        
        <p class="description">
            <?php _e( 'Кликните на карту для установки маркера или введите координаты вручную', 'kolchugino-map' ); ?>
        </p>
        
        
        <style>
        #kolchugino-map-admin {
            border: 2px solid #ddd;
            border-radius: 4px;
        }
        </style>
        <?php
    }
    
    /**
     * Рендер мета-бокса контактов
     */
    public static function render_contact_metabox( $post ) {
        wp_nonce_field( 'kolchugino_map_contact', 'kolchugino_map_contact_nonce' );
        
        $phone = get_post_meta( $post->ID, '_map_phone', true );
        $website = get_post_meta( $post->ID, '_map_website', true );
        $email = get_post_meta( $post->ID, '_map_email', true );
        
        ?>
        <table class="form-table">
            <tr>
                <th><label for="map_phone"><?php _e( 'Телефон', 'kolchugino-map' ); ?></label></th>
                <td>
                    <input type="text" id="map_phone" class="regular-text" 
                           value="<?php echo esc_attr( $phone ); ?>" name="map_phone" 
                           placeholder="+7 (XXX) XXX-XX-XX" />
                </td>
            </tr>
            <tr>
                <th><label for="map_website"><?php _e( 'Веб-сайт', 'kolchugino-map' ); ?></label></th>
                <td>
                    <input type="url" id="map_website" class="large-text" 
                           value="<?php echo esc_attr( $website ); ?>" name="map_website" 
                           placeholder="https://example.com" />
                </td>
            </tr>
            <tr>
                <th><label for="map_email"><?php _e( 'Email', 'kolchugino-map' ); ?></label></th>
                <td>
                    <input type="email" id="map_email" class="regular-text" 
                           value="<?php echo esc_attr( $email ); ?>" name="map_email" 
                           placeholder="email@example.com" />
                </td>
            </tr>
        </table>

        <?php
    }
    
    /**
     * Рендер мета-бокса дополнительной информации
     */
    public static function render_additional_metabox( $post ) {
        wp_nonce_field( 'kolchugino_map_additional', 'kolchugino_map_additional_nonce' );
        
        $opening_hours = get_post_meta( $post->ID, '_map_opening_hours', true );
        $price = get_post_meta( $post->ID, '_map_price', true );
        $featured = get_post_meta( $post->ID, '_map_featured', true );
        $custom_text = get_post_meta( $post->ID, '_map_custom_popup_text', true );
        
        ?>
        <p>
            <label for="map_opening_hours">
                <strong><?php _e( 'Часы работы:', 'kolchugino-map' ); ?></strong>
            </label>
            <input type="text" id="map_opening_hours" class="large-text" 
                   value="<?php echo esc_attr( $opening_hours ); ?>" name="map_opening_hours" 
                   placeholder="Mo-Fr 09:00-18:00" />
            <span class="description"><?php _e( 'Формат: Mo-Fr 09:00-18:00', 'kolchugino-map' ); ?></span>
        </p>
        
        <p>
            <label for="map_price">
                <strong><?php _e( 'Цены:', 'kolchugino-map' ); ?></strong>
            </label>
            <input type="text" id="map_price" class="large-text" 
                   value="<?php echo esc_attr( $price ); ?>" name="map_price" 
                   placeholder="от 500 руб." />
        </p>
        
        <p>
            <label>
                <input type="checkbox" name="map_featured" value="1"
                       <?php checked( $featured, '1' ); ?> />
                <strong><?php _e( 'Рекомендуемый объект', 'kolchugino-map' ); ?></strong>
            </label>
            <span class="description"><?php _e( 'Отображать в первую очередь', 'kolchugino-map' ); ?></span>
        </p>
        
        <p>
            <label for="map_custom_popup_text">
                <strong><?php _e( 'Произвольный текст в попапе:', 'kolchugino-map' ); ?></strong>
            </label>
            <textarea id="map_custom_popup_text" class="large-text" name="map_custom_popup_text" rows="4" placeholder="Доп. текст для всплывающего окна"><?php echo esc_textarea( $custom_text ); ?></textarea>
            <span class="description"><?php _e( 'Текст будет выведен в попапе после описания', 'kolchugino-map' ); ?></span>
        </p>
        <?php
    }
    
    /**
     * Сохранение данных мета-боксов
     */
    public static function save_metabox_data( $post_id ) {
        // Логируем входящие данные для диагностики
        kolchugino_log()->info( 'save_metabox_data called', array(
            'post_id' => $post_id,
            'post_keys' => array_keys( $_POST ),
            'thumbnail_id_in_post' => isset( $_POST['thumbnail_id'] ) ? $_POST['thumbnail_id'] : 'NOT_SET'
        ) );
        
        // Проверка базовых условий
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            kolchugino_log()->info( 'Autosave - skipping' );
            return;
        }

        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            kolchugino_log()->warning( 'User cannot edit post' );
            return;
        }

        // Проверка nonce - проверяем каждый отдельно, не прерываем при ошибке одного
        $nonces = array(
            'kolchugino_map_location_nonce' => 'kolchugino_map_location',
            'kolchugino_map_contact_nonce' => 'kolchugino_map_contact',
            'kolchugino_map_additional_nonce' => 'kolchugino_map_additional',
        );

        $verified_nonces = array();
        foreach ( $nonces as $nonce_field => $action ) {
            $is_verified = isset( $_POST[ $nonce_field ] ) && wp_verify_nonce( $_POST[ $nonce_field ], $action );
            $verified_nonces[ $nonce_field ] = $is_verified;
            
            kolchugino_log()->info( 'Nonce check', array(
                'field' => $nonce_field,
                'action' => $action,
                'verified' => $is_verified
            ) );
        }

        // Проверяем, что хотя бы один nonce валиден (достаточно для базовой защиты)
        $has_valid_nonce = in_array( true, $verified_nonces, true );
        if ( ! $has_valid_nonce ) {
            kolchugino_log()->error( 'All nonces failed - exiting' );
            return;
        }
        
        // Сохранение координат с правильным приведением типов
        if ( isset( $_POST['map_lat'] ) ) {
            update_post_meta( $post_id, '_map_lat', floatval( $_POST['map_lat'] ) );
        }
        if ( isset( $_POST['map_lat_input'] ) ) {
            update_post_meta( $post_id, '_map_lat', floatval( $_POST['map_lat_input'] ) );
        }
        if ( isset( $_POST['map_lng'] ) ) {
            update_post_meta( $post_id, '_map_lng', floatval( $_POST['map_lng'] ) );
        }
        if ( isset( $_POST['map_lng_input'] ) ) {
            update_post_meta( $post_id, '_map_lng', floatval( $_POST['map_lng_input'] ) );
        }
        if ( isset( $_POST['map_zoom'] ) ) {
            update_post_meta( $post_id, '_map_zoom', intval( $_POST['map_zoom'] ) );
        }

        // Сохранение текстовых полей
        $text_fields = array(
            '_map_address'      => 'map_address',
            '_map_phone'        => 'map_phone',
            '_map_website'      => 'map_website',
            '_map_email'        => 'map_email',
            '_map_opening_hours'=> 'map_opening_hours',
            '_map_price'        => 'map_price',
            '_map_custom_popup_text' => 'map_custom_popup_text',
        );

        foreach ( $text_fields as $meta_key => $post_key ) {
            if ( isset( $_POST[ $post_key ] ) ) {
                update_post_meta( $post_id, $meta_key, sanitize_text_field( $_POST[ $post_key ] ) );
            }
        }
        
        // Сохранение полей для кастомных маркеров
        if ( isset( $_POST['_map_marker_icon'] ) ) {
            update_post_meta( $post_id, '_map_marker_icon', sanitize_text_field( $_POST['_map_marker_icon'] ) );
        }
        if ( isset( $_POST['_map_marker_color'] ) ) {
            update_post_meta( $post_id, '_map_marker_color', sanitize_hex_color( $_POST['_map_marker_color'] ) );
        }
        
        
        // Чекбокс featured
        $featured = isset( $_POST['map_featured'] ) ? '1' : '0';
        update_post_meta( $post_id, '_map_featured', $featured );
        
        // Миниатюра сохраняется мгновенно через AJAX (kolchugino_map_save_thumbnail).
        // Ручная обработка в save_post удалена для предотвращения конфликтов и гонок состояний.
    }
}

// Инициализация
KOLCHUGINO_MAP_Metabox::init();
