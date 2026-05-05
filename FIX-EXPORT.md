# Исправление экспорта GeoJSON

## Проблема

Экспорт GeoJSON не работал и возвращал ошибку 400 от WordPress. Причина была в неправильном заголовке `Content-Disposition` для файлов с Unicode-названиями.

## Решение

### 1. Исправлен заголовок Content-Disposition

**Было:**
```php
header( 'Content-Disposition: attachment; filename="kolchugino_poi_' . date( 'Y-m-d_H-i-s' ) . '.geojson"' );
```

**Стало:**
```php
$filename = 'kolchugino_poi_' . date( 'Y-m-d_H-i-s' ) . '.geojson';
$filename_utf8 = 'kolchugino_poi_' . date( 'Y-m-d_H-i-s' ) . '.geojson';

header( 'Content-Type: application/json' );
header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
header( 'Content-Disposition: attachment; filename*=UTF-8\'\'' . rawurlencode( $filename_utf8 ) );
header( 'X-Robots-Tag: noindex, nofollow' );
header( 'Cache-Control: no-cache, no-store, must-revalidate' );
header( 'Pragma: no-cache' );
header( 'Expires: 0' );
```

### 2. Добавлена проверка nonce

Добавлена проверка nonce для защиты экспорта:
```php
if ( ! isset( $_GET['nonce'] ) || ! wp_verify_nonce( $_GET['nonce'], 'kolchugino_export' ) ) {
    wp_die( 'Недопустимый запрос' );
}
```

### 3. Исправлены мета-ключи

Мета-ключи были изменены с `map_` на `_map_` для соответствия использованию в плагине:
```php
// Было
$lat = get_post_meta( $post->ID, 'map_lat', true );
$lng = get_post_meta( $post->ID, 'map_lng', true );

// Стало
$lat = get_post_meta( $post->ID, '_map_lat', true );
$lng = get_post_meta( $post->ID, '_map_lng', true );
```

### 4. Добавлена проверка метода запроса

Добавлена проверка, что экспорт работает только через GET-запрос:
```php
if ( ! isset( $_GET['kolchugino_export'] ) || $_SERVER['REQUEST_METHOD'] !== 'GET' ) {
    return;
}
```

### 5. Добавлено отладочное логирование

Добавлено подробное логирование для диагностики:
```php
if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
    error_log( '[Kolchugino Map Export] ===== EXPORTING GEOJSON =====' );
    error_log( '[Kolchugino Map Export] User capability: ' . ( current_user_can( 'manage_options' ) ? 'yes' : 'no' ) );
    error_log( '[Kolchugino Map Export] Nonce: ' . ( isset( $_GET['nonce'] ) ? 'present' : 'missing' ) );
    if ( isset( $_GET['nonce'] ) ) {
        error_log( '[Kolchugino Map Export] Nonce verification: ' . ( wp_verify_nonce( $_GET['nonce'], 'kolchugino_export' ) ? 'success' : 'failed' ) );
    }
}
```

## Тестирование

### HTML-тестер

Создан файл `test-export.html` для тестирования экспорта:
- Тест GET-запроса с nonce
- Тест AJAX-запроса
- Информация о сервере

Доступ к тесту: `http://your-site/wp-content/plugins/kolchugino-map-plugin/test-export.html`

### PHP-тестер

Создан файл `test-export.php` для прямого тестирования экспорта:
```php
// Создает тестовый GET-запрос с nonce
// Вызывает обработчик экспорта
```

Доступ к тесту: `http://your-site/wp-content/plugins/kolchugino-map-plugin/test-export.php`

## Как использовать

1. Перейдите в админку WordPress
2. Нажмите на "Туристическая карта" → "Импорт и экспорт"
3. Нажмите кнопку "Экспорт GeoJSON"
4. Файл должен скачать автоматически

## Логирование

При включенном WP_DEBUG в файле error.log будут появляться сообщения:
```
[Kolchugino Map Export] ===== EXPORTING GEOJSON =====
[Kolchugino Map Export] User capability: yes
[Kolchugino Map Export] Nonce: present
[Kolchugino Map Export] Nonce verification: success
```

## Файлы, измененные

- `includes/class-export.php` - основные исправления
- `kolchugino-map.php` - не изменялся
- `assets/js/map-admin.js` - не изменялся

## Файлы, созданные для тестирования

- `test-export.html` - HTML-тестер
- `test-export.php` - PHP-тестер
- `FIX-EXPORT.md` - этот документ
