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
    var baseLayer = null;
    var isOffline = true;
    var popup = null;
    // Режим тайлов: 'vector' (PBF) или 'raster' (PNG). По умолчанию vector
    var tileMode = localStorage.getItem('kolchugino_tile_mode') || 'vector';

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

    // Стили для векторных тайлов (упрощённый стиль Mapbox GL)
    var vectorTileStyle = [
        // Фон (земля)
        new ol.style.Style({
            fill: new ol.style.Fill({ color: '#f8f4f0' })
        }),
        // Вода
        new ol.style.Style({
            fill: new ol.style.Fill({ color: '#aadaff' }),
            stroke: new ol.style.Stroke({ color: '#8cc9ff', width: 1 })
        }),
        // Леса и парки
        new ol.style.Style({
            fill: new ol.style.Fill({ color: '#d4edc4' })
        }),
        // Дороги
        new ol.style.Style({
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
        }),
        // Здания
        new ol.style.Style({
            fill: new ol.style.Fill({ color: '#d9d9d9' }),
            stroke: new ol.style.Stroke({ color: '#cccccc', width: 1 })
        }),
        // Границы
        new ol.style.Style({
            stroke: new ol.style.Stroke({ color: '#bd3c3c', width: 2, lineDash: [4, 2] })
        }),
        // Подписи населённых пунктов
        new ol.style.Style({
            text: new ol.style.Text({
                font: '12px "Noto Sans", sans-serif',
                fill: new ol.style.Fill({ color: '#333333' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
            })
        })
    ];

    /**
     * Создание стиля для векторных тайлов на основе слоя
     */
    function getVectorTileStyle(feature, resolution) {
        var type = feature.getGeometry().getType();
        var layer = feature.get('layer');

        // Вода
        if (layer === 'water' || feature.get('water') !== undefined) {
            return new ol.style.Style({
                fill: new ol.style.Fill({ color: '#aadaff' }),
                stroke: new ol.style.Stroke({ color: '#8cc9ff', width: 1 })
            });
        }

        // Леса
        if (layer === 'landuse' && (feature.get('class') === 'wood' || feature.get('class') === 'forest')) {
            return new ol.style.Style({
                fill: new ol.style.Fill({ color: '#d4edc4' })
            });
        }

        // Парки
        if (layer === 'landuse' && (feature.get('class') === 'park' || feature.get('class') === 'grass')) {
            return new ol.style.Style({
                fill: new ol.style.Fill({ color: '#e0f0d0' })
            });
        }

        // Здания
        if (layer === 'building' || type === 'Polygon') {
            return new ol.style.Style({
                fill: new ol.style.Fill({ color: '#e8e8e8' }),
                stroke: new ol.style.Stroke({ color: '#cccccc', width: 1 })
            });
        }

        // Дороги
        if (layer === 'transportation' || layer === 'roads') {
            var roadClass = feature.get('class') || '';
            var width = 2;
            var color = '#ffffff';

            if (roadClass === 'motorway' || roadClass === 'trunk') {
                width = 4;
                color = '#ffd700';
            } else if (roadClass === 'primary') {
                width = 3;
                color = '#ffaa00';
            } else if (roadClass === 'secondary') {
                width = 2.5;
                color = '#ffcc00';
            } else if (roadClass === 'tertiary') {
                width = 2;
                color = '#ffffff';
            } else if (roadClass === 'residential' || roadClass === 'service') {
                width = 1.5;
                color = '#eeeeee';
            }

            return new ol.style.Style({
                stroke: new ol.style.Stroke({ color: color, width: width })
            });
        }

        // Границы
        if (layer === 'boundaries' || feature.get('boundary') !== undefined) {
            var adminLevel = feature.get('admin_level') || '8';
            var width = adminLevel <= '4' ? 3 : 2;
            var color = adminLevel <= '4' ? '#bd3c3c' : '#999999';

            return new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: color,
                    width: width,
                    lineDash: adminLevel <= '4' ? null : [4, 2]
                })
            });
        }

        // Подписи (точки с именем)
        var name = feature.get('name');
        if (name && layer === 'places') {
            var fontSize = 12;
            if (feature.get('class') === 'city') fontSize = 16;
            else if (feature.get('class') === 'town') fontSize = 14;
            else if (feature.get('class') === 'village') fontSize = 12;
            else fontSize = 11;

            return new ol.style.Style({
                image: null,
                text: new ol.style.Text({
                    text: name,
                    font: fontSize + 'px "Noto Sans", sans-serif',
                    fill: new ol.style.Fill({ color: '#333333' }),
                    stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
                    offsetY: -5
                })
            });
        }

        // По умолчанию
        return new ol.style.Style({
            fill: new ol.style.Fill({ color: '#f8f4f0' }),
            stroke: new ol.style.Stroke({ color: '#cccccc', width: 1 })
        });
    }

    /**
     * Создание базового слоя (растр или вектор)
     */
    function createBaseLayer() {
        var hasTiles = kolchuginoMapData.tilesUrl && kolchuginoMapData.tilesUrl.length > 0;
        var minZoom = parseInt(kolchuginoMapData.minZoom) || 12;
        var maxZoom = parseInt(kolchuginoMapData.maxZoom) || 20;

        console.log('[map] Creating base layer, mode:', tileMode, 'hasTiles:', hasTiles);

        if (tileMode === 'vector' && hasTiles) {
            // Векторные тайлы PBF/MVT
            var vectorTileSource = new ol.source.VectorTile({
                format: new ol.format.MVT(),
                url: kolchuginoMapData.tilesUrl + '{z}/{x}/{y}.pbf',
                minZoom: minZoom,
                maxZoom: maxZoom,
                tileGrid: ol.tilegrid.createXYZ({
                    minZoom: minZoom,
                    maxZoom: maxZoom
                })
            });

            var vectorTileLayer = new ol.layer.VectorTile({
                source: vectorTileSource,
                style: getVectorTileStyle,
                zIndex: 0
            });

            console.log('[map] Vector tile layer created');
            return vectorTileLayer;
        } else {
            // Растровые тайлы PNG (или OSM если нет локальных)
            var rasterSource;
            if (hasTiles) {
                rasterSource = new ol.source.XYZ({
                    url: kolchuginoMapData.tilesUrl + '{z}/{x}/{y}.png',
                    minZoom: minZoom,
                    maxZoom: maxZoom
                });
                console.log('[map] Raster tile layer created (local PNG)');
            } else {
                rasterSource = new ol.source.OSM();
                console.log('[map] Using OSM raster tiles (no local tiles)');
            }

            var rasterTileLayer = new ol.layer.Tile({
                source: rasterSource,
                zIndex: 0
            });

            return rasterTileLayer;
        }
    }

    /**
     * Инициализация карты
     */
    function initMap() {
        if (typeof ol === 'undefined') {
            console.error('OpenLayers не загружен');
            return;
        }

        console.log('[map] tileMode:', tileMode);
        console.log('[map] minZoom:', kolchuginoMapData.minZoom, 'maxZoom:', kolchuginoMapData.maxZoom);
        console.log('[map] defaultZoom:', kolchuginoMapData.defaultZoom);

        // Создаём базовый слой в зависимости от режима
        baseLayer = createBaseLayer();

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
            maxZoom: parseInt(kolchuginoMapData.maxZoom) || 20
        };

        map = new ol.Map({
            target: 'kolchugino-map',
            layers: [baseLayer, vectorLayer],
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
        if (baseLayer) {
            map.removeLayer(baseLayer);
        }
        var onlineSource = new ol.source.OSM();
        baseLayer = new ol.layer.Tile({
            source: onlineSource,
            zIndex: 0
        });
        map.getLayers().insertAt(0, baseLayer);
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
     * Переключение между векторным и растровым режимом оффлайн-тайлов
     */
    function switchTileMode() {
        // Переключаем режим
        tileMode = tileMode === 'vector' ? 'raster' : 'vector';
        localStorage.setItem('kolchugino_tile_mode', tileMode);
        console.log('[map] Switched tile mode to:', tileMode);

        // Удаляем старый базовый слой
        if (baseLayer) {
            map.removeLayer(baseLayer);
        }

        // Создаём новый базовый слой
        baseLayer = createBaseLayer();
        map.getLayers().insertAt(0, baseLayer);

        updateTileModeButton();
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
            if (baseLayer) {
                map.removeLayer(baseLayer);
            }
            baseLayer = createBaseLayer();
            map.getLayers().insertAt(0, baseLayer);
            
            // Обновляем View при возврате в оффлайн
            var currentCenter = map.getView().getCenter();
            var currentZoom = map.getView().getZoom();
            var newView = new ol.View({
                center: currentCenter,
                zoom: currentZoom,
                minZoom: parseInt(kolchuginoMapData.minZoom) || 12,
                maxZoom: parseInt(kolchuginoMapData.maxZoom) || 20
            });
            map.setView(newView);
            
            console.log('[map] Offline tile layer created, layers count:', map.getLayers().getLength());
            console.log('[map] View updated for offline mode:');
            console.log('  minZoom:', newView.getMinZoom());
            console.log('  maxZoom:', newView.getMaxZoom());
            
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
     * Обновление текста кнопки переключения режима тайлов
     */
    function updateTileModeButton() {
        var btn = document.getElementById('kolchugino-map-tilemode-btn');
        if (!btn) return;
        if (tileMode === 'vector') {
            btn.setAttribute('title', 'Текущий режим: векторный (PBF). Нажмите для переключения на растровый (PNG)');
            btn.textContent = 'Вектор';
        } else {
            btn.setAttribute('title', 'Текущий режим: растровый (PNG). Нажмите для переключения на векторный (PBF)');
            btn.textContent = 'Растр';
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

        // Переключение режима тайлов (вектор/растр)
        var tileModeBtn = document.getElementById('kolchugino-map-tilemode-btn');
        if (tileModeBtn) {
            tileModeBtn.addEventListener('click', switchTileMode);
            updateTileModeButton();
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
            updateTileModeButton();
            initEventHandlers();
        });
    } else {
        initMap();
        renderFilters();
        renderLegend();
        updateOfflineButton();
        updateTileModeButton();
        initEventHandlers();
    }

})();
