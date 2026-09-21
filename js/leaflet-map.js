/* ============================================
   LEAFLET-MAP.JS — интерактивная карта на Leaflet
   ============================================ */

(function() {
    'use strict';

    // --- Определяем регион из URL ---
    const pathParts = window.location.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const regionId = fileName.replace('.html', '');
    console.log('[leaflet] Регион:', regionId);

    // --- Конфиг для каждого региона ---
    // width  = 256 * 2^maxZoom
    // height = width * (высота оригинала / ширина оригинала)
    const MAP_CONFIG = {
        azeroth:     { width: 32768, height: 17880, maxZoom: 7 },
        draenor:     { width: 32768, height: 17880, maxZoom: 7 },
        outland:     { width: 32768, height: 17880, maxZoom: 7 },
        argus:       { width: 32768, height: 17880, maxZoom: 7 },
        shadowlands: { width: 32768, height: 17880, maxZoom: 7 }
    };

    const cfg = MAP_CONFIG[regionId] || MAP_CONFIG.azeroth;
    const MAX_ZOOM  = cfg.maxZoom;
    const TILE_SIZE = 256;
    const MAP_WIDTH  = cfg.width;
    const MAP_HEIGHT = cfg.height;

    // --- Инициализация карты ---
    const map = L.map('leaflet-map', {
        crs: L.CRS.Simple,
        minZoom: 0,
        maxZoom: MAX_ZOOM,
        zoomControl: false,
        attributionControl: false,
        maxBoundsViscosity: 1.0,
        zoomSnap: 1,
        zoomDelta: 1,
        wheelPxPerZoomLevel: 120
    });

    // --- Границы карты ---
    const southWest = map.unproject([0, MAP_HEIGHT], MAX_ZOOM);
    const northEast = map.unproject([MAP_WIDTH, 0], MAX_ZOOM);
    const bounds = new L.LatLngBounds(southWest, northEast);

    // --- Подключаем тайлы ---
    L.tileLayer(`../tiles/${regionId}/{z}/{x}/{y}.jpg`, {
        tileSize: TILE_SIZE,
        minZoom: 0,
        maxZoom: MAX_ZOOM,
        noWrap: true,
        bounds: bounds,
        keepBuffer: 2,
        updateWhenIdle: false
    }).addTo(map);

    // Показываем всю карту сразу
    map.fitBounds(bounds);
    map.setMaxBounds(bounds);

    // --- Кнопки зума в правом нижнем углу ---
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // --- Загружаем зоны из JSON (кроме режима редактора) ---
    const isEditMode = new URLSearchParams(window.location.search).get('edit') === '1';

    if (!isEditMode) {
        fetch('../data/zones.json')
            .then(r => r.ok ? r.json() : Promise.reject('zones.json не найден'))
            .then(data => {
                const zones = data[regionId];
                if (!zones || !zones.length) {
                    console.warn('[leaflet] Нет зон для региона:', regionId);
                    return;
                }
                console.log('[leaflet] Загружено зон:', zones.length);
                addZones(zones);
            })
            .catch(err => console.error('[leaflet]', err));
    } else {
        console.log('[leaflet] Режим редактора — зоны не подгружаются');
    }

    // --- Добавляем зоны как прямоугольники ---
    function addZones(zones) {
        zones.forEach(zone => {
            // % → пиксели на максимальном зуме
            const x1 = zone.x * MAP_WIDTH  / 100;
            const y1 = zone.y * MAP_HEIGHT / 100;
            const x2 = (zone.x + zone.w) * MAP_WIDTH  / 100;
            const y2 = (zone.y + zone.h) * MAP_HEIGHT / 100;

            // unproject → координаты Leaflet
            const topLeft     = map.unproject([x1, y1], MAX_ZOOM);
            const bottomRight = map.unproject([x2, y2], MAX_ZOOM);

            const rect = L.rectangle([topLeft, bottomRight], {
                color: '#d4af37',
                weight: 0,
                fillColor: '#d4af37',
                fillOpacity: 0,
                interactive: true,
                className: 'leaflet-zone'
            }).addTo(map);

            // Hover — подсветка
            rect.on('mouseover', function() {
                this.setStyle({ weight: 2, fillOpacity: 0.25 });
            });
            rect.on('mouseout', function() {
                this.setStyle({ weight: 0, fillOpacity: 0 });
            });

            rect.on('click', function() {
                // Внутренняя ссылка (на другой регион)
                if (!zone.url.startsWith('http')) {
                    window.location.href = zone.url;
                    return;
                }

                // Открываем боковую панель
                if (window.__openWikiPanel) {
                    window.__openWikiPanel(zone);
                } else {
                    window.open(zone.url, '_blank');
                }
            });
            // Подсказка с названием
            rect.bindTooltip(zone.name, {
                sticky: true,
                direction: 'top',
                className: 'zone-tooltip'
            });
        });
    }

    // --- Экспортируем карту для редактора ---
    window.__atlasMap = map;
    window.__atlasConfig = cfg;
    window.__atlasRegion = regionId;
    window.__atlasMaxZoom = MAX_ZOOM;

})();