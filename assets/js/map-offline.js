/**
 * JavaScript для интерактивной карты Кольчугино — OpenLayers
 */

(function() {
    'use strict';

    var map = null;
    var vectorSource = null;
    var vectorLayer = null;
    var allObjects = [];
    var currentFilter = 'all';
    var tileLayer = null;
    var isOffline = true;
    var popup = null;

    // Цвета категорий
    var CATEGORY_COLORS = {
        'attraction': '#e74c3c',
        'cafe': '#f39c12',
        'hotel': '#9b59b6',
        'shop': '#3498db',
        'pharmacy': '#2ecc71',
        'gas_station': '#34495e',
        'healthcare': '#e74c3c',
        'education': '#1abc9c',
        'culture': '#e67e22',
        'historic': '#c0392b',
        'services': '#7f8c8d',
        'leisure': '#27ae60',
        'marketplace': '#f1c40f',
        'religion': '#8e44ad',
        'other': '#95a5a6'
    };

    /**
     * Инициализация карты
     */
    function initMap() {
        if (typeof ol === 'undefined') {
            console.error('OpenLayers не загружен');
            return;
        }

        var hasTiles = kolchuginoMapData.tilesUrl && kolchuginoMapData.tilesUrl.length > 0;

        console.log('[map] hasTiles:', hasTiles, 'tilesUrl:', kolchuginoMapData.tilesUrl);
        console.log('[map] minZoom:', kolchuginoMapData.minZoom, 'maxZoom:', kolchuginoMapData.maxZoom);
        console.log('[map] defaultZoom:', kolchuginoMapData.defaultZoom);

        var tileSource;
        if (hasTiles) {
            tileSource = new ol.source.XYZ({
                url: kolchuginoMapData.tilesUrl + '{z}/{x}/{y}.png',
                minZoom: kolchuginoMapData.minZoom || 12,
                maxZoom: kolchuginoMapData.maxZoom || 15
            });
            console.log('[map] Tile URL:', tileSource.getUrls ? tileSource.getUrls() : 'N/A');
        } else {
            tileSource = new ol.source.OSM();
            console.log('[map] Using OSM tiles (no local tiles)');
        }

        // Offline tile слой - внизу (zIndex: 0)
        tileLayer = new ol.layer.Tile({
            source: tileSource,
            zIndex: 0
        });
        console.log('[map] Tile layer created, zIndex:', tileLayer.getZIndex());

        // Векторный слой для маркеров (будет сверху тайлов)
        vectorSource = new ol.source.Vector();
        vectorLayer = new ol.layer.Vector({
            source: vectorSource,
            style: function(feature) {
                return createMarkerIcon(feature.get('kolchuginoData'));
            },
            zIndex: 1000 // Явно указываем z-index для векторного слоя
        });

        // Создаём карту с обоими слоями
        var viewConfig = {
            center: ol.proj.fromLonLat([
                kolchuginoMapData.centerLng,
                kolchuginoMapData.centerLat
            ]),
            zoom: parseInt(kolchuginoMapData.defaultZoom) || 13,
            minZoom: parseInt(kolchuginoMapData.minZoom) || 12,
            maxZoom: parseInt(kolchuginoMapData.maxZoom) || 15
        };

        map = new ol.Map({
            target: 'kolchugino-map',
            layers: [tileLayer, vectorLayer],
            view: new ol.View(viewConfig),
            controls: ol.control.defaults.defaults().extend([
                new ol.control.ScaleLine({
                    units: 'metric',
                    bar: true,
                    steps: 4,
                    text: true
                })
            ])
        });

        // Отладка: проверяем слои после создания
        console.log('[map] Map created, layers count:', map.getLayers().getLength());
        console.log('[map] Layer 0:', map.getLayers().item(0).get('type') || 'tile');
        console.log('[map] View zoom:', map.getView().getZoom(), 'min:', map.getView().getMinZoom(), 'max:', map.getView().getMaxZoom());
        
        // Диагностика View после создания
        console.log('[map] View after creation:');
        console.log('  zoom:', map.getView().getZoom());
        console.log('  minZoom:', map.getView().getMinZoom());
        console.log('  maxZoom:', map.getView().getMaxZoom());
        console.log('  zoom type:', typeof map.getView().getZoom());
        console.log('  minZoom type:', typeof map.getView().getMinZoom());
        console.log('  maxZoom type:', typeof map.getView().getMaxZoom());

        // Добавляем слушатель загрузки тайлов
        tileSource.on('tileloadstart', function(e) {
            console.log('[map] Tile load start:', e.tile.src_);
        });
        tileSource.on('tileloadend', function(e) {
            console.log('[map] Tile load end:', e.tile.src_);
        });
        tileSource.on('tileloaderror', function(e) {
            console.error('[map] Tile load error:', e.tile.src_);
        });

        // Popup (overlay)
        var popupContainer = document.getElementById('kolchugino-popup-container');
        var popupCloser = document.getElementById('kolchugino-popup-closer');

        popup = new ol.Overlay({
            element: popupContainer,
            positioning: 'bottom-center',
            stopEvent: false,
            offset: [0, -10]
        });
        map.addOverlay(popup);

        if (popupCloser) {
            popupCloser.onclick = function() {
                popup.setPosition(undefined);
                popupCloser.blur();
                return false;
            };
        }

        // Клик по маркеру — показ popup
        map.on('singleclick', function(evt) {
            var feature = map.forEachFeatureAtPixel(evt.pixel, function(f) {
                return f;
            });

            if (feature) {
                var data = feature.get('kolchuginoData');
                if (data) {
                    showPopup(data, feature.getGeometry().getCoordinates());
                }
            } else {
                popup.setPosition(undefined);
            }
        });

        // Курсор при наведении
        map.on('pointermove', function(evt) {
            var hit = map.hasFeatureAtPixel(evt.pixel);
            map.getTargetElement().style.cursor = hit ? 'pointer' : '';
        });

        // Загрузка данных
        loadObjects();
    }

    /**
     * Создание иконки маркера
     */
    function createMarkerIcon(data) {
        var color = '#95a5a6';
        
        // Определяем цвет по категории
        if (data.categories && data.categories.length > 0) {
            var cat = data.categories[0];
            color = CATEGORY_COLORS[cat] || '#95a5a6';
        }
        
        // Проверяем, есть ли кастомная иконка
        if (data.marker_icon && data.marker_icon !== 'circle') {
            // Создаем SVG иконку на основе данных
            var svgContent = createSvgIcon(data.marker_icon, color);
            
            return new ol.style.Style({
                image: new ol.style.Icon({
                    src: svgContent,
                    imgSize: [24, 24],
                    anchor: [0.5, 1],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction'
                })
            });
        } else {
            // Fallback: рисуем кружок с цветом категории или цветом маркера
            var markerColor = data.marker_color || color;
            
            return new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 12,
                    fill: new ol.style.Fill({color: markerColor}),
                    stroke: new ol.style.Stroke({color: '#fff', width: 2})
                })
            });
        }
    }
    
    /**
     * Создание SVG иконки
     */
    function createSvgIcon(iconType, color) {
        var svgContent = '';
        
        // Базовые SVG иконки
        switch(iconType) {
            case 'shop':
                svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="' + color + '"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>';
                break;
            case 'restaurant':
                svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="' + color + '"><path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/></svg>';
                break;
            case 'cafe':
                svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="' + color + '"><path d="M20 8h-3V6c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v3h7v-3h2v3h7v-3c0-1.1-.9-2-2-2zm-5 2H9V6h6v4z"/></svg>';
                break;
            default:
                // По умолчанию используем кружок
                svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="' + color + '"/></svg>';
        }
        
        // Возвращаем готовый data URI. OL сам создаст Image при необходимости.
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
    }

    /**
     * Показ popup
     */
    function showPopup(data, coords) {
        var container = document.getElementById('kolchugino-popup-container');
        if (!container) return;

        var html = '<div class="kolchugino-popup">';
        html += '<button id="kolchugino-popup-closer" class="popup-closer">&times;</button>';
        html += '<h3>' + escapeHtml(data.title) + '</h3>';

        // Добавляем миниатюру, если есть
        if (data.thumbnail) {
            html += '<img src="' + escapeHtml(data.thumbnail) + '" alt="' + escapeHtml(data.title) + '" class="popup-thumbnail">';
        }

        // Добавляем краткий excerpt, если есть
        if (data.excerpt) {
            html += '<div class="popup-excerpt">' + escapeHtml(data.excerpt) + '</div>';
        }

        html += '<div class="popup-meta">';
        if (data.address) html += '<div><strong>Адрес:</strong> ' + escapeHtml(data.address) + '</div>';
        if (data.phone) html += '<div><strong>Телефон:</strong> ' + escapeHtml(data.phone) + '</div>';
        if (data.opening_hours) html += '<div><strong>Часы работы:</strong> ' + escapeHtml(data.opening_hours) + '</div>';
        if (data.price) html += '<div><strong>Цены:</strong> ' + escapeHtml(data.price) + '</div>';
        html += '</div>';

        html += '<div class="popup-actions">';
        if (data.website) html += '<a href="' + escapeHtml(data.website) + '" target="_blank" class="popup-link">Веб-сайт</a>';
        if (data.permalink) html += '<a href="' + escapeHtml(data.permalink) + '" class="popup-link">Подробнее</a>';
        html += '</div>';
        html += '</div>';

        container.innerHTML = html;

        // Переназначаем обработчик закрытия
        var closer = document.getElementById('kolchugino-popup-closer');
        if (closer) {
            closer.onclick = function() {
                popup.setPosition(undefined);
                closer.blur();
                return false;
            };
        }

        popup.setPosition(coords);
    }

    /**
     * Переключение на онлайн тайлы OSM
     */
    function addOnlineTiles() {
        if (tileLayer) {
            map.removeLayer(tileLayer);
        }
        var onlineSource = new ol.source.OSM();
        tileLayer = new ol.layer.Tile({
            source: onlineSource,
            zIndex: 0
        });
        map.getLayers().insertAt(0, tileLayer);
        // Снимаем ограничение extent для онлайн режима, сохраняя текущий вид
        var currentCenter = map.getView().getCenter();
        var currentZoom = map.getView().getZoom();
        var newView = new ol.View({
            center: currentCenter,
            zoom: currentZoom,
            minZoom: 0,
            maxZoom: 19
        });
        map.setView(newView);
        isOffline = false;
    }

    /**
     * Переключение онлайн/оффлайн режима
     */
    function toggleTileMode() {
        if (isOffline) {
            console.log('[map] Switching to ONLINE tiles');
            addOnlineTiles();
        } else {
            console.log('[map] Switching to OFFLINE tiles, tilesUrl:', kolchuginoMapData.tilesUrl);
            map.removeLayer(tileLayer);
            var offlineSource = new ol.source.XYZ({
                url: kolchuginoMapData.tilesUrl + '{z}/{x}/{y}.png',
                minZoom: kolchuginoMapData.minZoom || 12,
                maxZoom: kolchuginoMapData.maxZoom || 15
            });
            tileLayer = new ol.layer.Tile({
                source: offlineSource,
                zIndex: 0
            });
            map.getLayers().insertAt(0, tileLayer);
            
            // ИСПРАВЛЕНИЕ: Обновляем View при возврате в оффлайн
            var currentCenter = map.getView().getCenter();
            var currentZoom = map.getView().getZoom();
            var newView = new ol.View({
                center: currentCenter,
                zoom: currentZoom,
                minZoom: parseInt(kolchuginoMapData.minZoom) || 12,
                maxZoom: parseInt(kolchuginoMapData.maxZoom) || 15
            });
            map.setView(newView);
            
            console.log('[map] Offline tile layer created, layers count:', map.getLayers().getLength());
            console.log('[map] View updated for offline mode:');
            console.log('  minZoom:', newView.getMinZoom());
            console.log('  maxZoom:', newView.getMaxZoom());
            
            offlineSource.on('tileloadstart', function(e) {
                console.log('[map] Offline tile load start:', e.tile.src_);
            });
            offlineSource.on('tileloadend', function(e) {
                console.log('[map] Offline tile load end:', e.tile.src_);
            });
            offlineSource.on('tileloaderror', function(e) {
                console.error('[map] Offline tile load error:', e.tile.src_);
            });
            isOffline = true;
        }
        updateOfflineButton();
    }

    /**
     * Обновление текста кнопки оффлайн режима
     */
    function updateOfflineButton() {
        var btn = document.getElementById('kolchugino-map-offline-btn');
        if (!btn) return;
        if (isOffline) {
            btn.setAttribute('title', 'Переключить на онлайн режим');
        } else {
            btn.setAttribute('title', 'Переключить на оффлайн режим');
        }
    }

    /**
     * Загрузка объектов из GeoJSON
     */
    function loadObjects() {
        showLoader();

        var xhr = new XMLHttpRequest();
        xhr.open('GET', kolchuginoMapData.poiUrl, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        allObjects = parseGeoJSON(data);
                        renderMarkers();
                    } catch(e) {
                        console.error('Ошибка загрузки GeoJSON:', e);
                        loadObjectsFromWP();
                    }
                } else {
                    console.error('HTTP ошибка при загрузке GeoJSON:', xhr.status);
                    loadObjectsFromWP();
                }
            }
        };
        xhr.send();
    }

    /**
     * Загрузка объектов через WordPress AJAX (фоллбэк)
     */
    function loadObjectsFromWP() {
        var data = new FormData();
        data.append('action', 'get_map_objects');
        data.append('nonce', kolchuginoMapData.nonce);
        data.append('category', currentFilter);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', kolchuginoMapData.ajaxUrl, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            allObjects = response.data.objects;
                            renderMarkers();
                        } else {
                            showError(kolchuginoMapData.i18n.error);
                        }
                    } catch(e) {
                        showError(kolchuginoMapData.i18n.error);
                    }
                } else {
                    showError(kolchuginoMapData.i18n.error);
                }
                hideLoader();
            }
        };
        xhr.send(data);
    }

    /**
     * Парсинг GeoJSON в формат объектов
     */
    function parseGeoJSON(data) {
        var objects = [];
        var features = data.features || [];

        features.forEach(function(feat, index) {
            var props = feat.properties || {};
            var coords = feat.geometry && feat.geometry.coordinates;

            if (!coords || coords.length !== 2) return;

            // Фильтрация по текущему фильтру
            if (currentFilter !== 'all' && props.category !== currentFilter) return;

            objects.push({
                id: props.osm_id || index,
                title: props.name || 'Без названия',
                description: props.description || '',
                content: props.description || '',
                lat: coords[1],
                lng: coords[0],
                address: props.address || '',
                phone: props.phone || '',
                website: props.website || '',
                email: '',
                opening_hours: props.opening_hours || '',
                price: '',
                featured: false,
                thumbnail: props.thumbnail || '',
                gallery: [],
                categories: [props.category || 'other'],
                permalink: '',
                marker_icon: props.marker_icon || 'circle',
                marker_color: props.marker_color || '',
                excerpt: props.excerpt || ''
            });
        });

        return objects;
    }

    /**
     * Отрисовка фильтров
     */
    function renderFilters() {
        var container = document.getElementById('kolchugino-map-filters-container');
        if (!container) return;
        container.innerHTML = '';

        var categories = [
            { slug: 'all', name: 'Все', icon: 'dashicons-admin-site-alt3', color: '#2271b1' },
            { slug: 'attraction', name: 'Достопримечательности', icon: 'dashicons-building', color: '#e74c3c' },
            { slug: 'cafe', name: 'Кафе и рестораны', icon: 'dashicons-admin-site', color: '#f39c12' },
            { slug: 'shop', name: 'Магазины', icon: 'dashicons-cart', color: '#3498db' },
            { slug: 'hotel', name: 'Гостиницы', icon: 'dashicons-admin-multisite', color: '#9b59b6' },
            { slug: 'pharmacy', name: 'Аптеки', icon: 'dashicons-pressthis', color: '#2ecc71' },
            { slug: 'gas_station', name: 'Заправки', icon: 'dashicons-car', color: '#34495e' },
            { slug: 'education', name: 'Образование', icon: 'dashicons-welcome-learn-more', color: '#1abc9c' },
            { slug: 'healthcare', name: 'Медицина', icon: 'dashicons-admin-users', color: '#e74c3c' },
            { slug: 'services', name: 'Услуги', icon: 'dashicons-admin-generic', color: '#7f8c8d' },
        ];

        var select = document.createElement('select');
        select.className = 'kolchugino-filter-select';

        categories.forEach(function(category) {
            var option = document.createElement('option');
            option.value = category.slug;
            option.textContent = category.name;
            if (category.slug === currentFilter) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', function() {
            currentFilter = this.value;
            renderMarkers();
        });

        container.appendChild(select);
    }

    /**
     * Отрисовка легенды
     */
    function renderLegend() {
        var container = document.getElementById('kolchugino-map-legend-container');
        if (!container) return;
        container.innerHTML = '';

        var categories = [
            { name: 'Достопримечательности', color: '#e74c3c' },
            { name: 'Кафе и рестораны', color: '#f39c12' },
            { name: 'Магазины', color: '#3498db' },
            { name: 'Гостиницы', color: '#9b59b6' },
            { name: 'Аптеки', color: '#2ecc71' },
            { name: 'Заправки', color: '#34495e' },
            { name: 'Образование', color: '#1abc9c' },
            { name: 'Медицина', color: '#e74c3c' },
            { name: 'Услуги', color: '#7f8c8d' },
            { name: 'Другое', color: '#95a5a6' },
        ];

        categories.forEach(function(category) {
            var item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = '<span class="legend-icon" style="background-color: ' + category.color + ';"></span>' + category.name;
            container.appendChild(item);
        });
    }

    /**
     * Отрисовка маркеров
     */
    function renderMarkers() {
        vectorSource.clear();

        if (allObjects.length === 0) {
            console.warn('Нет объектов для отображения');
            showNoResults();
            hideLoader();
            return;
        }

        var features = [];

        allObjects.forEach(function(obj) {
            if (!obj.lat || !obj.lng) return;

            var coords = ol.proj.fromLonLat([obj.lng, obj.lat]);
            var feature = new ol.Feature({
                geometry: new ol.geom.Point(coords),
                kolchuginoData: obj
            });

            features.push(feature);
        });

        vectorSource.addFeatures(features);

        // Автомасштабирование - получаем extent из векторного источника
        if (features.length > 0) {
            var sourceExtent = vectorSource.getExtent();
            if (sourceExtent && !ol.extent.isEmpty(sourceExtent)) {
                map.getView().fit(sourceExtent, {
                    padding: [50, 50, 50, 50],
                    duration: 500
                });
            }
        }

        hideLoader();
    }

    /**
     * Поиск
     */
    function performSearch() {
        var input = document.getElementById('kolchugino-map-search-input');
        var query = input ? input.value.toLowerCase().trim() : '';

        if (!query) {
            renderMarkers();
            return;
        }

        var filtered = allObjects.filter(function(obj) {
            return obj.title.toLowerCase().indexOf(query) !== -1 ||
                   (obj.description && obj.description.toLowerCase().indexOf(query) !== -1) ||
                   (obj.excerpt && obj.excerpt.toLowerCase().indexOf(query) !== -1) ||
                   (obj.address && obj.address.toLowerCase().indexOf(query) !== -1);
        });

        var prevFilter = currentFilter;
        currentFilter = 'all';
        allObjects = filtered;
        renderMarkers();
        currentFilter = prevFilter;

        if (filtered.length === 0) {
            showNoResults();
        }
    }

    /**
     * Инициализация обработчиков событий
     */
    function initEventHandlers() {
        // Поиск
        var searchBtn = document.getElementById('kolchugino-map-search-btn');
        var searchInput = document.getElementById('kolchugino-map-search-input');

        if (searchBtn) {
            searchBtn.addEventListener('click', performSearch);
        }
        if (searchInput) {
            searchInput.addEventListener('keypress', function(e) {
                if (e.which === 13) performSearch();
            });
        }

        // Печать
        var printBtn = document.getElementById('kolchugino-map-print-btn');
        if (printBtn) {
            printBtn.addEventListener('click', function() {
                window.print();
            });
        }

        // Оффлайн режим
        var offlineBtn = document.getElementById('kolchugino-map-offline-btn');
        if (offlineBtn) {
            offlineBtn.addEventListener('click', toggleTileMode);
        }
    }

    /**
     * Показать индикатор загрузки
     */
    function showLoader() {
        var loader = document.getElementById('kolchugino-map-loader');
        if (loader) loader.classList.add('active');
    }

    /**
     * Скрыть индикатор загрузки
     */
    function hideLoader() {
        var loader = document.getElementById('kolchugino-map-loader');
        if (loader) loader.classList.remove('active');
    }

    /**
     * Показать сообщение об ошибке
     */
    function showError(message) {
        console.error(message);
        hideLoader();
    }

    /**
     * Показать "ничего не найдено"
     */
    function showNoResults() {
        console.log(kolchuginoMapData.i18n.noResults);
        hideLoader();
    }

    /**
     * Экранирование HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Инициализация при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initMap();
            renderFilters();
            renderLegend();
            updateOfflineButton();
            initEventHandlers();
        });
    } else {
        initMap();
        renderFilters();
        renderLegend();
        updateOfflineButton();
        initEventHandlers();
    }

})();
