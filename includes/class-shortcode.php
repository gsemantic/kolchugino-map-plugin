<?php
/**
* Шорткод для отображения карты
*/
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KOLCHUGINO_MAP_Shortcode {
	public static function init() {
		add_shortcode( 'kolchugino_map', array( __CLASS__, 'render_map' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_frontend_scripts' ) );
	}

	public static function enqueue_frontend_scripts() {
		// Подключаем стили и JS OpenLayers только на страницах, где есть шорткод
		global $post;
		if ( is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'kolchugino_map' ) ) {
			// Подключаем OpenLayers CSS
			wp_enqueue_style( 'openlayers-css', KOLCHUGINO_MAP_PLUGIN_URL . 'assets/vendor/openlayers/ol.css', array(), '10.3.1' );
			// Подключаем OpenLayers JS
			wp_enqueue_script( 'openlayers-js', KOLCHUGINO_MAP_PLUGIN_URL . 'assets/vendor/openlayers/ol.js', array(), '10.3.1', true );
			
			// Определяем, какой JS подключать: map-offline.js или map.js
			$offline_tiles_url = KOLCHUGINO_MAP_Settings::get_offline_tiles_url();
			$use_offline = !empty( $offline_tiles_url );
			
			$js_file = $use_offline ? 'map-offline.js' : 'map.js';
			
			// Подключаем соответствующий JS карты
			wp_enqueue_script(
				'kolchugino-map-js',
				KOLCHUGINO_MAP_PLUGIN_URL . 'assets/js/' . $js_file,
				array( 'jquery', 'openlayers-js' ),
				KOLCHUGINO_MAP_VERSION,
				true
			);
			// Передаем данные в JavaScript
			wp_localize_script(
				'kolchugino-map-js',
				'kolchuginoMapData',
				array(
					'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
					'nonce'       => wp_create_nonce( 'kolchugino_map_nonce' ),
					'centerLat'   => KOLCHUGINO_MAP_Settings::get_center()['lat'],
					'centerLng'   => KOLCHUGINO_MAP_Settings::get_center()['lng'],
					'defaultZoom' => KOLCHUGINO_MAP_Settings::get_default_zoom(),
					'tilesUrl'    => $offline_tiles_url,
					'minZoom'     => KOLCHUGINO_MAP_Settings::get_offline_min_zoom(),
					'maxZoom'     => KOLCHUGINO_MAP_Settings::get_offline_max_zoom(),
					'i18n'        => array(
						'error'      => __( 'Произошла ошибка при загрузке карты', 'kolchugino-map' ),
						'noResults'  => __( 'Объекты не найдены', 'kolchugino-map' ),
						'offlineOn'  => __( 'Оффлайн режим включен', 'kolchugino-map' ),
						'offlineOff' => __( 'Оффлайн режим выключен', 'kolchugino-map' ),
						'noTiles'    => __( 'Тайлы оффлайн-режима не настроены', 'kolchugino-map' ),
					),
					'version'     => KOLCHUGINO_MAP_VERSION
				)
			);
			// Подключаем стили карты
			wp_enqueue_style(
				'kolchugino-map-css',
				KOLCHUGINO_MAP_PLUGIN_URL . 'assets/css/map.css',
				array(),
				KOLCHUGINO_MAP_VERSION
			);
		}
	}

	/**
	* Рендер шорткода карты
	*
	* Использование: [kolchugino_map height="600" show_filters="true" show_search="true"]
	*/
	public static function render_map( $atts = array() ) {
		// Явное приведение к массиву защищает от PHP 8+ Warning: Trying to access array offset on value of type null
		$atts = shortcode_atts( array(
			'height'       => '600',
			'show_filters' => 'true',
			'show_search'  => 'true',
			'show_print'   => 'true',
			'show_offline' => 'true',
			'category'     => '',
		), (array) $atts, 'kolchugino_map' );

		ob_start();
		?>
		<div id="kolchugino-map-container" class="kolchugino-map-wrapper" data-height="<?php echo esc_attr( $atts['height'] ); ?>">
			<!-- Панель управления -->
			<div class="kolchugino-map-controls">
				<?php if ( filter_var( $atts['show_search'], FILTER_VALIDATE_BOOLEAN ) ) : ?>
				<div class="kolchugino-map-search">
					<input type="text"
						id="kolchugino-map-search-input"
						placeholder="<?php _e( 'Поиск объектов...', 'kolchugino-map' ); ?>"
						class="kolchugino-search-input" />
					<button type="button" id="kolchugino-map-search-btn" class="kolchugino-search-btn">
						<span class="dashicons dashicons-search"></span>
					</button>
				</div>
				<?php endif; ?>

				<?php if ( filter_var( $atts['show_filters'], FILTER_VALIDATE_BOOLEAN ) ) : ?>
				<div class="kolchugino-map-filters">
					<!-- Категории будут загружены через JS -->
					<div id="kolchugino-map-filters-container"></div>
				</div>
				<?php endif; ?>

				<div class="kolchugino-map-actions">
					<?php if ( filter_var( $atts['show_print'], FILTER_VALIDATE_BOOLEAN ) ) : ?>
					<button type="button"
						id="kolchugino-map-print-btn"
						class="kolchugino-action-btn"
						title="<?php _e( 'Версия для печати', 'kolchugino-map' ); ?>">
						<span class="dashicons dashicons-printer"></span>
					</button>
					<?php endif; ?>

					<?php if ( filter_var( $atts['show_offline'], FILTER_VALIDATE_BOOLEAN ) ) : ?>
					<button type="button"
						id="kolchugino-map-offline-btn"
						class="kolchugino-action-btn"
						title="<?php _e( 'Оффлайн режим', 'kolchugino-map' ); ?>">
						<span class="dashicons dashicons-download"></span>
					</button>
					<button type="button"
						id="kolchugino-map-tilemode-btn"
						class="kolchugino-action-btn"
						title="<?php _e( 'Режим тайлов: векторный (PBF)', 'kolchugino-map' ); ?>">
						<span class="dashicons dashicons-admin-site"></span>
					</button>
					<?php endif; ?>
				</div>
			</div>

			<!-- Контейнер карты -->
			<div id="kolchugino-map" style="height: <?php echo esc_attr( $atts['height'] ); ?>px;">
				<!-- Popup контейнер (OpenLayers) -->
				<div id="kolchugino-popup-container" class="ol-popup"></div>
			</div>

			<!-- Легенда -->
			<div id="kolchugino-map-legend" class="kolchugino-map-legend">
				<h4><?php _e( 'Легенда', 'kolchugino-map' ); ?></h4>
				<div id="kolchugino-map-legend-container"></div>
			</div>

			<!-- Индикатор загрузки -->
			<div id="kolchugino-map-loader" class="kolchugino-map-loader">
				<div class="kolchugino-loader-spinner"></div>
				<p><?php _e( 'Загрузка карты...', 'kolchugino-map' ); ?></p>
			</div>
		</div>
		<?php
		return ob_get_clean();
	}
}

// Инициализация
KOLCHUGINO_MAP_Shortcode::init();
