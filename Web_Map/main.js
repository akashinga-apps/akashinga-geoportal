// Main entry
window.addEventListener('DOMContentLoaded', init);

function init() {
  // ---- Map & Controls ----
  const extentMap = [2958541, -2113452, 3431323, -1712425];

  const attributionControl = new ol.control.Attribution({ collapsible: true });
  const scaleLineControl = new ol.control.ScaleLine();
  const zoomSliderControl = new ol.control.ZoomSlider();
  const fullScreenControl = new ol.control.FullScreen();
  const zoomToExtentControl = new ol.control.ZoomToExtent({ extent: extentMap });

  const osmBase = new ol.layer.Tile({
    source: new ol.source.OSM(),
    visible: true,
    title: 'OSMStand'
  });

  const cartoLight = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: 'https://{a-d}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
    attributions: '© OpenStreetMap contributors, © CARTO',
    crossOrigin: 'anonymous',
    maxZoom: 20
  }),
  visible: false,
  title: 'CartoLight'
  });
  const cartoDark = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: 'https://{a-d}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attributions: '© OpenStreetMap contributors, © CARTO',
    crossOrigin: 'anonymous',
    maxZoom: 20
  }),
  visible: false,
  title: 'CartoDark'
  });
  // OpenTopoMap (raster)
  const openTopo = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attributions: '© OpenStreetMap contributors, © OpenTopoMap (CC-BY-SA)',
      maxZoom: 17,
      crossOrigin: 'anonymous'
    }),
    visible: false,
    title: 'OpenTopoMap'
  });

  // Group them (order here = radio choices above)
  const baseMapsLayerGroup = new ol.layer.Group({
    layers: [osmBase, cartoLight, cartoDark,openTopo]
  });

  

  const map = new ol.Map({
    target: 'js-map',
    layers: [baseMapsLayerGroup],
    view: new ol.View({
      extent: extentMap,
      center: [3107417, -2109428],
      zoom: 7,
      maxZoom: 18,
      minZoom: 7,
      rotation: 0
    }),
    controls: ol.control.defaults({ attribution: false }).extend([
      attributionControl, scaleLineControl, zoomSliderControl, fullScreenControl, zoomToExtentControl
    ])
  });

  // ---- UI refs ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const sidebar = $('#sidebar');
  $('#sidebar-toggle').addEventListener('click', () => sidebar.classList.toggle('collapsed'));

  const districtSel = $('#filter-district');
  const wardSel = $('#filter-ward');
  const searchInput = $('#search-input');
  const clearBtn = $('#clear-filters');
  const saveBtn = $('#save-state');
  const restoreBtn = $('#restore-state');
  const exportBtn = $('#export-geojson');
  const toast = $('#toast');
  const popupEl = $('#popup-container');
  const popup = new ol.Overlay({ element: popupEl });
  map.addOverlay(popup);

  // ---- Layers: Operational areas (polygons/lines) ----
  const zimbabweBoundary = new ol.layer.VectorImage({
    source: new ol.source.Vector({
      url: './resources/shapefiles/zimBoundary.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'zimbabwe',
    style: new ol.style.Style({
      fill: new ol.style.Fill({ color: 'rgba(255,255,255,0.01)' }),
      stroke: new ol.style.Stroke({ color: 'red', width: 3 })
    })
  });

  const districtsLayer = new ol.layer.VectorImage({
    source: new ol.source.Vector({
      url: './resources/shapefiles/Districts.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: true,
    title: 'districts',
    style: (feature) => [
      new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(255,255,255,0.35)' }),
        stroke: new ol.style.Stroke({ color: '#030303ff', width: 2 })
      }),
      labelStyle(feature, 10)
    ]
  });

  const wardsLayer = new ol.layer.VectorImage({
    source: new ol.source.Vector({
      url: './resources/shapefiles/reserve.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'wards',
    style: (feature) => [
      new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(255,255,255,0.35)' }),
        stroke: new ol.style.Stroke({ color: '#030303ff', width: 2 })
      }),
      labelStyle(feature, 12)
    ]
  });

  function roadStyle(feature) {
    const typeRaw = feature.get('Type');
    const type = typeRaw ? String(typeRaw).toLowerCase() : '';
    const name = feature.get('Name') || '';

    let strokeColor = '#8B4513';  // base brown
    let strokeWidth = 2.2;
    let lineDash = undefined;     // solid by default

    if (type === 'national road') {
      strokeColor = '#5C2E0E';    // darkest brown
      strokeWidth = 5.2;
    } else if (type === 'district access road') {
      strokeColor = '#754022';
      strokeWidth = 3;
    } else if (type === 'community access roads') {
      strokeColor = '#8B4513';
      strokeWidth = 2.6;
    } else if (type === 'park access road') {
      strokeColor = '#A35B2A';
      strokeWidth = 2.4;
    } else if (type === 'park feeder road') {
      strokeColor = '#C7824C';
      strokeWidth = 2;
    } else if (type === 'tracks') {
      strokeColor = '#E2BC8E';
      strokeWidth = 1.6;
    } else {
      // Anything else = brown dotted line
      strokeColor = '#8B4513';
      strokeWidth = 1.8;
      lineDash = [4, 4]; // dotted pattern
    }

    const style = new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: strokeColor,
        width: strokeWidth,
        lineDash: lineDash
      })
    });

    // label by Name along the line
    if (name) {
      style.setText(
        new ol.style.Text({
          text: String(name),
          font: '11px Arial',
          fill: new ol.style.Fill({ color: '#2b2b2b' }),
          stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
          placement: 'line'
        })
      );
    }

    return style;
  }


  const roadsLayer = new ol.layer.VectorImage({
    source: new ol.source.Vector({
      url: './resources/shapefiles/Roads.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,              // starts off
    title: 'roads',
    style: roadStyle
  });

  

  // ---- Point layers (filterable) ----
  const styleIcons = {
    sandDam:   new ol.style.Icon({ src: './resources/icons/icon-yellow.png', scale: 0.3, anchor: [0.5,0.5] }),
    garden:    new ol.style.Icon({ src: './resources/icons/icon-green.png',  scale: 0.3 }),
    waterPoint:new ol.style.Icon({ src: './resources/icons/icon-lblue.png',  scale: 0.3 }),
    woodlot:   new ol.style.Icon({ src: './resources/icons/tree.png',        scale: 0.12 }),
    gabion:    new ol.style.Icon({ src: './resources/icons/icon-white.png',  scale: 0.3 }),
    borehole:  new ol.style.Icon({ src: './resources/icons/borehole.png',    scale: 0.1 })
  };

  const filterState = { district: '', ward: '', search: '' };

  const sandDams   = makePointLayer({ url: './resources/shapefiles/sandDams.geojson',    title: 'sandDams',   icon: styleIcons.sandDam });
  const waterPoints= makePointLayer({ url: './resources/shapefiles/WaterPoints.geojson', title: 'waterPoints',icon: styleIcons.waterPoint });
  const boreholes  = makePointLayer({ url: './resources/shapefiles/boreholes.geojson',   title: 'boreholes',  icon: styleIcons.borehole });
  const gardens    = makePointLayer({ url: './resources/shapefiles/gardens.geojson',     title: 'gardens',    icon: styleIcons.garden });
  const woodlots   = makePointLayer({ url: './resources/shapefiles/Woodlots.geojson',    title: 'woodlots',   icon: styleIcons.woodlot });
  const gabions    = makePointLayer({ url: './resources/shapefiles/gabions.geojson',     title: 'gabions',    icon: styleIcons.gabion });

  const thematicGroup = new ol.layer.Group({
    layers: [zimbabweBoundary,
       districtsLayer,
      wardsLayer,
      roadsLayer,
      gardens,
      waterPoints,
      sandDams,
      gabions, 
      woodlots, 
      boreholes]
  });
  map.addLayer(thematicGroup);

  // ---- Base layer radio logic ----
  const baseRadios = $$('input[name=baseLayerRadioButton]');
  baseRadios.forEach(r =>
    r.addEventListener('change', () => {
      baseMapsLayerGroup.getLayers().forEach(l => l.setVisible(l.get('title') === r.value));
      saveSessionState();
    })
  );

  // ---- Thematic layer checkbox logic ----
  const layerCheckboxes = $$('input[name=rasterLayerCheckBox]');
  layerCheckboxes.forEach(cb => cb.checked = false);
  layerCheckboxes.forEach(cb =>
    cb.addEventListener('change', () => {
      const want = cb.checked;
      const title = cb.value;
      thematicGroup.getLayers().forEach(l => { if (l.get('title') === title) l.setVisible(want); });
      saveSessionState();
    })
  );

  // ---- Filtering: populate dropdowns when point layers ready ----
  const pointLayers = [sandDams, waterPoints, boreholes, gardens, woodlots, gabions];
  Promise.all(pointLayers.map(waitForVectorReady)).then(() => {
    const values = collectUniqueValues(pointLayers, ['District', 'Ward']);
    fillSelect(districtSel, values['District']);
    fillSelect(wardSel, values['Ward']);
  });

  districtSel.addEventListener('change', () => { filterState.district = districtSel.value; applyFilters(); saveSessionState(); });
  wardSel.addEventListener('change', () => { filterState.ward = wardSel.value; applyFilters(); saveSessionState(); });
  searchInput.addEventListener('input', () => { filterState.search = searchInput.value.trim(); applyFilters(); });

  clearBtn.addEventListener('click', () => {
    districtSel.value = ''; wardSel.value = ''; searchInput.value = '';
    filterState.district = filterState.ward = filterState.search = '';
    applyFilters();
    showToast('Filters cleared');
    saveSessionState();
  });

  // ---- Save / Restore ----
  saveBtn.addEventListener('click', () => { persistState(); showToast('Saved'); });
  restoreBtn.addEventListener('click', () => {
    const ok = restoreState();
    showToast(ok ? 'Restored' : 'Nothing saved yet');
  });

  // ---- Export ----
  exportBtn.addEventListener('click', () => exportFiltered(pointLayers));

  // ---- Click handling: details modal/new tab + coords shortcuts ----
  map.on('singleclick', (e) => {
    const oe = e.originalEvent;
    if (oe && oe.ctrlKey) { showGeographicCoords(e); return; }
    if (oe && oe.shiftKey) { showProjectedCoords(e); return; }

    let hit = map.forEachFeatureAtPixel(
      e.pixel,
      (feature, layer) => {
        if (!layer || !layer.get('title')) return;
        if (!isPointLayerTitle(layer.get('title'))) return;
        return { feature, layerTitle: layer.get('title') };
      },
      { hitTolerance: 6 }
    );

    if (!hit) { popup.setPosition(undefined); return; }

    if (oe && oe.altKey) {
      openFeatureInNewTab(hit.feature);
      return;
    }
    openFeatureModal(hit.feature);
  });

  // ---- Helpers ----

  function makePointLayer({ url, title, icon }) {
    const iconStyle = new ol.style.Style({ image: icon });
    return new ol.layer.VectorImage({
      source: new ol.source.Vector({ url, format: new ol.format.GeoJSON() }),
      title,
      visible: false,
      renderMode: 'image',
      style: (feature) => (passesFilters(feature) ? iconStyle : null)
    });
  }

  function labelStyle(feature, fontPx) {
    const name = feature.get('Names') || feature.get('Name');
    if (!name) return null;
    return new ol.style.Style({
      text: new ol.style.Text({
        text: String(name),
        font: `${fontPx}px Arial`,
        fill: new ol.style.Fill({ color: '#000' }),
        stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
        textAlign: 'center'
      })
    });
  }

  function wardFillStyle(feature) {
    const v = Number(feature.get('MEAN_1'));
    let color = [255, 255, 0, 0.35];
    if (!isNaN(v)) {
      if (v >= 8) color = [255, 0, 0, 0.35];
      else if (v <= 3) color = [0, 255, 0, 0.35];
    }
    return new ol.style.Style({
      fill: new ol.style.Fill({ color }),
      stroke: new ol.style.Stroke({ color: '#222', width: 1 })
    });
  }

  function passesFilters(feature) {
    const d = clean(feature.get('District'));
    const w = clean(feature.get('Ward'));
    const nm = clean(feature.get('Names') || feature.get('Name'));

    if (filterState.district && clean(filterState.district) !== d) return false;
    if (filterState.ward && clean(filterState.ward) !== w) return false;
    if (filterState.search && nm && !nm.includes(clean(filterState.search))) return false;
    if (filterState.search && !nm) return false;
    return true;

    function clean(v){ return (v ?? '').toString().trim().toLowerCase(); }
  }

  function isPointLayerTitle(t) {
    return ['sandDams','waterPoints','boreholes','gardens','woodlots','gabions'].includes(t);
  }

  function waitForVectorReady(layer) {
    return new Promise((resolve) => {
      const src = layer.getSource();
      if ((src.getFeatures && src.getFeatures().length > 0)) return resolve();
      const check = () => {
        if (src.getFeatures && src.getFeatures().length > 0) {
          src.un('change', check);
          resolve();
        }
      };
      src.on('change', check);
      if (src.once) src.once('featuresloadend', () => resolve());
    });
  }

  function collectUniqueValues(layers, fields) {
    const out = Object.fromEntries(fields.map(f => [f, new Set()]));
    const push = (f, val) => val != null && String(val).trim() && out[f].add(String(val));
    layers.forEach(l => {
      const src = l.getSource();
      (src.getFeatures() || []).forEach(ft => fields.forEach(f => push(f, ft.get(f))));
    });
    return Object.fromEntries(fields.map(f => [f, Array.from(out[f]).sort((a,b)=>a.localeCompare(b))]));
  }

  function fillSelect(selectEl, values) {
    const cur = selectEl.value;
    selectEl.innerHTML = `<option value="">All ${selectEl === districtSel ? 'districts' : 'wards'}</option>`;
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      selectEl.appendChild(opt);
    });
    if (values.includes(cur)) selectEl.value = cur;
  }

  function applyFilters() { pointLayers.forEach(l => l.changed()); }

  function showGeographicCoords(e) {
    popup.setPosition(e.coordinate);
    const coord4326 = ol.proj.transform(e.coordinate, 'EPSG:3857', 'EPSG:4326');
    const hdms = ol.coordinate.toStringHDMS(coord4326, 2);
    popupEl.innerHTML = `Lat/Lon: ${hdms}<br>Zoom: ${map.getView().getZoom().toFixed(1)}`;
  }
  function showProjectedCoords(e) {
    popup.setPosition(e.coordinate);
    const xy = ol.coordinate.toStringXY(e.coordinate, 0);
    popupEl.innerHTML = `X/Y: ${xy}<br>Zoom: ${map.getView().getZoom().toFixed(1)}`;
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 1500);
  }

  // ---- Export filtered features ----
  function exportFiltered(layers) {
    const format = new ol.format.GeoJSON();
    const out = [];
    layers.forEach(l => {
      if (!l.getVisible()) return;
      const feats = l.getSource().getFeatures().filter(passesFilters).map(f => {
        const c = f.clone();
        const g = c.getGeometry();
        if (g && g.transform) g.transform('EPSG:3857', 'EPSG:4326');
        return c;
      });
      out.push(...feats);
    });
    if (!out.length) { showToast('Nothing to export'); return; }
    const geojson = format.writeFeaturesObject(out, { featureProjection: 'EPSG:4326', decimals: 6 });
    downloadJSON(geojson, `geohub_export_${new Date().toISOString().slice(0,10)}.geojson`);
  }

  function downloadJSON(obj, filename){
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Save/Restore state (localStorage) ----
  const STATE_KEY = 'geohub_state_v1';

  function persistState() {
    const view = map.getView();
    const base = baseMapsLayerGroup.getLayers().getArray().find(l => l.getVisible());
    const visible = thematicGroup.getLayers().getArray()
      .filter(l => l.getVisible())
      .map(l => l.get('title'));

    const state = {
      view: { center: view.getCenter(), zoom: view.getZoom(), rotation: view.getRotation() },
      base: base ? base.get('title') : 'OSMStand',
      visibleLayers: visible,
      filters: { ...filterState }
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  function saveSessionState(){ persistState(); }

  function restoreState() {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return false;
    const state = JSON.parse(raw);

    const view = map.getView();
    if (state.view) {
      view.setCenter(state.view.center);
      view.setZoom(state.view.zoom);
      view.setRotation(state.view.rotation || 0);
    }

    if (state.base) {
      baseMapsLayerGroup.getLayers().forEach(l => l.setVisible(l.get('title') === state.base));
      baseRadios.forEach(r => r.checked = (r.value === state.base));
    }

    const visibleSet = new Set(state.visibleLayers || []);
    thematicGroup.getLayers().forEach(l => l.setVisible(visibleSet.has(l.get('title'))));
    layerCheckboxes.forEach(cb => cb.checked = visibleSet.has(cb.value));

    if (state.filters) {
      filterState.district = state.filters.district || '';
      filterState.ward = state.filters.ward || '';
      filterState.search = state.filters.search || '';
      districtSel.value = filterState.district;
      wardSel.value = filterState.ward;
      searchInput.value = filterState.search;
      applyFilters();
    }
    return true;
  }

  // Try restoring once on load
  restoreState();

  // ===== Feature Details (Modal & New Tab) =====

  // Where images live by default and the extension to assume when we construct URLs
  const IMAGE_BASE_DIR = './resources/images/dams/';
  const IMAGE_EXT = '.jpg';

  // Prefer your exact field first, then common variants
  const IMAGE_KEYS = [
    'imgUrl', 'imgURL', 'IMGURL',   // your field variants
    'Picture','picture','Photo','photo','Image','image','Img','img',
    'ImageURL','image_url','URL','url','Link','link','PIC_URL','pic_url'
  ];

  function getImageUrlFromFeature(ft){
    // 1) Direct attribute value if provided
    for (const k of IMAGE_KEYS){
      const v = ft.get(k);
      if (v && String(v).trim()) return String(v).trim();
    }
    // 2) Otherwise, construct from the name (e.g., "Asinatheni 2" -> "./resources/images/dams/Asinatheni%202.jpg")
    const name = ft.get('Names') || ft.get('Name');
    if (name && String(name).trim()){
      const file = encodeURIComponent(String(name).trim()) + IMAGE_EXT;
      return IMAGE_BASE_DIR + file;
    }
    // 3) Nothing usable
    return null;
  }

  function buildAttributesTable(ft){
    const preferred = ['Names','Name','Project','Type','Program','District','Ward','Source','Village','Longitude','Latitude'];
    const rows = [];

    preferred.forEach(k => {
      const v = ft.get(k);
      if (v != null && String(v).trim()) rows.push([k, v]);
    });

    const seen = new Set(rows.map(([k]) => k));
    Object.keys(ft.getProperties()).sort().forEach(k => {
      if (k === 'geometry' || seen.has(k)) return;
      const v = ft.get(k);
      if (v != null && String(v).trim()) rows.push([k, v]);
    });

    if (!rows.length) return '<em>No attributes</em>';

    const html = rows.map(([k, v]) =>
      `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`).join('');
    return `<table class="fm-table">${html}</table>`;
  }

  function openFeatureModal(ft){
    const modal = document.getElementById('feature-modal');
    const body = document.getElementById('fm-body');
    const btnClose = document.getElementById('fm-close');
    const btnOpenTab = document.getElementById('fm-open-tab');

    const title = ft.get('Names') || ft.get('Name') || 'Feature Details';
    document.getElementById('fm-title').textContent = title;

    const imgUrl = getImageUrlFromFeature(ft);
    const imgHtml = imgUrl
      ? `<img class="fm-image" src="${escapeAttr(imgUrl)}" alt="${escapeAttr(title)}" onerror="this.style.display='none'">`
      : `<div class="fm-image" style="display:grid;place-items:center;color:#999;">No image</div>`;

    body.innerHTML = `
      <div class="fm-grid">
        <div>${imgHtml}</div>
        <div>${buildAttributesTable(ft)}</div>
      </div>
    `;

    modal.classList.remove('hidden');

    const close = () => modal.classList.add('hidden');
    btnClose.onclick = close;
    modal.querySelector('.modal-backdrop').onclick = close;
    window.addEventListener('keydown', escClose, { once: true });
    function escClose(ev){ if (ev.key === 'Escape') close(); }

    btnOpenTab.onclick = () => openFeatureInNewTab(ft);
  }

  function openFeatureInNewTab(ft){
    const w = window.open('', '_blank');
    if (!w) { showToast('Popup blocked. Please allow popups.'); return; }
    w.document.write(buildFeaturePageHtml(ft));
    w.document.close();
  }

  function buildFeaturePageHtml(ft){
    const title = escapeHtml(ft.get('Names') || ft.get('Name') || 'Feature Details');
    const img = getImageUrlFromFeature(ft);
    const table = buildAttributesTable(ft);

    const css = `
      body{font-family: Poppins, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin:0; background:#fafafa;}
      header{background:#228B22;color:#fff;padding:16px 20px;}
      main{padding:20px; max-width: 1040px; margin: 0 auto;}
      .hero{display:grid;grid-template-columns: 420px 1fr; gap:16px;align-items:start;}
      .img{width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:12px; background:#f2f2f2; border:1px solid #eee;}
      table{width:100%; border-collapse:collapse; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 8px rgba(0,0,0,.05);}
      th,td{padding:10px 12px;border-bottom:1px solid #eee;text-align:left;vertical-align:top;font-size:14px;}
      th{width:200px;color:#444;font-weight:600;background:#fbfbfb;}
      @media (max-width: 780px){ .hero{grid-template-columns: 1fr;} th{width:150px;} }
    `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;500;700&display=swap" rel="stylesheet">
  <style>${css}</style>
</head>
<body>
<header><h2>${title}</h2></header>
<main>
  <section class="hero">
    <div>${img ? `<img class="img" src="${escapeAttr(img)}" alt="${title}" onerror="this.style.display='none'">` : `<div class="img" style="display:grid;place-items:center;color:#999;">No image</div>`}</div>
    <div>${table}</div>
  </section>
</main>
</body>
</html>`;
  }

  // Basic escaping helpers
  function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g, '&quot;'); }
}
