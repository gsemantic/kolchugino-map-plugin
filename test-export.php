<?php
/**
 * Тестовый скрипт для проверки экспорта GeoJSON
 * Запускать через браузер: http://localhost:8080/wp-content/plugins/kolchugino-map-plugin/test-export.php
 */

define( 'WP_USE_THEMES', false );
require_once __DIR__ . '/kolchugino-map.php';

// Имитация GET-запроса с nonce
$_GET['kolchugino_export'] = 'geojson';
$_GET['nonce'] = wp_create_nonce( 'kolchugino_export' );

// Вызываем обработчик
KOLCHUGINO_MAP_Export::handle_export_requests();
