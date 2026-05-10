// assets/js/map-offline.js

// Подключение библиотеки Leaflet
L.Map.addInitHook(function () {
    this.whenReady(function () {
        // Добавляем кастомный класс для отключения прокрутки
        document.querySelector('.map-container').classList.add('map-initialized');
    });
});

// Загрузка данных из kolchugino-map-data
var kolchuginoMapData = window.kolchuginoMapData;

if (!kolchuginoMapData) {
    console.error("Данные карты не найдены. Проверьте, загружен ли файл kolchugino-map-data.js.");
    throw new Error("Отсутствуют данные карты");
}

// Режим тайлов: 'vector' или 'raster'
var tileMode = 'vector'; // Фиксируем векторный режим

// Конфигурация карты
var mapConfig = {
    center: [56.1477, 43.5959], // Центр по умолчанию
    zoom: 12,
    minZoom: 12, // Минимальный зум теперь фиксирован на 12
    maxZoom: 18,
    zoomControl: false, // Отключаем стандартный контрол зума
    attributionControl: false, // Отключаем атрибуцию
    preferCanvas: true,
    maxBounds: [
        [55.9, 43.3],
        [56.4, 43.9]
    ],
    worldCopyJump: false,
    crs: L.CRS.EPSG3857
};

// Инициализация карты
var map = L.map('map', mapConfig);

// Контролы масштаба и зума
L.control.zoom({
    position: 'bottomright',
    zoomInTitle: 'Приблизить',
    zoomOutTitle: 'Отдалить'
}).addTo(map);

// Функция создания базового слоя (векторного)
function createBaseLayer() {
    return L.tileLayer('./tiles/{z}/{x}/{y}.pbf', {
        minZoom: 12, // Устанавливаем фиксированный minZoom
        maxZoom: 18,
        tileSize: 256,
        zoomOffset: 0,
        tms: false,
        bounds: [
            [55.9, 43.3],
            [56.4, 43.9]
        ],
        className: 'vector-tile-layer',
        // Стиль для векторных тайлов
        vectorTileLayerStyles: {
            default: function(properties, zoom) {
                return {
                    fillColor: '#f0f0f0',
                    weight: 1,
                    opacity: 0.5,
                    color: '#666',
                    fillOpacity: 0.3
                };
            }
        },
        // Загрузка векторных данных
        getFeatureId: function(feature) {
            return feature.properties.id;
        }
    });
}

// Создание базового слоя
var baseLayer = createBaseLayer();

// Добавление базового слоя на карту
baseLayer.addTo(map);

// Функция обновления URL при изменении зума/центра
function updateURL() {
    var center = map.getCenter();
    var zoom = map.getZoom();
    var url = new URL(window.location);
    url.searchParams.set('center', `${center.lat.toFixed(4)},${center.lng.toFixed(4)}`);
    url.searchParams.set('zoom', zoom);
    window.history.replaceState({}, '', url);
}

// Обработчики событий карты
map.on('moveend', updateURL);
map.on('zoomend', updateURL);

// Иконка локации
var locationIcon = L.icon({
    iconUrl: './assets/icons/location-icon.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Маркеры
var markers = [];

// Добавление маркеров
if (kolchuginoMapData && Array.isArray(kolchuginoMapData.markers)) {
    kolchuginoMapData.markers.forEach(function(markerData) {
        var marker = L.marker([markerData.lat, markerData.lng], {icon: locationIcon})
            .bindPopup(`<b>${markerData.title}</b><br>${markerData.description}`)
            .openPopup();
        markers.push(marker);
        marker.addTo(map);
    });
}

// Масштабная линейка
L.control.scale({imperial: false, maxWidth: 200}).addTo(map);

// Обработчик кнопки "Мое местоположение"
document.getElementById('locate-btn').addEventListener('click', function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                var userLocation = [position.coords.latitude, position.coords.longitude];
                map.setView(userLocation, 15);
                var userMarker = L.marker(userLocation, {icon: locationIcon}).addTo(map);
                setTimeout(() => userMarker.remove(), 5000); // Удаляем метку через 5 секунд
            },
            function(error) {
                alert("Не удалось получить ваше местоположение: " + error.message);
            }
        );
    } else {
        alert("Геолокация не поддерживается вашим браузером.");
    }
});

// Обработчик кнопки "Сбросить вид"
document.getElementById('reset-view-btn').addEventListener('click', function() {
    map.setView([56.1477, 43.5959], 12);
});

// Обработчик кнопки "Переключить режим тайлов"
document.getElementById('tile-mode-btn').addEventListener('click', switchTileMode);

// Функция переключения режима тайлов
function switchTileMode() {
    console.log("Переключение режима тайлов отключено. Используется только векторный режим.");
    // Блокируем переключение, оставляем только векторный режим
}

// Загрузка сохраненного состояния карты из localStorage
window.addEventListener('load', function() {
    try {
        var savedState = localStorage.getItem('kolchuginoMapState');
        if (savedState) {
            var state = JSON.parse(savedState);
            if (state.center && state.zoom) {
                map.setView(state.center, state.zoom);
            }
        }
    } catch (e) {
        console.warn("Не удалось восстановить состояние карты из localStorage:", e);
    }
});

// Сохранение состояния карты при закрытии страницы
window.addEventListener('beforeunload', function() {
    try {
        var state = {
            center: map.getCenter(),
            zoom: map.getZoom()
        };
        localStorage.setItem('kolchuginoMapState', JSON.stringify(state));
    } catch (e) {
        console.warn("Не удалось сохранить состояние карты в localStorage:", e);
    }
});

// Инициализация начального вида карты из URL параметров
window.addEventListener('load', function() {
    try {
        var url = new URL(window.location);
        var centerParam = url.searchParams.get('center');
        var zoomParam = url.searchParams.get('zoom');

        if (centerParam && zoomParam) {
            var centerParts = centerParam.split(',');
            if (centerParts.length === 2) {
                var lat = parseFloat(centerParts[0]);
                var lng = parseFloat(centerParts[1]);
                var zoom = parseInt(zoomParam);

                if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom)) {
                    map.setView([lat, lng], zoom);
                }
            }
        }
    } catch (e) {
        console.warn("Ошибка при чтении параметров из URL:", e);
    }
});

// Отключение прокрутки страницы при наведении на карту
document.querySelector('.map-container').addEventListener('wheel', function(e) {
    if (document.querySelector('.map-initialized')) {
        e.preventDefault();
        var delta = e.deltaY * (-1/100);
        var zoomChange = Math.sign(delta) * Math.min(Math.abs(delta), 0.5);
        map.setZoom(map.getZoom() + zoomChange);
    }
}, { passive: false });
