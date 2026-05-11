<?php
/**
 * Plugin Name: Кольчугино — Туристическая карта
 * Plugin URI:  https://kolchugino-map.local
 * Description: Интерактивная туристическая карта Кольчугинского района с достопримечательностями, кафе, магазинами и гостиницами.
 * Version:     1.5.2
 * Author:      Your Name
 * License:     GPL v2 or later
 * Text Domain: kolchugino-map
 * Domain Path: /languages
 */

// Защита от прямого доступа
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Защита от повторной инициализации
if ( ! defined( 'KOLCHUGINO_MAP_INITIALIZED' ) ) {
    define( 'KOLCHUGINO_MAP_INITIALIZED', true );

    // Константы плагина
    define( 'KOLCHUGINO_MAP_VERSION', '1.5.2' );
    define( 'KOLCHUGINO_MAP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
    define( 'KOLCHUGINO_MAP_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
    define( 'KOLCHUGINO_MAP_CENTER_LAT', 56.294425 );
    define( 'KOLCHUGINO_MAP_CENTER_LNG', 39.375751 );
    define( 'KOLCHUGINO_MAP_DEFAULT_ZOOM', 13 );

    // Включение required files
    require_once KOLCHUGINO_MAP_PLUGIN_DIR . 'includes/class-logger.php';
    require_once KOLCHUGINO_MAP_PLUGIN_DIR . 'includes/class-post-type.php';
    require_once KOLCHUGINO_MAP_PLUGIN_DIR . 'includes/class-taxonomy.php';
    require_once KOLCHUGINO_MAP_PLUGIN_DIR . 'includes/class-metabox.php';
    require_once KOLCHUGINO_MAP_PLUGIN_DIR . 'includes/class-ajax-handler.php';
    require_once KOLCHUGINO_MAP_PLUGIN_DIR . 'includes/class-shortcode.php';
    require_once KOLCHUGINO_MAP_PLUGIN_DIR . 'includes/class-export.php';
    require_once KOLCHUGINO_MAP_PLUGIN_DIR . 'includes/class-settings.php';

    // Инициализация
    function kolchugino_map_init() {
        load_plugin_textdomain( 'kolchugino-map', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );

        // Инициализация классов (единожды)
        new KOLCHUGINO_MAP_Post_Type();
        new KOLCHUGINO_MAP_Taxonomy();
        new KOLCHUGINO_MAP_MetaBox();
        new KOLCHUGINO_MAP_Shortcode();
        KOLCHUGINO_MAP_Ajax_Handler::init();
        KOLCHUGINO_MAP_Export::init();
        KOLCHUGINO_MAP_Settings::init();

        // Логируем версию плагина
        kolchugino_log()->info( 'Plugin initialized', array(
            'version' => KOLCHUGINO_MAP_VERSION,
            'file_path' => __FILE__
        ) );
    }
    add_action( 'plugins_loaded', 'kolchugino_map_init', 1 );

    // Активация плагина
    function kolchugino_map_activate() {
        flush_rewrite_rules();
        
        // Логируем активацию
        kolchugino_log()->notice( 'Plugin activated', array( 'version' => KOLCHUGINO_MAP_VERSION ) );
    }
    register_activation_hook( __FILE__, 'kolchugino_map_activate' );

    // Деактивация плагина
    function kolchugino_map_deactivate() {
        flush_rewrite_rules();
        
        // Логируем деактивацию
        kolchugino_log()->notice( 'Plugin deactivated' );
    }
    register_deactivation_hook( __FILE__, 'kolchugino_map_deactivate' );
    
    // Очистка при удалении
    function kolchugino_map_uninstall() {
        kolchugino_log()->warning( 'Plugin uninstalled - cleaning up logs' );
        // Очистка опций при необходимости
        delete_option( 'kolchugino_map_settings' );
        delete_option( 'kolchugino_map_log_level' );
    }
    register_uninstall_hook( __FILE__, 'kolchugino_map_uninstall' );
}