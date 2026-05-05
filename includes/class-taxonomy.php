<?php
/**
 * Регистрация кастомной таксономии для категорий объектов
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class KOLCHUGINO_MAP_Taxonomy {
    
    const TAXONOMY = 'map_category';
    
    // Предустановленные категории
    const CATEGORIES = array(
        'attraction'    => array(
            'name'  => 'Достопримечательности',
            'icon'  => 'dashicons-building',
            'color' => '#e74c3c',
        ),
        'cafe'          => array(
            'name'  => 'Кафе и рестораны',
            'icon'  => 'dashicons-admin-site',
            'color' => '#f39c12',
        ),
        'shop'          => array(
            'name'  => 'Магазины',
            'icon'  => 'dashicons-cart',
            'color' => '#3498db',
        ),
        'hotel'         => array(
            'name'  => 'Гостиницы',
            'icon'  => 'dashicons-admin-multisite',
            'color' => '#9b59b6',
        ),
        'pharmacy'      => array(
            'name'  => 'Аптеки',
            'icon'  => 'dashicons-pressthis',
            'color' => '#2ecc71',
        ),
        'gas_station'   => array(
            'name'  => 'Заправки',
            'icon'  => 'dashicons-car',
            'color' => '#34495e',
        ),
        'other'         => array(
            'name'  => 'Другое',
            'icon'  => 'dashicons-location',
            'color' => '#95a5a6',
        ),
    );
    
    public static function register() {
        $labels = array(
            'name'                       => _x( 'Категории объектов', 'Taxonomy General Name', 'kolchugino-map' ),
            'singular_name'              => _x( 'Категория объекта', 'Taxonomy Singular Name', 'kolchugino-map' ),
            'menu_name'                  => __( 'Категории', 'kolchugino-map' ),
            'all_items'                  => __( 'Все категории', 'kolchugino-map' ),
            'parent_item'                => __( 'Родительская категория', 'kolchugino-map' ),
            'parent_item_colon'          => __( 'Родительская категория:', 'kolchugino-map' ),
            'new_item_name'              => __( 'Новая категория', 'kolchugino-map' ),
            'add_new_item'               => __( 'Добавить категорию', 'kolchugino-map' ),
            'edit_item'                  => __( 'Редактировать категорию', 'kolchugino-map' ),
            'update_item'                => __( 'Обновить категорию', 'kolchugino-map' ),
            'view_item'                  => __( 'Просмотр категории', 'kolchugino-map' ),
            'separate_items_with_commas' => __( 'Разделите категории запятыми', 'kolchugino-map' ),
            'add_or_remove_items'        => __( 'Добавить или удалить категории', 'kolchugino-map' ),
            'choose_from_most_used'      => __( 'Выбрать из наиболее используемых', 'kolchugino-map' ),
            'popular_items'              => __( 'Популярные категории', 'kolchugino-map' ),
            'search_items'               => __( 'Найти категории', 'kolchugino-map' ),
            'not_found'                  => __( 'Категории не найдены', 'kolchugino-map' ),
            'no_terms'                   => __( 'Без категорий', 'kolchugino-map' ),
            'items_list'                 => __( 'Список категорий', 'kolchugino-map' ),
            'items_list_navigation'      => __( 'Навигация по списку категорий', 'kolchugino-map' ),
        );
        
        $args = array(
            'labels'                     => $labels,
            'hierarchical'               => true,
            'public'                     => true,
            'show_ui'                    => true,
            'show_admin_column'          => true,
            'show_in_nav_menus'          => true,
            'show_tagcloud'              => false,
            'show_in_rest'               => true,
        );
        
        register_taxonomy( self::TAXONOMY, array( 'map_object' ), $args );
    }
    
    /**
     * Создание категорий по умолчанию при активации плагина
     */
    public static function create_default_categories() {
        foreach ( self::CATEGORIES as $slug => $category ) {
            if ( ! term_exists( $slug, self::TAXONOMY ) ) {
                wp_insert_term(
                    $category['name'],
                    self::TAXONOMY,
                    array(
                        'slug' => $slug,
                        'description' => $category['name'],
                    )
                );
            }
        }
    }
    
    /**
     * Получить все категории с метаданными
     */
    public static function get_categories_with_meta() {
        $categories = get_terms( array(
            'taxonomy'   => self::TAXONOMY,
            'hide_empty' => false,
        ) );
        
        $result = array();
        
        foreach ( $categories as $cat ) {
            $slug = $cat->slug;
            $meta = isset( self::CATEGORIES[$slug] ) ? self::CATEGORIES[$slug] : array(
                'icon'  => 'dashicons-location',
                'color' => '#95a5a6',
            );
            
            $result[] = array(
                'term_id'   => $cat->term_id,
                'name'      => $cat->name,
                'slug'      => $cat->slug,
                'icon'      => $meta['icon'],
                'color'     => $meta['color'],
                'count'     => $cat->count,
            );
        }
        
        return $result;
    }
}

// Регистрация при инициализации
add_action( 'init', array( 'KOLCHUGINO_MAP_Taxonomy', 'register' ) );

// Создание категорий при активации
add_action( 'kolchugino_map_activate', array( 'KOLCHUGINO_MAP_Taxonomy', 'create_default_categories' ) );
