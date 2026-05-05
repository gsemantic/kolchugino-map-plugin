/**
 * JavaScript для админки карты Кольчугино
 * Управление картой при добавлении/редактировании точек
 */
(function() {
    'use strict';
    var adminMap = null;
    var marker = null;
    var vectorSource = null;
    var popupOverlay = null;
    var popupElement = null;

    /**
     * Инициализация карты в админке
     */
    function initAdminMap() {
        if (typeof ol === 'undefined') {
            return;
        }
        
        var centerLat = kolchuginoMapData && kolchuginoMapData.centerLat
            ? kolchuginoMapData.centerLat
            : 56.294425;
        var centerLng = kolchuginoMapData && kolchuginoMapData.centerLng
            ? kolchuginoMapData.centerLng
            : 39.375751;
        
        var mapContainer = document.getElementById('kolchugino-map-admin');
        if (!mapContainer) return;

        // Создаем источник тайлов
        var tileSource;
        if (kolchuginoMapData.hasOfflineTiles && kolchuginoMapData.tilesUrl) {
            tileSource = new ol.source.XYZ({
                url: kolchuginoMapData.tilesUrl + '{z}/{x}/{y}.png',
                minZoom: 12,
                maxZoom: 15
            });
        } else {
            tileSource = new ol.source.OSM();
        }

        var tileLayer = new ol.layer.Tile({
            source: tileSource,
            zIndex: 0
        });

        vectorSource = new ol.source.Vector();
        var vectorLayer = new ol.layer.Vector({
            source: vectorSource,
            style: function(feature) {
                // Получаем иконку и цвет из свойств или используем значения по умолчанию
                const icon = feature.get('icon') || 'circle';
                const color = feature.get('color') || '#e74c3c';
                
                return new ol.style.Style({
                    image: new ol.style.Icon({
                        src: createIconSVG(icon, color),
                        scale: 1.2,
                        anchor: [0.5, 1],
                        anchorXUnits: 'fraction',
                        anchorYUnits: 'fraction'
                    })
                });
            }
        });

        adminMap = new ol.Map({
            target: 'kolchugino-map-admin',
            layers: [tileLayer, vectorLayer],
            view: new ol.View({
                center: ol.proj.fromLonLat([centerLng, centerLat]),
                zoom: 13
            }),
            controls: ol.control.defaults.defaults({ attribution: false }).extend([
                new ol.control.ScaleLine()
            ])
        });

        // === ДОБАВЛЕНИЕ: Попап с миниатюрой при наведении ===
        popupElement = document.createElement('div');
        popupElement.className = 'ol-admin-popup';
        popupElement.style.cssText = 'background: #fff; border: 1px solid #ccc; padding: 5px; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); pointer-events: none; opacity: 0; transition: opacity 0.2s; z-index: 1000;';
        popupElement.innerHTML = '<img src="" style="max-width: 100px; max-height: 100px; display: block; object-fit: cover; border-radius: 2px;">';
        
        popupOverlay = new ol.Overlay({
            element: popupElement,
            positioning: 'bottom-center',
            offset: [0, -15],
            stopEvent: false
        });
        adminMap.addOverlay(popupOverlay);

        function buildAdminPopupHTML(p) {
            var html = '<div style="font-family: sans-serif; font-size: 12px; max-width: 240px; line-height: 1.4;">';
            html += '<strong style="display:block; margin-bottom:6px; font-size:13px;">' + (p.title || 'Без названия') + '</strong>';
            if (p.thumbnail) html += '<img src="' + p.thumbnail + '" style="width:100%; max-height:100px; object-fit:cover; border-radius:4px; margin-bottom:6px;">';
            if (p.description) html += '<div style="margin-bottom:6px; color:#444; max-height:60px; overflow:hidden; text-overflow:ellipsis;">' + p.description.substring(0, 100) + '</div>';
            if (p.phone) html += '<div style="margin-bottom:2px;">📞 <a href="tel:' + p.phone + '" style="color:#2271b1; text-decoration:none;">' + p.phone + '</a></div>';
            if (p.email) html += '<div style="margin-bottom:2px;">✉️ <a href="mailto:' + p.email + '" style="color:#2271b1; text-decoration:none;">' + p.email + '</a></div>';
            if (p.website) {
                var url = p.website.match(/^https?:\/\//i) ? p.website : 'https://' + p.website;
                html += '<div style="margin-bottom:2px;">🌐 <a href="' + url + '" target="_blank" style="color:#2271b1; text-decoration:none;">Открыть сайт</a></div>';
            }
            html += '</div>';
            return html;
        }

        adminMap.on('pointermove', function(evt) {
            const feature = adminMap.forEachFeatureAtPixel(evt.pixel, function(f) { return f; });
            if (feature) {
                const props = feature.getProperties();
                popupElement.innerHTML = buildAdminPopupHTML(props);
                popupElement.style.opacity = '1';
                popupOverlay.setPosition(evt.coordinate);
            } else {
                popupElement.style.opacity = '0';
            }
        });
        // === КОНЕЦ ДОБАВЛЕНИЯ ===

        // Добавляем маркер если есть координаты
        var latInput = document.getElementById('map_lat');
        var lngInput = document.getElementById('map_lng');
        if (latInput && lngInput && latInput.value && lngInput.value) {
            var lat = parseFloat(latInput.value);
            var lng = parseFloat(lngInput.value);
            if (!isNaN(lat) && !isNaN(lng)) {
                const props = kolchuginoMapData.existingData || {};
                
                // Получаем сохраненные значения иконки и цвета
                const savedIcon = document.getElementById('_map_marker_icon')?.value || 'circle';
                const savedColor = document.getElementById('_map_marker_color')?.value || '#e74c3c';
                
                marker = new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat([lng, lat])),
                    title: props.title || 'Новый объект',
                    phone: props.phone || '',
                    email: props.email || '',
                    website: props.website || '',
                    description: props.description || '',
                    thumbnail: props.thumbnail || '',
                    icon: savedIcon,
                    color: savedColor
                });
                vectorSource.addFeature(marker);
                
                // Устанавливаем выбранную иконку в селекторе
                const markerOptions = document.querySelectorAll('.marker-option');
                markerOptions.forEach(option => {
                    option.classList.remove('selected');
                    if (option.dataset.icon === savedIcon) {
                        option.classList.add('selected');
                    }
                });
            }
        }

        // Клик по карте - установка маркера
        adminMap.on('singleclick', function(evt) {
            var coords = evt.coordinate;
            var lonLat = ol.proj.toLonLat(coords);
            
            document.getElementById('map_lat').value = lonLat[1];
            document.getElementById('map_lng').value = lonLat[0];
            
            addMarker(lonLat[1], lonLat[0]);
            getAddressFromCoordinates(lonLat[1], lonLat[0]);
            
            var latInputVisible = document.getElementById('map_lat_input');
            var lngInputVisible = document.getElementById('map_lng_input');
            if (latInputVisible && lngInputVisible) {
                latInputVisible.value = lonLat[1].toFixed(6);
                lngInputVisible.value = lonLat[0].toFixed(6);
            }
        });

        // Обновление маркера при изменении координат
        latInput.addEventListener('input', function() {
            var lat = parseFloat(this.value);
            var lng = parseFloat(document.getElementById('map_lng').value);
            if (!isNaN(lat) && !isNaN(lng)) {
                addMarker(lat, lng);
            }
        });
        
        lngInput.addEventListener('input', function() {
            var lat = parseFloat(document.getElementById('map_lat').value);
            var lng = parseFloat(this.value);
            if (!isNaN(lat) && !isNaN(lng)) {
                addMarker(lat, lng);
            }
            var lngInputVisible = document.getElementById('map_lng_input');
            if (lngInputVisible) {
                lngInputVisible.value = this.value;
            }
        });

        var latInputVisible = document.getElementById('map_lat_input');
        if (latInputVisible) {
            latInputVisible.addEventListener('input', function() {
                var lat = parseFloat(this.value);
                var lng = parseFloat(document.getElementById('map_lng').value);
                if (!isNaN(lat) && !isNaN(lng)) {
                    addMarker(lat, lng);
                    document.getElementById('map_lat').value = this.value;
                    var lngInputVisible = document.getElementById('map_lng_input');
                    if (lngInputVisible && lngInputVisible.value) {
                        lngInputVisible.value = lng.toFixed(6);
                    }
                }
            });
        }
        
        var lngInputVisible = document.getElementById('map_lng_input');
        if (lngInputVisible) {
            lngInputVisible.addEventListener('input', function() {
                var lat = parseFloat(document.getElementById('map_lat').value);
                var lng = parseFloat(this.value);
                if (!isNaN(lat) && !isNaN(lng)) {
                    addMarker(lat, lng);
                    document.getElementById('map_lng').value = this.value;
                    var latInputVisible = document.getElementById('map_lat_input');
                    if (latInputVisible && latInputVisible.value) {
                        latInputVisible.value = lat.toFixed(6);
                    }
                }
            });
        }

        if (latInputVisible && lngInputVisible && latInput.value && lngInput.value) {
            latInputVisible.value = parseFloat(latInput.value).toFixed(6);
            lngInputVisible.value = parseFloat(lngInput.value).toFixed(6);
        }
    }

    /**
     * Получение URL миниатюры из стандартного блока WordPress
     */
    function getThumbnailUrl() {
        // Пробуем найти картинку в стандартном блоке WordPress
        var standardImg = document.querySelector('#postimagediv img');
        if (standardImg && standardImg.src) {
            return standardImg.src;
        }
        // Фоллбэк на данные из PHP (если страница загружена с уже сохраненной картинкой)
        return kolchuginoMapData.thumbnailUrl || null;
    }

    /**
     * Добавление маркера на карту
     */
    function addMarker(lat, lng) {
        var coords = ol.proj.fromLonLat([lng, lat]);
        if (marker) {
            vectorSource.removeFeature(marker);
        }
        const props = kolchuginoMapData.existingData || {};
        
        // Получаем текущие значения иконки и цвета из скрытых полей
        const icon = document.getElementById('_map_marker_icon')?.value || 'circle';
        const color = document.getElementById('_map_marker_color')?.value || '#e74c3c';
        
        marker = new ol.Feature({
            geometry: new ol.geom.Point(coords),
            title: props.title || 'Новый объект',
            phone: props.phone || '',
            email: props.email || '',
            website: props.website || '',
            description: props.description || '',
            thumbnail: props.thumbnail || '',
            icon: icon,
            color: color
        });
        vectorSource.addFeature(marker);
        adminMap.getView().animate({
            center: coords,
            zoom: 15
        });
    }

    /**
     * Получение адреса по координатам через AJAX
     */
    function getAddressFromCoordinates(lat, lng) {
        var addressInput = document.getElementById('map_address');
        if (!addressInput) return;
        
        addressInput.value = 'Получение адреса...';
        addressInput.disabled = true;

        var formData = new FormData();
        formData.append('action', 'reverse_geocode');
        formData.append('nonce', kolchuginoMapData.nonce);
        formData.append('lat', lat);
        formData.append('lng', lng);

        fetch(kolchuginoMapData.ajaxUrl, {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    addressInput.value = data.data.address;
                } else {
                    addressInput.value = 'Ошибка при получении адреса';
                }
            })
            .catch(error => {
                addressInput.value = 'Ошибка при получении адреса';
            })
            .finally(() => {
                addressInput.disabled = false;
            });
    }


    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initAdminMap();
            initMarkerSelector();
        });
    } else {
        initAdminMap();
        initMarkerSelector();
    }

    // Функция обновления стиля маркера в админке
    function updateAdminMarkerStyle(icon, color) {
        if (!marker || !vectorSource) return;
        
        // Получаем текущий стиль маркера
        const featureStyle = marker.getStyle();
        if (featureStyle && featureStyle.getImage()) {
            // Создаем новый стиль с иконкой
            const iconStyle = new ol.style.Icon({
                src: createIconSVG(icon, color),
                scale: 1.2,
                anchor: [0.5, 1],
                anchorXUnits: 'fraction',
                anchorYUnits: 'fraction'
            });
            
            const newStyle = new ol.style.Style({
                image: iconStyle
            });
            
            marker.setStyle(newStyle);
        }
    }
    
    // Функция создания SVG иконки
    function createIconSVG(iconType, color) {
        const svgMap = {
            circle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="${color}"/></svg>`,
            star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="${color}"/></svg>`,
            pin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}"/></svg>`,
            house: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="${color}"/></svg>`,
            shop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M19 7h-3V6a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V10h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM9 6h6v1H9V6zm10 11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V10h2v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V10h2v7z" fill="${color}"/></svg>`,
            pharmacy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="${color}"/><path d="M12 11h2v2h-2zm0-4h2v2h-2z" fill="white"/></svg>`,
            cafe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M20 8h-2.81c.43-.78.81-1.62.81-2.5 0-1.38-1.12-2.5-2.5-2.5-1.93 0-3.5 1.57-3.5 3.5 0 .88.38 1.72.81 2.5H8.19c.43-.78.81-1.62.81-2.5 0-1.38-1.12-2.5-2.5-2.5S4 4.12 4 5.5c0 .88.38 1.72.81 2.5H2v10h20V8zm-7-2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5S13 6.33 13 5.5zM5 5.5c0-.83.67-1.5 1.5-1.5S8 4.67 8 5.5 7.33 7 6.5 7 5 6.33 5 5.5zm13 10.5H6v-5h12v5z" fill="${color}"/></svg>`,
            transport: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" fill="${color}"/></svg>`
        };
        
        return `data:image/svg+xml;base64,${btoa(svgMap[iconType] || svgMap.circle)}`;
    }
    
    // Функция обновления свойств маркера при изменении полей
    function updateMarkerProperties() {
        if (!marker) return;
        marker.set('title', jQuery('#title').val() || 'Новый объект');
        marker.set('phone', jQuery('#map_phone').val());
        marker.set('email', jQuery('#map_email').val());
        marker.set('website', jQuery('#map_website').val());
        marker.set('description', jQuery('#excerpt').val() || jQuery('#map_description').val() || '');
    }
    
    // Инициализация селектора маркеров
    function initMarkerSelector() {
        const markerOptions = document.querySelectorAll('.marker-option');
        const iconInput = document.getElementById('_map_marker_icon');
        const colorInput = document.getElementById('_map_marker_color');
        
        // Устанавливаем начальное состояние
        if (iconInput && colorInput && iconInput.value) {
            markerOptions.forEach(option => {
                if (option.dataset.icon === iconInput.value) {
                    option.classList.add('selected');
                }
            });
        }
        
        // Обработчик кликов по иконкам
        markerOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Удаляем класс selected у всех опций
                markerOptions.forEach(opt => opt.classList.remove('selected'));
                
                // Добавляем класс selected к текущей опции
                this.classList.add('selected');
                
                // Обновляем скрытые поля
                const icon = this.dataset.icon;
                const color = this.dataset.color;
                
                if (iconInput) iconInput.value = icon;
                if (colorInput) colorInput.value = color;
                
                // Обновляем стиль маркера на карте
                updateAdminMarkerStyle(icon, color);
            });
        });
    }
    
    // Добавляем слушатели на инпуты для обновления попапа в реальном времени
    jQuery('#map_phone, #map_email, #map_website, #title, #excerpt').on('input', updateMarkerProperties);
})();
