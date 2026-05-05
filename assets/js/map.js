/**
 * JavaScript для интерактивной карты Кольчугино
 */

(function($) {
    'use strict';
    
    var map = null;
    var markersLayer = null;
    var allObjects = [];
    var allCategories = [];
    var currentFilter = 'all';
    var markers = [];
    
    /**
     * Конфигурация иконок маркеров
     */
    var markerIcons = {
        circle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#3399CC"/></svg>',
        star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#FFD700"/></svg>',
        pin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#E74C3C"/></svg>',
        house: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="#7F8C8D"/></svg>',
        shop: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M19 7h-3V6a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V10h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM9 6h6v1H9V6zm10 11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V10h2v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V10h2v7z" fill="#27AE60"/></svg>',
        pharmacy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="#E74C3C"/><path d="M12 11h2v2h-2zm0-4h2v2h-2z" fill="white"/></svg>',
        cafe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M20 8h-2.81c.43-.78.81-1.62.81-2.5 0-1.38-1.12-2.5-2.5-2.5-1.93 0-3.5 1.57-3.5 3.5 0 .88.38 1.72.81 2.5H8.19c.43-.78.81-1.62.81-2.5 0-1.38-1.12-2.5-2.5-2.5S4 4.12 4 5.5c0 .88.38 1.72.81 2.5H2v10h20V8zm-7-2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5S13 6.33 13 5.5zM5 5.5c0-.83.67-1.5 1.5-1.5S8 4.67 8 5.5 7.33 7 6.5 7 5 6.33 5 5.5zm13 10.5H6v-5h12v5z" fill="#8B4513"/></svg>',
        transport: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" fill="#2C3E50"/></svg>'
    };
    
    /**
     * Инициализация карты
     */
    function initMap() {
        if (typeof ol === 'undefined') {
            console.error('OpenLayers не загружен');
            return;
        }

        // Добавлено для диагностики
        console.log('Map Init Data (Frontend):', kolchuginoMapData);
        
        // Создание карты
        map = new ol.Map({
            target: 'kolchugino-map',
            layers: [
                new ol.layer.Tile({
                    source: new ol.source.OSM()
                })
            ],
            view: new ol.View({
                center: ol.proj.fromLonLat([kolchuginoMapData.centerLng, kolchuginoMapData.centerLat]),
                zoom: kolchuginoMapData.defaultZoom
            }),
            controls: ol.control.defaults.defaults({ attribution: false, rotate: false }).extend([
                new ol.control.ScaleLine({
                    units: 'metric',
                    bar: false,           // Простая линейка в одну строку
                    steps: 1,             // Один сегмент
                    text: false,          // Убираем текст над линейкой
                    minWidth: 80          // Минимальная ширина для компактности
                })
            ])
        });
        
        // Создание вектного слоя для маркеров
        markersLayer = new ol.layer.Vector({
            source: new ol.source.Vector(),
            style: function(feature) {
                return createMarkerIcon(feature.get('featureData') || feature.getProperties());
            }
        });
        
        map.addLayer(markersLayer);
        
        // Загрузка данных
        loadCategories();
        loadObjects();
        
        // Обработчики событий
        initEventHandlers();
        
        // Логика стабильного попапа с задержкой и возможностью взаимодействия
        var popupHoverTimeout;
        var popupLeaveTimeout;
        var currentOpenOverlay = null;

        // Создаем контейнер попапа программно, если его нет в HTML
        if (!document.getElementById('kolchugino-popup')) {
            var popupEl = document.createElement('div');
            popupEl.id = 'kolchugino-popup';
            popupEl.className = 'ol-popup';
            document.getElementById('kolchugino-map').appendChild(popupEl);
        }

        var popupOverlay = new ol.Overlay({
            element: document.getElementById('kolchugino-popup'),
            positioning: 'bottom-center',
            stopEvent: false, // Важно: false позволяет кликам проходить сквозь оверлей, если нужно, но мы управляем pointer-events в CSS
            offset: [0, -15]
        });
        map.addOverlay(popupOverlay);

        map.on('pointermove', function(evt) {
            if (evt.dragging) return;

            var feature = map.forEachFeatureAtPixel(evt.pixel, function(f) { return f; });
            
            clearTimeout(popupHoverTimeout);
            clearTimeout(popupLeaveTimeout);

            if (feature) {
                // Мышь НАД маркером
                popupHoverTimeout = setTimeout(function() {
                    var overlayObj = feature.get('overlay');
                    if (overlayObj) {
                        // Если открыт другой попап, закрываем его
                        if (currentOpenOverlay && currentOpenOverlay !== overlayObj) {
                            $(currentOpenOverlay.getElement()).hide().css('pointer-events', 'none');
                        }
                        
                        popupOverlay.setPosition(evt.coordinate);
                        popupOverlay.getElement().innerHTML = createPopupContent(feature.get('featureData') || feature.getProperties());
                        $(popupOverlay.getElement()).show().css('pointer-events', 'auto');
                        currentOpenOverlay = popupOverlay;
                    }
                }, 300); // Задержка 300мс перед показом
            } else {
                // Мышь УШЛА с маркера
                // Проверяем, не навели ли мы на сам попап (это делается через CSS/JS события попапа)
                if (currentOpenOverlay) {
                     // Задержка перед скрытием, чтобы успеть перевести мышь на попап
                     popupLeaveTimeout = setTimeout(function() {
                         // Проверяем, не находится ли курсор над попапом (через :hover)
                         if (!$(currentOpenOverlay.getElement()).is(':hover')) {
                             $(currentOpenOverlay.getElement()).hide().css('pointer-events', 'none');
                             currentOpenOverlay = null;
                         }
                     }, 400);
                }
            }
        });

        // Обработка мыши НАД самим попапом
        $(popupOverlay.getElement()).on('mouseenter', function() {
            clearTimeout(popupLeaveTimeout); // Отменяем скрытие
        }).on('mouseleave', function() {
            $(this).hide().css('pointer-events', 'none');
            currentOpenOverlay = null;
        });

        // Клик по крестику внутри попапа
        $(popupOverlay.getElement()).on('click', '.popup-closer', function(e) {
            e.stopPropagation(); // Не закрывать через другие обработчики
            $(popupOverlay.getElement()).hide().css('pointer-events', 'none');
            currentOpenOverlay = null;
        });
    }
    
    /**
     * Загрузка категорий
     */
    function loadCategories() {
        $.ajax({
            url: kolchuginoMapData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'get_map_categories',
                nonce: kolchuginoMapData.nonce
            },
            success: function(response) {
                if (response.success) {
                    allCategories = response.data.categories;
                    renderFilters();
                    renderLegend();
                }
            },
            error: function() {
                console.error('Ошибка загрузки категорий');
            }
        });
    }
    
    /**
     * Загрузка объектов
     */
    function loadObjects() {
        showLoader();
        
        $.ajax({
            url: kolchuginoMapData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'get_map_objects',
                nonce: kolchuginoMapData.nonce,
                category: currentFilter
            },
            success: function(response) {
                console.log('AJAX success response:', response);
                if (response.success) {
                    console.log('Objects loaded:', response.data.objects);
                    
                    // Детальное логирование для отладки координат
                    if (response.data.objects && response.data.objects.length > 0) {
                        console.log('[Kolchugino Map] Loaded objects:', response.data.objects.length);
                    }
                    
                    allObjects = response.data.objects;
                    renderMarkers();
                } else {
                    console.error('AJAX error response:', response);
                    showError(kolchuginoMapData.i18n.error);
                }
            },
            error: function(xhr, status, error) {
                console.error('AJAX request failed:', status, error, xhr);
                showError(kolchuginoMapData.i18n.error);
            },
            complete: function() {
                hideLoader();
            }
        });
    }
    
    /**
     * Отрисовка фильтров
     */
    function renderFilters() {
        var container = $('#kolchugino-map-filters-container');
        container.empty();

        var select = $('<select>')
            .addClass('kolchugino-filter-select');

        $.each(allCategories, function(index, category) {
            var option = $('<option>')
                .val(category.slug)
                .text(category.name);
            if (category.slug === currentFilter) {
                option.prop('selected', true);
            }
            select.append(option);
        });

        select.on('change', function() {
            currentFilter = $(this).val();
            renderMarkers();
        });

        container.append(select);
    }
    
    /**
     * Отрисовка легенды
     */
    function renderLegend() {
        var container = $('#kolchugino-map-legend-container');
        container.empty();
        
        $.each(allCategories, function(index, category) {
            var item = $('<div>')
                .addClass('legend-item')
                .html('<span class="legend-icon" style="background-color: ' + category.color + ';"></span>' + category.name);
            
            container.append(item);
        });
    }
    
    /**
     * Отрисовка маркеров
     */
    function renderMarkers() {
        console.log('Rendering markers with objects:', allObjects);
        
        // В начале renderMarkers()
        const autoFit = typeof kolchuginoMapData.autoFit !== 'undefined' ? kolchuginoMapData.autoFit : true;
        
        // Очистка старых маркеров
        if (markersLayer) {
            markersLayer.getSource().clear();
        }
        
        if (allObjects.length === 0) {
            console.log('No objects to render');
            showNoResults();
            return;
        }
        
        var validObjects = 0;
        var extent = null;
        
        $.each(allObjects, function(index, obj) {
            console.log('Processing object', index, obj);
            // Проверяем, что координаты существуют и являются числами
            if (!obj.lat || !obj.lng || isNaN(obj.lat) || isNaN(obj.lng)) {
                console.log('Skipping object', obj.title, 'due to invalid coordinates:', {
                    lat: obj.lat,
                    lng: obj.lng,
                    latType: typeof obj.lat,
                    lngType: typeof obj.lng,
                    latString: String(obj.lat),
                    lngString: String(obj.lng)
                });
                return;
            }
            
            // Создание геометрии маркера
            var coordinates = ol.proj.fromLonLat([obj.lng, obj.lat]);
            
            // Создание векторной особенности
            var feature = new ol.Feature({
                geometry: new ol.geom.Point(coordinates),
                name: obj.title,
                description: obj.description,
                address: obj.address,
                phone: obj.phone,
                website: obj.website,
                email: obj.email,
                opening_hours: obj.opening_hours,
                price: obj.price,
                featured: obj.featured,
                thumbnail: obj.thumbnail,
                permalink: obj.permalink,
                categories: obj.categories,
                custom_popup_text: obj.custom_popup_text
            });
            
            // Сохраняем весь объект obj в фиче
            feature.set('featureData', obj);
            
            // Добавление всплывающего окна
            var popupElement = document.createElement('div');
            popupElement.innerHTML = createPopupContent(obj);
            popupElement.className = 'ol-popup';
            
            var overlay = new ol.Overlay({
                element: popupElement,
                positioning: 'bottom-center',
                stopEvent: false,
                offset: [0, -20]
            });
            
            map.addOverlay(overlay);
            
            // Сохранение ссылки на оверлей
            feature.set('overlay', overlay);
            
            // Добавление в слой
            markersLayer.getSource().addFeature(feature);
            console.log('Added feature to layer:', {
                title: obj.title,
                coordinates: coordinates,
                featuresCount: markersLayer.getSource().getFeatures().length
            });
            
            // Обновление экстента для автомасштабирования
            if (!extent) {
                extent = [coordinates[0], coordinates[1], coordinates[0], coordinates[1]]; // [minX, minY, maxX, maxY]
                console.log('Created initial extent:', extent);
            } else {
                ol.extent.extend(extent, coordinates);
                console.log('Extended extent to:', extent);
            }
            
            validObjects++;
        });
        
        console.log('Rendered', validObjects, 'markers out of', allObjects.length, 'objects');
        
        // Автомасштабирование
        if (autoFit && validObjects > 0 && extent) {
            const width = extent[2] - extent[0];
            const height = extent[3] - extent[1];
            const minSize = 100; // Минимальный размер экстенда в метрах проекции
            
            // Если объекты слишком близко или в одной точке — используем заданный зум
            if (width < minSize && height < minSize) {
                map.getView().setCenter(ol.proj.fromLonLat([kolchuginoMapData.centerLng, kolchuginoMapData.centerLat]));
                map.getView().setZoom(parseInt(kolchuginoMapData.defaultZoom) || 13);
            } else {
                map.getView().fit(extent, {
                    size: map.getSize(),
                    padding: [50, 50, 50, 50],
                    maxZoom: parseInt(kolchuginoMapData.defaultZoom) || 18
                });
            }
        } else {
            // Запасной вариант
            map.getView().setCenter(ol.proj.fromLonLat([kolchuginoMapData.centerLng, kolchuginoMapData.centerLat]));
            map.getView().setZoom(parseInt(kolchuginoMapData.defaultZoom) || 13);
        }
    }
    
    /**
     * Создание иконки маркера (исправлено: приоритет кастомного цвета)
     */
    function createMarkerIcon(obj) {
        // 1. Приоритет: кастомный цвет из мета-данных (сохраненный в админке)
        var color = obj.marker_color || '#3399CC';
        
        // 2. Если кастомный цвет не задан, пробуем взять цвет категории
        if (!obj.marker_color && obj.categories && obj.categories.length > 0) {
            var category = allCategories.find(function(c) { return c.slug === obj.categories[0]; });
            if (category) {
                color = category.color;
            }
        }

        var iconType = obj.marker_icon || 'circle';

        // Если иконка есть в нашей конфигурации, генерируем SVG с динамическим цветом
        if (markerIcons[iconType]) {
            // Убран флаг 'g' (global), чтобы не закрашивать второстепенные элементы (например, белый крест в аптеке)
            var svgContent = markerIcons[iconType].replace(/fill\s*=\s*"[^"]*"/i, 'fill="' + color + '"');
            return new ol.style.Style({
                image: new ol.style.Icon({
                    src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent), // ✅ OL сам загрузит и закэширует
                    imgSize: [24, 24],
                    anchor: [0.5, 1],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction'
                })
            });
        }

        // Fallback: если иконки нет в конфиге, рисуем аккуратный круг заданного цвета
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: 8,
                fill: new ol.style.Fill({color: color}),
                stroke: new ol.style.Stroke({color: '#fff', width: 2})
            })
        });
    }
    
    /**
     * Создание SVG иконки
     */
    function createSvgIcon(iconType, color) {
        // Проверяем, есть ли иконка в конфигурации
        if (markerIcons[iconType]) {
            var svgContent = markerIcons[iconType];
            // Заменяем цвет в SVG, если он есть
            svgContent = svgContent.replace(/fill="[^"]*"/g, 'fill="' + color + '"');
            
            // Создаем изображение из SVG
            var img = new Image();
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
            
            return img;
        }
        
        // Базовые SVG иконки для обратной совместимости
        var svgContent = '';
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
        
        // Создаем изображение из SVG
        var img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
        
        return img;
    }
    
    /**
     * Создание содержимого попапа
     */
    function createPopupContent(obj) {
        var html = '<div class="kolchugino-popup">';
        // Кнопка закрытия
        html += '<button type="button" class="popup-closer" title="Закрыть">&times;</button>';
        
        html += '<h3>' + escapeHtml(obj.title) + '</h3>';
        
        // Добавляем миниатюру, если есть
        if (obj.thumbnail) {
            html += '<img src="' + escapeHtml(obj.thumbnail) + '" alt="" class="popup-thumbnail">';
        }
        
        // Добавляем краткий excerpt, если есть
        if (obj.excerpt) {
            html += '<div class="popup-excerpt">' + escapeHtml(obj.excerpt) + '</div>';
        }
        
        // НОВОЕ ПОЛЕ
        if (obj.custom_popup_text) {
            html += '<div class="popup-custom-text">' + escapeHtml(obj.custom_popup_text) + '</div>';
        }
        
        html += '<div class="popup-meta">';
        if (obj.phone) html += '<div><strong>📞 Тел:</strong> <a href="tel:' + escapeHtml(obj.phone) + '">' + escapeHtml(obj.phone) + '</a></div>';
        if (obj.email) html += '<div><strong>✉️ Email:</strong> <a href="mailto:' + escapeHtml(obj.email) + '">' + escapeHtml(obj.email) + '</a></div>';
        if (obj.website) html += '<div><strong>🌐 Сайт:</strong> <a href="' + escapeHtml(obj.website) + '" target="_blank">Перейти</a></div>';
        html += '</div>';
        html += '</div>';
        return html;
    }
    
    /**
     * Инициализация обработчиков событий
     */
    function initEventHandlers() {
        // Поиск
        $('#kolchugino-map-search-btn').on('click', performSearch);
        $('#kolchugino-map-search-input').on('keypress', function(e) {
            if (e.which === 13) {
                performSearch();
            }
        });
        
        // Печать
        $('#kolchugino-map-print-btn').on('click', function() {
            window.open('?kolchugino_export=print_pdf', '_blank');
        });
        
        // Оффлайн режим
        $('#kolchugino-map-offline-btn').on('click', function() {
            alert('Функция оффлайн режима в разработке. Используйте экспорт GeoJSON для работы с картой в QGIS.');
        });
    }
    
    /**
     * Выполнение поиска
     */
    function performSearch() {
        var query = $('#kolchugino-map-search-input').val().toLowerCase().trim();
        
        if (!query) {
            renderMarkers();
            return;
        }
        
        var filtered = allObjects.filter(function(obj) {
            return obj.title.toLowerCase().indexOf(query) !== -1 ||
                   (obj.description && obj.description.toLowerCase().indexOf(query) !== -1) ||
                   (obj.address && obj.address.toLowerCase().indexOf(query) !== -1);
        });
        
        // Очистка старых маркеров
        if (markersLayer) {
            markersLayer.getSource().clear();
        }
        
        if (filtered.length === 0) {
            showNoResults();
            return;
        }
        
        var extent = null;
        
        $.each(filtered, function(index, obj) {
            // Проверяем, что координаты существуют и являются числами
            if (!obj.lat || !obj.lng || isNaN(obj.lat) || isNaN(obj.lng)) {
                console.log('Skipping object in search', obj.title, 'due to invalid coordinates:', {
                    lat: obj.lat,
                    lng: obj.lng,
                    latType: typeof obj.lat,
                    lngType: typeof obj.lng
                });
                return;
            }
            
            // Создание геометрии маркера
            var coordinates = ol.proj.fromLonLat([obj.lng, obj.lat]);
            
            // Создание векторной особенности
            var feature = new ol.Feature({
                geometry: new ol.geom.Point(coordinates),
                name: obj.title,
                description: obj.description,
                address: obj.address,
                phone: obj.phone,
                website: obj.website,
                email: obj.email,
                opening_hours: obj.opening_hours,
                price: obj.price,
                featured: obj.featured,
                thumbnail: obj.thumbnail,
                permalink: obj.permalink,
                categories: obj.categories
            });
            
            // Добавление всплывающего окна
            var popupElement = document.createElement('div');
            popupElement.innerHTML = createPopupContent(obj);
            popupElement.className = 'ol-popup';
            
            var overlay = new ol.Overlay({
                element: popupElement,
                positioning: 'bottom-center',
                stopEvent: false,
                offset: [0, -20]
            });
            
            map.addOverlay(overlay);
            
            // Сохранение ссылки на оверлей
            feature.set('overlay', overlay);
            
            // Добавление в слой
            markersLayer.getSource().addFeature(feature);
            
            // Обновление экстента для автомасштабирования
            if (!extent) {
                extent = [coordinates[0], coordinates[1], coordinates[0], coordinates[1]]; // [minX, minY, maxX, maxY]
            } else {
                ol.extent.extend(extent, coordinates);
            }
        });
        
        // Автомасштабирование
        if (autoFit && filtered.length > 0 && extent) {
            const width = extent[2] - extent[0];
            const height = extent[3] - extent[1];
            const minSize = 100; // Минимальный размер экстенда в метрах проекции
            
            // Если объекты слишком близко или в одной точке — используем заданный зум
            if (width < minSize && height < minSize) {
                map.getView().setCenter(ol.proj.fromLonLat([kolchuginoMapData.centerLng, kolchuginoMapData.centerLat]));
                map.getView().setZoom(parseInt(kolchuginoMapData.defaultZoom) || 13);
            } else {
                map.getView().fit(extent, {
                    size: map.getSize(),
                    padding: [50, 50, 50, 50],
                    maxZoom: parseInt(kolchuginoMapData.defaultZoom) || 18
                });
            }
        } else {
            // Запасной вариант
            map.getView().setCenter(ol.proj.fromLonLat([kolchuginoMapData.centerLng, kolchuginoMapData.centerLat]));
            map.getView().setZoom(parseInt(kolchuginoMapData.defaultZoom) || 13);
        }
    }
    
    /**
     * Показать индикатор загрузки
     */
    function showLoader() {
        $('#kolchugino-map-loader').addClass('active');
    }
    
    /**
     * Скрыть индикатор загрузки
     */
    function hideLoader() {
        $('#kolchugino-map-loader').removeClass('active');
    }
    
    /**
     * Показать сообщение об ошибке
     */
    function showError(message) {
        console.error(message);
    }
    
    /**
     * Показать "ничего не найдено"
     */
    function showNoResults() {
        console.log(kolchuginoMapData.i18n.noResults);
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
    $(document).ready(function() {
        initMap();
    });
    
})(jQuery);
