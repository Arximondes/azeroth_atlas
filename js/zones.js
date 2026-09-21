/* ============================================
   ZONES.JS — зум, перетаскивание и кликабельные зоны
   Без внешних библиотек
   ============================================ */

(function() {
    'use strict';

    // --- 1. Определяем регион из URL ---
    const pathParts = window.location.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const regionId = fileName.replace('.html', '');
    console.log('[zones.js] Регион:', regionId);

    // --- 2. Находим элементы ---
    const mapContainer = document.getElementById('map-container');
    const mapWrapper = document.querySelector('.map-wrapper');

    if (!mapContainer || !mapWrapper) {
        console.error('[zones.js] Не найден #map-container или .map-wrapper');
        return;
    }

    // ============================================
    //   ЗУМ И ПЕРЕТАСКИВАНИЕ
    // ============================================

    const MIN_SCALE = 1;
    const MAX_SCALE = 6;
    const ZOOM_STEP = 0.3;

    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    let startMouseX = 0;
    let startMouseY = 0;
    let startOffsetX = 0;
    let startOffsetY = 0;

    function applyTransform() {
        mapContainer.style.transform =
            `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        mapContainer.style.cursor = scale > 1 ? 'grab' : 'default';
    }

    // Зум в точку под курсором
    function zoomAt(newScale, cursorX, cursorY) {
        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
        if (newScale === scale) return;

        // Координаты курсора относительно контейнера
        const rect = mapContainer.getBoundingClientRect();
        const pointX = cursorX - rect.left;
        const pointY = cursorY - rect.top;

        // Во сколько раз меняется масштаб
        const ratio = newScale / scale;

        // Сдвигаем offset так, чтобы точка под курсором осталась на месте
        offsetX -= pointX * (ratio - 1);
        offsetY -= pointY * (ratio - 1);
        scale = newScale;

        // Если вернулись к 1 — сбрасываем сдвиг
        if (scale === 1) {
            offsetX = 0;
            offsetY = 0;
        }

        applyTransform();
    }

    function resetZoom() {
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        applyTransform();
    }

    // --- Зум колёсиком ---
    mapWrapper.addEventListener('wheel', function(e) {
        e.preventDefault();
        const direction = e.deltaY > 0 ? -1 : 1;
        const newScale = scale + direction * ZOOM_STEP;
        zoomAt(newScale, e.clientX, e.clientY);
    }, { passive: false });

    // --- Перетаскивание мышкой ---
    mapContainer.addEventListener('mousedown', function(e) {
        if (scale <= 1) return; // не двигаем при минимальном зуме
        isDragging = true;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        startOffsetX = offsetX;
        startOffsetY = offsetY;
        mapContainer.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        offsetX = startOffsetX + (e.clientX - startMouseX);
        offsetY = startOffsetY + (e.clientY - startMouseY);
        applyTransform();
    });

    document.addEventListener('mouseup', function() {
        if (!isDragging) return;
        isDragging = false;
        mapContainer.style.cursor = scale > 1 ? 'grab' : 'default';
    });

    // --- Перетаскивание пальцем (мобильные) ---
    let touchStartX = 0, touchStartY = 0;
    let touchStartOffsetX = 0, touchStartOffsetY = 0;
    let touchStartDistance = 0;
    let touchStartScale = 1;

    mapContainer.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1 && scale > 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartOffsetX = offsetX;
            touchStartOffsetY = offsetY;
        } else if (e.touches.length === 2) {
            // pinch — начало
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDistance = Math.hypot(dx, dy);
            touchStartScale = scale;
        }
    }, { passive: true });

    mapContainer.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1 && scale > 1 && !isDragging) {
            offsetX = touchStartOffsetX + (e.touches[0].clientX - touchStartX);
            offsetY = touchStartOffsetY + (e.touches[0].clientY - touchStartY);
            applyTransform();
        } else if (e.touches.length === 2) {
            // pinch
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.hypot(dx, dy);
            if (touchStartDistance > 0) {
                const newScale = touchStartScale * (distance / touchStartDistance);
                const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                zoomAt(newScale, centerX, centerY);
            }
        }
        if (e.touches.length) e.preventDefault();
    }, { passive: false });

    // --- Двойной клик — сброс ---
    mapWrapper.addEventListener('dblclick', resetZoom);

    // --- Кнопки управления ---
    createZoomControls();

    function createZoomControls() {
        const controls = document.createElement('div');
        controls.className = 'zoom-controls';
        controls.innerHTML = `
            <button type="button" class="zoom-btn" data-action="in" title="Приблизить">+</button>
            <button type="button" class="zoom-btn" data-action="out" title="Отдалить">−</button>
            <button type="button" class="zoom-btn" data-action="reset" title="Сбросить">⤢</button>
        `;
        document.body.appendChild(controls);

        controls.addEventListener('click', function(e) {
            const btn = e.target.closest('.zoom-btn');
            if (!btn) return;
            const action = btn.dataset.action;

            // Приближение/отдаление — в центр экрана
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;

            if (action === 'in')    zoomAt(scale + ZOOM_STEP, cx, cy);
            if (action === 'out')   zoomAt(scale - ZOOM_STEP, cx, cy);
            if (action === 'reset') resetZoom();
        });
    }

    // ============================================
    //   ЗОНЫ
    // ============================================

    fetch('../data/zones.json')
        .then(r => r.ok ? r.json() : Promise.reject('zones.json не найден'))
        .then(data => {
            const zones = data[regionId];
            if (!zones || zones.length === 0) {
                console.warn('[zones.js] Нет зон для региона:', regionId);
                return;
            }
            console.log('[zones.js] Загружено зон:', zones.length);
            addZones(zones, mapContainer);
        })
        .catch(err => console.error('[zones.js] Ошибка:', err));

    function addZones(zones, container) {
        zones.forEach(zone => {
            const link = document.createElement('a');
            link.className = 'zone';
            link.href = zone.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.setAttribute('data-name', zone.name);
            link.setAttribute('aria-label', 'Перейти к статье: ' + zone.name);

            link.style.left   = zone.x + '%';
            link.style.top    = zone.y + '%';
            link.style.width  = zone.w + '%';
            link.style.height = zone.h + '%';

            container.appendChild(link);
        });
    }

})();