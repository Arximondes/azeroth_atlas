/* ============================================
   WIKI-PANEL.JS — боковая панель с описанием локации
   Данные берутся из zones.json (поле "desc")
   ============================================ */

(function() {
    'use strict';

    const panel = document.getElementById('wiki-panel');
    const panelBody = document.getElementById('wiki-panel-body');
    const panelTitle = document.getElementById('wiki-panel-title');
    const panelLink = document.getElementById('wiki-panel-link');
    const closeBtn = document.getElementById('wiki-panel-close');

    if (!panel) return;

    console.log('[wiki-panel] Панель готова');

    // --- Закрытие ---
    closeBtn.addEventListener('click', closePanel);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePanel();
    });

    function closePanel() {
        panel.classList.remove('open');
        document.querySelector('.map-wrapper')?.classList.remove('panel-open');
    }

    function openPanel() {
        panel.classList.add('open');
        document.querySelector('.map-wrapper')?.classList.add('panel-open');
    }

    // --- Открытие панели для зоны ---
    function loadZone(zone) {
        openPanel();

        panelTitle.textContent = zone.name;
        panelLink.href = zone.url || '#';

        let html = '';

        // Картинка (если указана в zones.json полем "img")
        if (zone.img) {
            html += `<img src="../img/locations/${zone.img}" alt="${zone.name}">`;
        }

        // Описание
        if (zone.desc) {
            html += `<p>${zone.desc}</p>`;
        } else {
            html += `<p style="color:var(--text-dim);font-style:italic">
                Описание для этой локации пока не добавлено.<br>
                Нажмите «Читать полностью», чтобы открыть статью на Wowpedia.
            </p>`;
        }

        panelBody.innerHTML = html;
        panelBody.scrollTop = 0;
    }

    // --- Экспорт ---
    window.__openWikiPanel = loadZone;

})();