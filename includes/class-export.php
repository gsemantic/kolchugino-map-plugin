<?php
/**
 * Экспорт данных карты для печати и оффлайн режима
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class KOLCHUGINO_MAP_Export {

    public static function init() {
        add_action( 'init', array( __CLASS__, 'handle_export_requests' ) );
        add_action( 'admin_menu', array( __CLASS__, 'add_export_menu' ) );
    }

    /**
     * Добавление страницы экспорта в админке
     */
    public static function add_export_menu() {
        // Логируем добавление меню экспорта
        kolchugino_log()->info( 'Adding export menu', array(
            'user' => wp_get_current_user()->user_login,
            'capability' => current_user_can( 'manage_options' ) ? 'yes' : 'no'
        ) );
        
        add_submenu_page(
            'edit.php?post_type=map_object',
            __( 'Импорт и экспорт данных', 'kolchugino-map' ),
            __( 'Импорт и экспорт', 'kolchugino-map' ),
            'manage_options',
            'kolchugino-map-export',
            array( __CLASS__, 'render_export_page' )
        );
    }

    /**
     * Обработка запросов на экспорт
     */
    public static function handle_export_requests() {
        // Проверяем, что это GET-запрос
        if ( ! isset( $_GET['kolchugino_export'] ) || $_SERVER['REQUEST_METHOD'] !== 'GET' ) {
            return;
        }

        if ( current_user_can( 'manage_options' ) ) {
            $export_type = sanitize_text_field( $_GET['kolchugino_export'] );

            kolchugino_log()->info( 'Export request', array(
                'type' => $export_type,
                'user' => wp_get_current_user()->user_login
            ) );

            switch ( $export_type ) {
                case 'geojson':
                    self::export_geojson();
                    break;
                case 'csv':
                    self::export_csv();
                    break;
                case 'print-pdf':
                    self::export_print_pdf();
                    break;
            }
        }
    }

    /**
     * Экспорт GeoJSON
     */
    public static function export_geojson() {
        // Логируем процесс экспорта
        kolchugino_log()->info( 'Exporting GeoJSON', array(
            'user_capability' => current_user_can( 'manage_options' ) ? 'yes' : 'no',
            'nonce_present' => isset( $_GET['nonce'] ) ? 'yes' : 'no',
            'nonce_valid' => isset( $_GET['nonce'] ) ? ( wp_verify_nonce( $_GET['nonce'], 'kolchugino_export' ) ? 'yes' : 'no' ) : 'no'
        ) );

        if ( ! current_user_can( 'manage_options' ) ) {
            kolchugino_log()->warning( 'User does not have manage_options capability' );
            wp_die( 'У вас нет прав для выполнения этого действия' );
        }

        // Проверка nonce
        if ( ! isset( $_GET['nonce'] ) || ! wp_verify_nonce( $_GET['nonce'], 'kolchugino_export' ) ) {
            kolchugino_log()->warning( 'Invalid nonce' );
            wp_die( 'Недопустимый запрос' );
        }

        $args = array(
            'post_type'      => 'map_object',
            'posts_per_page' => -1,
            'orderby'        => 'title',
            'order'          => 'ASC'
        );

        $posts = get_posts( $args );
        $features = array();

        foreach ( $posts as $post ) {
            $lat = get_post_meta( $post->ID, '_map_lat', true );
            $lng = get_post_meta( $post->ID, '_map_lng', true );
            $address = get_post_meta( $post->ID, '_map_address', true );
            $phone = get_post_meta( $post->ID, '_map_phone', true );
            $website = get_post_meta( $post->ID, '_map_website', true );
            $email = get_post_meta( $post->ID, '_map_email', true );
            $opening_hours = get_post_meta( $post->ID, '_map_opening_hours', true );
            $price = get_post_meta( $post->ID, '_map_price', true );
            $category = get_post_meta( $post->ID, '_map_category', true );
            $thumbnail = get_post_meta( $post->ID, '_map_thumbnail', true );
            $marker_icon = get_post_meta( $post->ID, '_map_marker_icon', true );
            $marker_color = get_post_meta( $post->ID, '_map_marker_color', true );

            $feature = array(
                'type' => 'Feature',
                'geometry' => array(
                    'type' => 'Point',
                    'coordinates' => array( floatval( $lng ), floatval( $lat ) )
                ),
                'properties' => array(
                    'title' => $post->post_title,
                    'description' => $post->post_content,
                    'address' => $address,
                    'phone' => $phone,
                    'website' => $website,
                    'email' => $email,
                    'opening_hours' => $opening_hours,
                    'price' => $price,
                    'category' => $category,
                    'thumbnail' => $thumbnail,
                    'marker_icon' => $marker_icon ?: 'circle',
                    'marker_color' => $marker_color ?: '',
                    'excerpt' => wp_trim_words($post->post_excerpt ?: $post->post_content, 20, '...')
                )
            );

            $features[] = $feature;
        }

        $geojson = array(
            'type' => 'FeatureCollection',
            'features' => $features
        );

        $filename = 'kolchugino_poi_' . date( 'Y-m-d_H-i-s' ) . '.geojson';
        $filename_utf8 = 'kolchugino_poi_' . date( 'Y-m-d_H-i-s' ) . '.geojson';

        header( 'Content-Type: application/json' );
        header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
        header( 'Content-Disposition: attachment; filename*=UTF-8\'\'' . rawurlencode( $filename_utf8 ) );
        header( 'X-Robots-Tag: noindex, nofollow' );
        header( 'Cache-Control: no-cache, no-store, must-revalidate' );
        header( 'Pragma: no-cache' );
        header( 'Expires: 0' );
        echo json_encode( $geojson, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE );
        exit;
    }

    /**
     * Экспорт CSV
     */
    public static function export_csv() {
        // Логируем процесс экспорта CSV
        kolchugino_log()->info( 'Exporting CSV', array(
            'user_capability' => current_user_can( 'manage_options' ) ? 'yes' : 'no',
            'nonce_present' => isset( $_GET['nonce'] ) ? 'yes' : 'no',
            'nonce_valid' => isset( $_GET['nonce'] ) ? ( wp_verify_nonce( $_GET['nonce'], 'kolchugino_export' ) ? 'yes' : 'no' ) : 'no'
        ) );

        if ( ! current_user_can( 'manage_options' ) ) {
            kolchugino_log()->warning( 'User does not have manage_options capability' );
            wp_die( 'У вас нет прав для выполнения этого действия' );
        }

        // Проверка nonce
        if ( ! isset( $_GET['nonce'] ) || ! wp_verify_nonce( $_GET['nonce'], 'kolchugino_export' ) ) {
            kolchugino_log()->warning( 'Invalid nonce' );
            wp_die( 'Недопустимый запрос' );
        }

        $args = array(
            'post_type'      => 'map_object',
            'posts_per_page' => -1,
            'orderby'        => 'title',
            'order'          => 'ASC'
        );

        $posts = get_posts( $args );

        header( 'Content-Type: text/csv; charset=utf-8' );
        header( 'Content-Disposition: attachment; filename="kolchugino_poi_' . date( 'Y-m-d_H-i-s' ) . '.csv"' );
        header( 'X-Robots-Tag: noindex, nofollow' );
        header( 'Cache-Control: no-cache, no-store, must-revalidate' );
        header( 'Pragma: no-cache' );
        header( 'Expires: 0' );

        $output = fopen( 'php://output', 'w' );
        
        // Добавляем BOM для поддержки UTF-8
        fprintf( $output, chr( 0xEF ) . chr( 0xBB ) . chr( 0xBF ) );
        
        // Заголовки
        fputcsv( $output, array( 'Название', 'Описание', 'Адрес', 'Телефон', 'Сайт', 'Email', 'Часы работы', 'Цена', 'Категория', 'Широта', 'Долгота', 'Иконка маркера', 'Цвет маркера', 'Краткое описание' ) );

        foreach ( $posts as $post ) {
            $lat = get_post_meta( $post->ID, '_map_lat', true );
            $lng = get_post_meta( $post->ID, '_map_lng', true );
            $address = get_post_meta( $post->ID, '_map_address', true );
            $phone = get_post_meta( $post->ID, '_map_phone', true );
            $website = get_post_meta( $post->ID, '_map_website', true );
            $email = get_post_meta( $post->ID, '_map_email', true );
            $opening_hours = get_post_meta( $post->ID, '_map_opening_hours', true );
            $price = get_post_meta( $post->ID, '_map_price', true );
            $category = get_post_meta( $post->ID, '_map_category', true );
            $marker_icon = get_post_meta( $post->ID, '_map_marker_icon', true ) ?: 'circle';
            $marker_color = get_post_meta( $post->ID, '_map_marker_color', true ) ?: '';
            $excerpt = wp_trim_words($post->post_excerpt ?: $post->post_content, 20, '...');

            fputcsv( $output, array(
                $post->post_title,
                $post->post_content,
                $address,
                $phone,
                $website,
                $email,
                $opening_hours,
                $price,
                $category,
                $lat,
                $lng,
                $marker_icon,
                $marker_color,
                $excerpt
            ) );
        }

        foreach ( $posts as $post ) {
            $lat = get_post_meta( $post->ID, '_map_lat', true );
            $lng = get_post_meta( $post->ID, '_map_lng', true );
            $address = get_post_meta( $post->ID, '_map_address', true );
            $phone = get_post_meta( $post->ID, '_map_phone', true );
            $website = get_post_meta( $post->ID, '_map_website', true );
            $email = get_post_meta( $post->ID, '_map_email', true );
            $opening_hours = get_post_meta( $post->ID, '_map_opening_hours', true );
            $price = get_post_meta( $post->ID, '_map_price', true );
            $category = get_post_meta( $post->ID, '_map_category', true );

            fputcsv( $output, array(
                $post->post_title,
                $post->post_content,
                $address,
                $phone,
                $website,
                $email,
                $opening_hours,
                $price,
                $category,
                $lat,
                $lng
            ) );
        }

        fclose( $output );
        exit;
    }

    /**
     * Экспорт для печати в PDF
     */
    public static function export_print_pdf() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'У вас нет прав для выполнения этого действия' );
        }

        $args = array(
            'post_type'      => 'map_object',
            'posts_per_page' => -1,
            'orderby'        => 'title',
            'order'          => 'ASC'
        );

        $posts = get_posts( $args );

        // Здесь можно добавить генерацию PDF
        // Для простоты выводим HTML версию для печати
        include plugin_dir_path( __FILE__ ) . '../templates/print-view.php';
        exit;
    }

    /**
     * Отрисовка страницы экспорта
     */
    public static function render_export_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        // Логируем информацию о странице
        kolchugino_log()->info( 'Export page loaded', array(
            'version' => KOLCHUGINO_MAP_VERSION,
            'file_path' => __FILE__,
            'view' => isset( $_GET['view'] ) ? sanitize_text_field( $_GET['view'] ) : 'default'
        ) );

        $view = isset( $_GET['view'] ) ? sanitize_text_field( $_GET['view'] ) : 'default';
        
        if ( $view === 'print' ) {
            self::render_print_view();
            return;
        }

        ?>
        <div class="wrap">
            <h1><?php _e( 'Импорт и экспорт данных карты', 'kolchugino-map' ); ?></h1>
            
            <div class="kolchugino-export-options" style="margin-top: 20px;">
                <div class="export-card" style="background: #fff; border: 1px solid #ccd0d4; padding: 20px; margin: 10px 0; max-width: 600px;">
                    <h2><?php _e( 'Импорт GeoJSON', 'kolchugino-map' ); ?></h2>
                    <p><?php _e( 'Загрузка объектов из GeoJSON файла. Все существующие объекты будут удалены перед импортом.', 'kolchugino-map' ); ?></p>

                    <form id="import-geojson-form" enctype="multipart/form-data" style="margin-top: 15px;">
                        <?php wp_nonce_field( 'kolchugino_map_nonce', 'nonce' ); ?>
                        <input type="file" name="geojson_file" accept=".json,.geojson" required style="margin-bottom: 10px;" />
                        <button type="submit" class="button button-primary" id="import-btn">
                            <?php _e( 'Импортировать', 'kolchugino-map' ); ?>
                        </button>
                        <span id="import-message" style="margin-left: 10px;"></span>
                    </form>
                    <p class="description" style="margin-top: 10px;">
                        <?php _e( 'Формат GeoJSON должен содержать поле "title" в properties и координаты в geometry.coordinates', 'kolchugino-map' ); ?>
                    </p>
                </div>

                <script>
                jQuery(document).ready(function($) {
                    $('#import-geojson-form').on('submit', function(e) {
                        e.preventDefault();

                        var formData = new FormData(this);
                        formData.append('action', 'import_geojson');
                        var $btn = $('#import-btn');
                        var $message = $('#import-message');

                        $btn.prop('disabled', true).text('<?php _e( 'Импорт...', 'kolchugino-map' ); ?>');
                        $message.text('');

                        $.ajax({
                            url: '<?php echo admin_url( 'admin-ajax.php' ); ?>',
                            type: 'POST',
                            data: formData,
                            processData: false,
                            contentType: false,
                            success: function(response) {
                                if (response.success) {
                                    $message.text('<?php _e( 'Успешно импортировано: ', 'kolchugino-map' ); ?>' + response.data.imported + ' ' + '<?php _e( 'объектов', 'kolchugino-map' ); ?>');
                                    if (response.data.skipped > 0) {
                                        $message.text($message.text() + ' (' + '<?php _e( 'пропущено: ', 'kolchugino-map' ); ?>' + response.data.skipped + ')');
                                    }
                                } else {
                                    $message.text('<?php _e( 'Ошибка: ', 'kolchugino-map' ); ?>' + response.data.message);
                                }
                            },
                            error: function() {
                                $message.text('<?php _e( 'Ошибка сервера', 'kolchugino-map' ); ?>');
                            },
                            complete: function() {
                                $btn.prop('disabled', false).text('<?php _e( 'Импортировать', 'kolchugino-map' ); ?>');
                            }
                        });
                    });
                });
                </script>

                <div class="export-card" style="background: #fff; border: 1px solid #ccd0d4; padding: 20px; margin: 10px 0; max-width: 600px;">
                    <h2><?php _e( 'GeoJSON', 'kolchugino-map' ); ?></h2>
                    <p><?php _e( 'Экспорт всех объектов в формате GeoJSON', 'kolchugino-map' ); ?></p>
                    <a href="<?php echo add_query_arg( array( 'kolchugino_export' => 'geojson', 'nonce' => wp_create_nonce( 'kolchugino_export' ) ), admin_url( 'edit.php?post_type=map_object' ) ); ?>" class="button button-secondary">
                        <?php _e( 'Экспорт GeoJSON', 'kolchugino-map' ); ?>
                    </a>
                </div>

                <div class="export-card" style="background: #fff; border: 1px solid #ccd0d4; padding: 20px; margin: 10px 0; max-width: 600px;">
                    <h2><?php _e( 'CSV', 'kolchugino-map' ); ?></h2>
                    <p><?php _e( 'Экспорт всех объектов в формате CSV', 'kolchugino-map' ); ?></p>
                    <a href="<?php echo add_query_arg( array( 'kolchugino_export' => 'csv', 'nonce' => wp_create_nonce( 'kolchugino_export' ) ), admin_url( 'edit.php?post_type=map_object' ) ); ?>" class="button button-secondary">
                        <?php _e( 'Экспорт CSV', 'kolchugino-map' ); ?>
                    </a>
                </div>

                <div class="export-card" style="background: #fff; border: 1px solid #ccd0d4; padding: 20px; margin: 10px 0; max-width: 600px;">
                    <h2><?php _e( 'Версия для печати', 'kolchugino-map' ); ?></h2>
                    <p><?php _e( 'Просмотр и печать всех объектов', 'kolchugino-map' ); ?></p>
                    <a href="<?php echo add_query_arg( 'view', 'print', admin_url( 'edit.php?post_type=map_object&page=kolchugino-map-export' ) ); ?>" class="button button-secondary" target="_blank">
                        <?php _e( 'Просмотреть', 'kolchugino-map' ); ?>
                    </a>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Отрисовка страницы для печати
     */
    public static function render_print_view() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'У вас нет прав для выполнения этого действия' );
        }

        $args = array(
            'post_type'      => 'map_object',
            'posts_per_page' => -1,
            'orderby'        => 'title',
            'order'          => 'ASC'
        );

        $posts = get_posts( $args );

        include plugin_dir_path( __FILE__ ) . '../templates/print-view.php';
    }

    /**
     * Логирование ошибок (устаревший метод, для обратной совместимости)
     */
    private static function log_error($message) {
        kolchugino_log()->error( $message );
    }
}