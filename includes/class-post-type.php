<?php
/**
 * Регистрация кастомного типа записей для объектов карты
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class KOLCHUGINO_MAP_Post_Type {
    
    const POST_TYPE = 'map_object';
    
    public static function register() {
        $labels = array(
            'name'                  => _x( 'Объекты карты', 'Post Type General Name', 'kolchugino-map' ),
            'singular_name'         => _x( 'Объект карты', 'Post Type Singular Name', 'kolchugino-map' ),
            'menu_name'             => __( 'Туристическая карта', 'kolchugino-map' ),
            'all_items'             => __( 'Все объекты', 'kolchugino-map' ),
            'view_item'             => __( 'Просмотр объекта', 'kolchugino-map' ),
            'add_new_item'          => __( 'Добавить новый объект', 'kolchugino-map' ),
            'add_new'               => __( 'Добавить новый', 'kolchugino-map' ),
            'edit_item'             => __( 'Редактировать объект', 'kolchugino-map' ),
            'update_item'           => __( 'Обновить объект', 'kolchugino-map' ),
            'search_items'          => __( 'Найти объекты', 'kolchugino-map' ),
            'not_found'             => __( 'Объекты не найдены', 'kolchugino-map' ),
            'not_found_in_trash'    => __( 'В корзине объекты не найдены', 'kolchugino-map' ),
        );
        
        $args = array(
            'label'                 => __( 'Объект карты', 'kolchugino-map' ),
            'description'           => __( 'Объекты туристической карты Кольчугино', 'kolchugino-map' ),
            'labels'                => $labels,
            'supports'              => array( 'title', 'editor', 'thumbnail', 'excerpt', 'custom-fields', 'revisions' ),
            'taxonomies'            => array( 'map_category' ),
            'hierarchical'          => false,
            'public'                => true,
            'show_ui'               => true,
            'show_in_menu'          => true,
            'menu_position'         => 20,
            'menu_icon'             => 'dashicons-location',
            'show_in_admin_bar'     => true,
            'show_in_nav_menus'     => true,
            'can_export'            => true,
            'has_archive'           => false,
            'exclude_from_search'   => true,
            'publicly_queryable'    => true,
            'capability_type'       => 'post',
            'show_in_rest'          => true,
            'map_meta_cap'          => true,
            'register_meta_box_cb'  => array( __CLASS__, 'register_meta_boxes' ),
        );
        
        register_post_type( self::POST_TYPE, $args );
    }
    
    public static function get_center_coordinates() {
        return array(
            'lat' => KOLCHUGINO_MAP_CENTER_LAT,
            'lng' => KOLCHUGINO_MAP_CENTER_LNG,
        );
    }
    
    /**
     * Регистрация metaboxes для пост-типа
     */
    public static function register_meta_boxes() {
        // Эта функция будет вызвана WordPress при регистрации пост-типа
        // Metaboxes уже регистрируются через KOLCHUGINO_MAP_Metabox::init()
    }
}

// Регистрация при инициализации
add_action( 'init', array( 'KOLCHUGINO_MAP_Post_Type', 'register' ) );
