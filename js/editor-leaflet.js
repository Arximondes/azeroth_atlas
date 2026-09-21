/* ============================================
   EDITOR-LEAFLET.JS — визуальный редактор зон для Leaflet
   Сохраняет зоны через POST /save-json на локальный сервер
   ============================================ */

(function() {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') !== '1') return;

    console.log('[editor] Режим редактора ВКЛЮЧЁН');

    let fullData = {};   // весь JSON со всеми регионами
    let zones = [];      // зоны текущего региона
    let renderedRects = [];
    let isDrawingMode = false;
    let drawing = false;
    let startLatLng = null;
    let previewRect = null;

    let tries = 0;
    const timer = setInterval(() => {
        tries++;
        if (window.__atlasMap) {
            clearInterval(timer);
            init();
        }
        if (tries > 100) {
            clearInterval(timer);
            console.error('[editor] Не дождались инициализации карты');
        }
    }, 100);

    // ============================================
    //   СОХРАНЕНИЕ НА СЕРВЕР
    // ============================================

    async function saveToFile() {
        try {
            fullData[window.__atlasRegion] = zones;

            const res = await fetch('/save-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fullData, null, 2)
            });

            if (res.ok) {
                console.log('[editor] ✅ Сохранено на сервер');
                flashStatus('✅ Сохранено');
                return true;
            } else {
                console.error('[editor] Ошибка сервера:', res.status);
                flashStatus('❌ Ошибка ' + res.status);
                return false;
            }
        } catch (err) {
            console.error('[editor] Ошибка сохранения:', err);
            flashStatus('❌ Сервер не отвечает');
            return false;
        }
    }

    function flashStatus(text) {
        const status = document.getElementById('save-status');
        if (!status) return;
        status.textContent = text;
        status.style.opacity = '1';
        setTimeout(() => {
            status.style.opacity = '0';
        }, 1500);
    }

    function init() {
        const map = window.__atlasMap;
        const cfg = window.__atlasConfig;
        const regionId = window.__atlasRegion;
        const MAX_ZOOM = cfg.maxZoom;
        const MAP_WIDTH = cfg.width;
        const MAP_HEIGHT = cfg.height;

        console.log('[editor] Карта готова. Регион:', regionId);

        const container = map.getContainer();

        // ============================================
        //   ОТРИСОВКА ЗОН
        // ============================================

        function drawZone(zone, idx) {
            const x1 = zone.x * MAP_WIDTH  / 100;
            const y1 = zone.y * MAP_HEIGHT / 100;
            const x2 = (zone.x + zone.w) * MAP_WIDTH  / 100;
            const y2 = (zone.y + zone.h) * MAP_HEIGHT / 100;

            const topLeft     = map.unproject([x1, y1], MAX_ZOOM);
            const bottomRight = map.unproject([x2, y2], MAX_ZOOM);

            const rect = L.rectangle([topLeft, bottomRight], {
                color: 'red',
                weight: 2,
                fillColor: 'red',
                fillOpacity: 0.25,
                interactive: true
            }).addTo(map);

            rect.bindTooltip(`${idx + 1}. ${zone.name}`, {
                sticky: true,
                direction: 'top'
            });

            rect.on('click', async (e) => {
                L.DomEvent.stopPropagation(e);
                if (confirm(`Удалить зону "${zone.name}"?`)) {
                    rect.remove();
                    zones.splice(idx, 1);
                    renderAll();
                    await saveToFile();
                }
            });

            return rect;
        }

        function renderAll() {
            renderedRects.forEach(r => r.remove());
            renderedRects = [];
            zones.forEach((z, i) => {
                renderedRects.push(drawZone(z, i));
            });
            updateCount();
        }

        function updateCount() {
            const el = document.getElementById('zone-count');
            if (el) el.textContent = zones.length;
        }

        // ============================================
        //   РЕЖИМ РИСОВАНИЯ
        // ============================================

        function enterDrawMode() {
            if (isDrawingMode) return;
            isDrawingMode = true;
            map.dragging.disable();
            container.style.cursor = 'crosshair';
            updatePanelState();
        }

        function exitDrawMode() {
            if (!isDrawingMode) return;
            isDrawingMode = false;
            map.dragging.enable();
            container.style.cursor = '';
            updatePanelState();

            if (previewRect) {
                previewRect.remove();
                previewRect = null;
            }
            drawing = false;
            startLatLng = null;
        }

        function updatePanelState() {
            const btn = document.getElementById('draw-btn');
            const status = document.getElementById('draw-status');
            if (!btn) return;

            if (isDrawingMode) {
                btn.textContent = '✖ Выйти из режима рисования';
                btn.style.background = '#8b1a1a';
                btn.style.color = '#fff';
                if (status) status.textContent = '🎯 Режим рисования ВКЛ';
            } else {
                btn.textContent = '➕ Добавить зону';
                btn.style.background = '';
                btn.style.color = '';
                if (status) status.textContent = '';
            }
        }

        // ============================================
        //   ОБРАБОТЧИКИ МЫШИ
        // ============================================

        container.addEventListener('mousedown', function(e) {
            if (!isDrawingMode) return;
            if (e.button !== 0) return;

            e.preventDefault();
            e.stopPropagation();

            startLatLng = map.mouseEventToLatLng(e);
            drawing = true;
        }, true);

        document.addEventListener('mousemove', function(e) {
            if (!drawing || !startLatLng) return;

            const currentLatLng = map.mouseEventToLatLng(e);

            const sw = L.latLng(
                Math.min(startLatLng.lat, currentLatLng.lat),
                Math.min(startLatLng.lng, currentLatLng.lng)
            );
            const ne = L.latLng(
                Math.max(startLatLng.lat, currentLatLng.lat),
                Math.max(startLatLng.lng, currentLatLng.lng)
            );
            const bounds = L.latLngBounds(sw, ne);

            if (previewRect) {
                previewRect.setBounds(bounds);
            } else {
                previewRect = L.rectangle(bounds, {
                    color: 'lime',
                    weight: 2,
                    dashArray: '6 4',
                    fillColor: 'lime',
                    fillOpacity: 0.2,
                    interactive: false
                }).addTo(map);
            }
        }, true);

        document.addEventListener('mouseup', async function(e) {
            if (!drawing || !startLatLng) return;

            const endLatLng = map.mouseEventToLatLng(e);

            const sw = L.latLng(
                Math.min(startLatLng.lat, endLatLng.lat),
                Math.min(startLatLng.lng, endLatLng.lng)
            );
            const ne = L.latLng(
                Math.max(startLatLng.lat, endLatLng.lat),
                Math.max(startLatLng.lng, endLatLng.lng)
            );

            const p1 = map.project(sw, MAX_ZOOM);
            const p2 = map.project(ne, MAX_ZOOM);

            const topLeftPx     = L.point(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y));
            const bottomRightPx = L.point(Math.max(p1.x, p2.x), Math.max(p1.y, p2.y));

            const px = (topLeftPx.x / MAP_WIDTH) * 100;
            const py = (topLeftPx.y / MAP_HEIGHT) * 100;
            const pw = ((bottomRightPx.x - topLeftPx.x) / MAP_WIDTH) * 100;
            const ph = ((bottomRightPx.y - topLeftPx.y) / MAP_HEIGHT) * 100;

            if (previewRect) {
                previewRect.remove();
                previewRect = null;
            }
            drawing = false;
            startLatLng = null;

            if (pw < 0.01 || ph < 0.01) {
                console.log('[editor] Слишком маленькая зона, отмена');
                return;
            }

            const name = prompt('1/3. Название локации:');
            if (!name) return;

            const autoUrl = `https://wowpedia.fandom.com/ru/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;
            const url = prompt('2/3. URL статьи (можно вписать английский вариант):', autoUrl);
            if (url === null) return;

            const desc = prompt('3/3. Короткое описание (можно пропустить):', '');
            if (desc === null) return;

            zones.push({
                name: name,
                x: Math.round(px * 10) / 10,
                y: Math.round(py * 10) / 10,
                w: Math.round(pw * 10) / 10,
                h: Math.round(ph * 10) / 10,
                url: url || autoUrl,
                desc: desc.trim()
            });

            console.log('[editor] Добавлена зона:', name);
            renderAll();
            await saveToFile();
        }, true);

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && isDrawingMode) exitDrawMode();
        });

        // ============================================
        //   ПАНЕЛЬ УПРАВЛЕНИЯ
        // ============================================

        function createPanel() {
            const panel = document.createElement('div');
            panel.className = 'editor-panel';
            panel.innerHTML = `
                <div class="editor-title">🎨 Редактор зон</div>
                <div class="editor-info">Регион: <b>${regionId}</b></div>
                <div class="editor-info">Зон: <b id="zone-count">${zones.length}</b></div>
                <div class="editor-help">
                    • <b>Нажми "Добавить зону"</b><br>
                    • <b>Протяни мышкой</b> по карте<br>
                    • <b>Клик по красной зоне</b> → удалить<br>
                    • <b>Esc</b> → выйти из режима
                </div>
                <div id="save-status" class="editor-status"></div>
                <button id="draw-btn" class="editor-btn">➕ Добавить зону</button>
                <div id="draw-status" class="editor-status"></div>
                <button id="export-btn" class="editor-btn">📋 Скопировать JSON</button>
                <button id="clear-btn" class="editor-btn editor-btn-danger">🗑 Очистить всё</button>
            `;
            document.body.appendChild(panel);

            document.getElementById('draw-btn').addEventListener('click', () => {
                if (isDrawingMode) exitDrawMode();
                else enterDrawMode();
            });

            document.getElementById('export-btn').addEventListener('click', () => {
                const output = {};
                output[regionId] = zones;
                const json = JSON.stringify(output, null, 2);

                navigator.clipboard.writeText(json)
                    .then(() => alert('✅ JSON скопирован в буфер обмена!'))
                    .catch(() => {
                        const ta = document.createElement('textarea');
                        ta.value = json;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        ta.remove();
                        alert('✅ JSON скопирован!');
                    });
            });

            document.getElementById('clear-btn').addEventListener('click', async () => {
                if (confirm('Удалить ВСЕ зоны этого региона?')) {
                    zones = [];
                    renderAll();
                    await saveToFile();
                }
            });
        }

        // ============================================
        //   ЗАГРУЗКА zones.json
        // ============================================

        fetch('../data/zones.json?_=' + Date.now())
            .then(r => r.json())
            .then(data => {
                fullData = data;
                zones = data[regionId] || [];
                console.log('[editor] Загружено зон:', zones.length);
                renderAll();
                createPanel();
            })
            .catch(err => {
                console.error('[editor] Ошибка загрузки zones.json:', err);
                createPanel();
            });
    }

})();