<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KOLCHUGINO_MAP_Settings {
	public static function init() {
		// Добавляем в меню плагина, а не в общие настройки
		add_action( 'admin_menu', array( __CLASS__, 'add_settings_page' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
	}

	public static function add_settings_page() {
		// Перемещаем настройки в меню плагина (edit.php?post_type=map_object)
		add_submenu_page(
			'edit.php?post_type=map_object', // Родительский слаг меню
			__( 'Настройки карты Кольчугино', 'kolchugino-map' ),
			__( 'Настройки', 'kolchugino-map' ),
			'manage_options',
			'kolchugino-map-settings',
			array( __CLASS__, 'render_settings_page' )
		);
	}

	public static function register_settings() {
		register_setting(
			'kolchugino_map_settings_group',
			'kolchugino_map_default_zoom',
			array(
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'default'           => 13
			)
		);
		register_setting(
			'kolchugino_map_settings_group',
			'kolchugino_map_center_lat',
			array(
				'type'              => 'float',
				'sanitize_callback' => 'floatval',
				'default'           => 56.294425
			)
		);
		register_setting(
			'kolchugino_map_settings_group',
			'kolchugino_map_center_lng',
			array(
				'type'              => 'float',
				'sanitize_callback' => 'floatval',
				'default'           => 39.375751
			)
		);
		register_setting(
			'kolchugino_map_settings_group',
			'kolchugino_map_offline_tiles_url',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'esc_url_raw',
				'default'           => ''
			)
		);
		register_setting(
			'kolchugino_map_settings_group',
			'kolchugino_map_offline_min_zoom',
			array(
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'default'           => 10
			)
		);
		register_setting(
			'kolchugino_map_settings_group',
			'kolchugino_map_offline_max_zoom',
			array(
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'default'           => 14
			)
		);
	}

	public static function get_default_zoom() {
		// Принудительно получаем свежее значение из базы
		$zoom = get_option('kolchugino_map_default_zoom', 13);
		
		// Дополнительно проверяем через wp_load_alloptions() на случай кэша
		$all_options = wp_load_alloptions();
		if (isset($all_options['kolchugino_map_default_zoom'])) {
			$zoom = $all_options['kolchugino_map_default_zoom'];
		}
		
		kolchugino_log()->info( 'Retrieved default_zoom', array( 'value' => (int)$zoom ) );
		return (int) $zoom;
	}

	public static function get_center() {
		$center = array(
			'lat' => (float) get_option( 'kolchugino_map_center_lat', 56.294425 ),
			'lng' => (float) get_option( 'kolchugino_map_center_lng', 39.375751 )
		);
		kolchugino_log()->info( 'Retrieved center', array( 'center' => $center ) );
		return $center;
	}

	public static function get_offline_tiles_url() {
		$url = get_option( 'kolchugino_map_offline_tiles_url', '' );
		kolchugino_log()->info( 'Retrieved offline tiles URL', array( 'url' => $url ) );
		return $url;
	}

	public static function get_offline_min_zoom() {
		$zoom = get_option( 'kolchugino_map_offline_min_zoom', 10 );
		kolchugino_log()->info( 'Retrieved offline min zoom', array( 'value' => (int)$zoom ) );
		return (int) $zoom;
	}

	public static function get_offline_max_zoom() {
		$zoom = get_option( 'kolchugino_map_offline_max_zoom', 14 );
		kolchugino_log()->info( 'Retrieved offline max zoom', array( 'value' => (int)$zoom ) );
		return (int) $zoom;
	}

	public static function render_settings_page() {
		?>
		<div class="wrap">
			<h1><?php _e( 'Настройки карты Кольчугино', 'kolchugino-map' ); ?></h1>
			<form method="post" action="options.php">
				<?php settings_fields( 'kolchugino_map_settings_group' ); ?>
				<table class="form-table">
					<tr>
						<th scope="row">
							<label for="kolchugino_map_default_zoom"><?php _e( 'Масштаб по умолчанию', 'kolchugino-map' ); ?></label>
						</th>
						<td>
							<input type="number"
								id="kolchugino_map_default_zoom"
								name="kolchugino_map_default_zoom"
								value="<?php echo esc_attr( self::get_default_zoom() ); ?>"
								step="1"
								min="1"
								max="19" />
							<p class="description">
								<?php _e( 'Уровень зума при загрузке карты (от 1 (мир) до 19 (здания)).', 'kolchugino-map' ); ?>
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php _e( 'Центр карты', 'kolchugino-map' ); ?></th>
						<td>
							<label for="kolchugino_map_center_lat">Широта:</label>
							<input type="number" step="any"
								id="kolchugino_map_center_lat"
								name="kolchugino_map_center_lat"
								value="<?php echo esc_attr( self::get_center()['lat'] ); ?>"
								class="regular-text" />
							<br />
							<label for="kolchugino_map_center_lng">Долгота:</label>
							<input type="number" step="any"
								id="kolchugino_map_center_lng"
								name="kolchugino_map_center_lng"
								value="<?php echo esc_attr( self::get_center()['lng'] ); ?>"
								class="regular-text" />
						</td>
					</tr>
					<tr>
						<th scope="row" colspan="2">
							<h2 style="margin-top: 20px;"><?php _e( 'Настройки оффлайн-режима', 'kolchugino-map' ); ?></h2>
						</th>
					</tr>
					<tr>
						<th scope="row">
							<label for="kolchugino_map_offline_tiles_url"><?php _e( 'URL оффлайн-тайлов', 'kolchugino-map' ); ?></label>
						</th>
						<td>
							<input type="url"
								id="kolchugino_map_offline_tiles_url"
								name="kolchugino_map_offline_tiles_url"
								value="<?php echo esc_attr( self::get_offline_tiles_url() ); ?>"
								class="regular-text"
								placeholder="https://username.github.io/repo/offline-tiles/" />
							<p class="description">
								<?php _e( 'URL для загрузки тайлов в оффлайн-режиме. Оставьте пустым для использования OSM.', 'kolchugino-map' ); ?>
								<br />
								<strong><?php _e( 'Пример:', 'kolchugino-map' ); ?></strong> 
								<code>https://yourusername.github.io/kolchugino-map/offline-tiles/</code>
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row">
							<label for="kolchugino_map_offline_min_zoom"><?php _e( 'Минимальный зум', 'kolchugino-map' ); ?></label>
						</th>
						<td>
							<input type="number"
								id="kolchugino_map_offline_min_zoom"
								name="kolchugino_map_offline_min_zoom"
								value="<?php echo esc_attr( self::get_offline_min_zoom() ); ?>"
								step="1"
								min="1"
								max="18" />
							<p class="description">
								<?php _e( 'Минимальный уровень масштабирования для оффлайн-тайлов (рекомендуется 10).', 'kolchugino-map' ); ?>
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row">
							<label for="kolchugino_map_offline_max_zoom"><?php _e( 'Максимальный зум', 'kolchugino-map' ); ?></label>
						</th>
						<td>
							<input type="number"
								id="kolchugino_map_offline_max_zoom"
								name="kolchugino_map_offline_max_zoom"
								value="<?php echo esc_attr( self::get_offline_max_zoom() ); ?>"
								step="1"
								min="1"
								max="19" />
							<p class="description">
								<?php _e( 'Максимальный уровень масштабирования для оффлайн-тайлов (рекомендуется 14).', 'kolchugino-map' ); ?>
							</p>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
			
			<div style="margin-top: 30px; padding: 20px; background: #f0f0f1; border-left: 4px solid #0073aa;">
				<h3><?php _e( 'Как сгенерировать тайлы', 'kolchugino-map' ); ?></h3>
				<ol>
					<li><?php _e( 'Перейдите во вкладку Actions на GitHub', 'kolchugino-map' ); ?></li>
					<li><?php _e( 'Выберите workflow "Generate Offline Map Tiles"', 'kolchugino-map' ); ?></li>
					<li><?php _e( 'Нажмите "Run workflow" и укажите параметры зума', 'kolchugino-map' ); ?></li>
					<li><?php _e( 'После генерации скопируйте URL из артефактов в поле выше', 'kolchugino-map' ); ?></li>
				</ol>
			</div>
		</div>
		<?php
	}
}