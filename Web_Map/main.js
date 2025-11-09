// main.js
window.addEventListener('DOMContentLoaded', init);

function init() {
  // ---------- BASIC MAP SETUP ----------
  const extentMap = [3042818.232, -2025209.466, 3500000, -1796054.020];

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

  const baseMapsLayerGroup = new ol.layer.Group({
    layers: [osmBase, cartoLight, cartoDark, openTopo]
  });

  const map = new ol.Map({
    target: 'js-map',
    layers: [baseMapsLayerGroup],
    view: new ol.View({
      extent: extentMap,
      center: [3801452, -1899775],
      zoom: 5,
      maxZoom: 18,
      minZoom: 5
    }),
    controls: ol.control
      .defaults({ attribution: false })
      .extend([attributionControl, scaleLineControl, zoomSliderControl, fullScreenControl, zoomToExtentControl])
  });

  // ---------- SHORTCUTS & UI REFS ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const sidebar = $('#sidebar');
  const searchInput = $('#search-input');
  const reserveSel = $('#filter-reserve');
  const filterLayerDyn = $('#filter-layer-dyn');
  const filterFieldDyn = $('#filter-field-dyn');
  const filterValueDyn = $('#filter-value-dyn');
  const clearBtn = $('#clear-filters');
  const saveBtn = $('#save-state');
  const restoreBtn = $('#restore-state');
  const exportBtn = $('#export-geojson');
  const toast = $('#toast');

  $('#sidebar-toggle').addEventListener('click', () => sidebar.classList.toggle('collapsed'));

  // popup for coords
  const popupEl = $('#popup-container');
  const popup = new ol.Overlay({ element: popupEl });
  map.addOverlay(popup);

  // ---------- STYLES ----------
  function roadStyle(feature) {
    const typeRaw = feature.get('Type');
    const type = typeRaw ? String(typeRaw).toLowerCase() : '';
    const name = feature.get('Name') || '';

    let strokeColor = '#8B4513';
    let strokeWidth = 1;
    let lineDash = undefined;

    if (type === 'national road') {
      strokeColor = '#5C2E0E';
      strokeWidth = 2.2;
    } else if (type === 'district access road') {
      strokeColor = '#754022';
      strokeWidth = 1.5;
    } else if (type === 'community access roads') {
      strokeColor = '#8B4513';
      strokeWidth = 1.2;
    } else if (type === 'park access road') {
      strokeColor = '#A35B2A';
      strokeWidth = 1.1;
    } else if (type === 'park feeder road') {
      strokeColor = '#C7824C';
      strokeWidth = 1;
    } else if (type === 'tracks') {
      strokeColor = '#E2BC8E';
      strokeWidth = 0.8;
    } else {
      strokeColor = '#8B4513';
      strokeWidth = 0.25;
      lineDash = [4, 4];
    }

    const style = new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: strokeColor,
        width: strokeWidth,
        lineDash: lineDash
      })
    });

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

  function campStyle(feature) {
    const name = feature.get('Name') || '';

    return new ol.style.Style({
      image: new ol.style.RegularShape({
        points: 3,
        radius: 10,
        rotation: Math.PI,
        fill: new ol.style.Fill({
          color: '#00552C'
        }),
        stroke: new ol.style.Stroke({
          color: '#ffffff',
          width: 1.5
        })
      }),
      text: name
        ? new ol.style.Text({
            text: String(name),
            font: '11px Arial',
            fill: new ol.style.Fill({ color: '#00552C' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
            offsetY: -18,
            textAlign: 'center'
          })
        : undefined
    });
  }

  function villageStyle(feature) {
    const name = feature.get('Name') || '';
    return new ol.style.Style({
      image: new ol.style.RegularShape({
        points: 4,
        radius: 4,
        angle: Math.PI / 4,
        fill: new ol.style.Fill({
          color: '#ff0000'
        }),
        stroke: new ol.style.Stroke({
          color: '#ffffff',
          width: 1.5
        })
      }),
      text: name
        ? new ol.style.Text({
            text: String(name),
            font: '11px Arial',
            fill: new ol.style.Fill({ color: '#2b2b2b' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
            offsetY: -18,
            textAlign: 'center'
          })
        : undefined
    });
  }

  function projectStyle(feature) {
    const name = feature.get('Name') || '';
    return new ol.style.Style({
      image: new ol.style.RegularShape({
        points: 3,
        radius: 10,
        rotation: Math.PI,
        fill: new ol.style.Fill({
          color: '#14e617ff'
        }),
        stroke: new ol.style.Stroke({
          color: '#ffffff',
          width: 1.5
        })
      }),
      text: name
        ? new ol.style.Text({
            text: String(name),
            font: '8px Arial',
            fill: new ol.style.Fill({ color: '#14e617ff' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
            offsetY: -18,
            textAlign: 'center'
          })
        : undefined
    });
  }

  function waterBoundaryStyle() {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: '#003366',
        width: 2
      }),
      fill: new ol.style.Fill({
        color: 'rgba(0, 102, 204, 0.3)'
      })
    });
  }

  // grey buildings with glow
  function buildingStyle() {
    return [
      new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'rgba(255, 255, 255, 0.5)',
          width: 6
        })
      }),
      new ol.style.Style({
        fill: new ol.style.Fill({
          color: 'rgba(128, 128, 128, 0.85)'
        }),
        stroke: new ol.style.Stroke({
          color: '#666666',
          width: 1.8
        })
      })
    ];
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

  // ---------- LAYERS ----------
  const wardsLayer = new ol.layer.VectorImage({
    source: new ol.source.Vector({
      url: './resources/shapefiles/Wards.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'wards',
    style: (feature) => [
      new ol.style.Style({
        fill: new ol.style.Fill({
          color: 'rgba(255,255,255,0.01)'
        }),
        stroke: new ol.style.Stroke({
          color: '#000000',
          width: 1.5,
          lineDash: [6, 6]
        })
      }),
      new ol.style.Style({
        text: new ol.style.Text({
          text: String(feature.get('Names') || feature.get('Name') || ''),
          font: '11px Arial',
          fill: new ol.style.Fill({ color: '#000' }),
          stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
          textAlign: 'center'
        })
      })
    ]
  });

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
      url: './resources/shapefiles/semiAridDistricts.geojson',
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

  const reserveLayer = new ol.layer.VectorImage({
    source: new ol.source.Vector({
      url: './resources/shapefiles/reserve.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: true,
    title: 'reserve',
    style: (feature) => [
      new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(255,255,255,0.35)' }),
        stroke: new ol.style.Stroke({ color: '#FF470D', width: 2 })
      }),
      labelStyle(feature, 12)
    ]
  });

  const roadsLayer = new ol.layer.VectorImage({
    source: new ol.source.Vector({
      url: './resources/shapefiles/Roads.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'roads',
    style: roadStyle
  });

  const campsLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: './resources/shapefiles/Camp.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: true,
    title: 'camps',
    style: campStyle
  });

  const waterBoundaryLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: './resources/shapefiles/Water.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'waterboundary',
    style: waterBoundaryStyle
  });

  const projectsLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: './resources/shapefiles/projects.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'projects',
    style: projectStyle
  });

  const villageLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: './resources/shapefiles/villages.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'villages',
    style: villageStyle
  });

  const buildingsLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: './resources/shapefiles/Homesteads.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'buildings',
    style: buildingStyle
  });

  // ---- Point-like icons ----
  const styleIcons = {
    garden: new ol.style.Icon({ src: './resources/icons/icon-green.png', scale: 0.3 }),
    waterPoint: new ol.style.Icon({ src: './resources/icons/icon-lblue.png', scale: 0.3 }),
    woodlot: new ol.style.Icon({ src: './resources/icons/tree.png', scale: 0.12 }),
    gabion: new ol.style.Icon({ src: './resources/icons/icon-white.png', scale: 0.3 }),
    borehole: new ol.style.Icon({ src: './resources/icons/borehole.png', scale: 0.1 })
  };

  // we use only RESERVE + SEARCH
  const filterState = { reserve: '', search: '' };

  const waterPoints = makePointLayer({
    url: './resources/shapefiles/WaterPoints.geojson',
      title: 'waterPoints',
      icon: styleIcons.waterPoint
  });
  const boreholes = makePointLayer({
    url: './resources/shapefiles/boreholes.geojson',
    title: 'boreholes',
    icon: styleIcons.borehole
  });
  const gardens = makePointLayer({
    url: './resources/shapefiles/gardens.geojson',
    title: 'gardens',
    icon: styleIcons.garden
  });
  const woodlots = makePointLayer({
    url: './resources/shapefiles/Woodlots.geojson',
    title: 'woodlots',
    icon: styleIcons.woodlot
  });
  const gabions = makePointLayer({
    url: './resources/shapefiles/gabions.geojson',
    title: 'gabions',
    icon: styleIcons.gabion
  });

  const thematicGroup = new ol.layer.Group({
    layers: [
      zimbabweBoundary,
      districtsLayer,
      wardsLayer,
      roadsLayer,
      villageLayer,
      campsLayer,
      buildingsLayer,
      reserveLayer,
      waterBoundaryLayer,
      gardens,
      waterPoints,
      projectsLayer,
      gabions,
      woodlots,
      boreholes
    ]
  });
  map.addLayer(thematicGroup);

  // ---------- BASE LAYER RADIO ----------
  const baseRadios = $$('input[name=baseLayerRadioButton]');
  baseRadios.forEach((r) =>
    r.addEventListener('change', () => {
      baseMapsLayerGroup.getLayers().forEach((l) => l.setVisible(l.get('title') === r.value));
      saveSessionState();
    })
  );

  // ---------- THEMATIC LAYER CHECKBOX ----------
  const layerCheckboxes = $$('input[name=rasterLayerCheckBox]');
  layerCheckboxes.forEach((cb) => (cb.checked = false));
  layerCheckboxes.forEach((cb) =>
    cb.addEventListener('change', () => {
      const want = cb.checked;
      const title = cb.value;
      thematicGroup
        .getLayers()
        .forEach((l) => {
          if (l.get('title') === title) l.setVisible(want);
        });
      saveSessionState();
    })
  );

  // ---------- POINT LAYERS LIST ----------
  const pointLayers = [projectsLayer, waterPoints, boreholes, campsLayer, woodlots, gabions];

  // populate RESERVE dropdown from point layers once loaded
  Promise.all(pointLayers.map(waitForVectorReady)).then(() => {
    const values = collectUniqueValues(pointLayers, ['Reserve']);
    fillReserveSelect(reserveSel, values['Reserve'] || []);
  });

  // ---------- SIMPLE FILTERS (RESERVE + SEARCH) ----------
  reserveSel.addEventListener('change', () => {
    filterState.reserve = reserveSel.value;
    applyFilters();
    applyDynamicFilter();
    saveSessionState();
  });

  searchInput.addEventListener('input', () => {
    filterState.search = searchInput.value.trim();
    applyFilters();
    applyDynamicFilter();
  });

  // ---------- DYNAMIC FILTER STATE ----------
  const dynamicFilter = {
    layerTitle: '',
    field: '',
    value: ''
  };

  // all vector/thematic layers to filter
  const allFilterableLayers = thematicGroup
    .getLayers()
    .getArray()
    .filter((l) => l.getSource && l.getSource().getFormat);

  // fill layer dropdown
  allFilterableLayers.forEach((l) => {
    const opt = document.createElement('option');
    opt.value = l.get('title');
    opt.textContent = l.get('title');
    filterLayerDyn.appendChild(opt);
  });

  filterLayerDyn.addEventListener('change', async () => {
    const title = filterLayerDyn.value;
    dynamicFilter.layerTitle = title;
    dynamicFilter.field = '';
    dynamicFilter.value = '';

    filterFieldDyn.innerHTML = '<option value="">Field…</option>';
    filterFieldDyn.disabled = true;
    filterValueDyn.innerHTML = '<option value="">Value…</option>';
    filterValueDyn.disabled = true;

    if (!title) {
      applyDynamicFilter();
      return;
    }

    const layer = allFilterableLayers.find((l) => l.get('title') === title);
    if (!layer) return;

    await waitForVectorReady(layer);
    const feats = layer.getSource().getFeatures();
    if (!feats.length) {
      applyDynamicFilter();
      return;
    }

    const firstProps = feats[0].getProperties();
    Object.keys(firstProps)
      .filter((k) => k !== 'geometry')
      .forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        filterFieldDyn.appendChild(opt);
      });

    filterFieldDyn.disabled = false;
    applyDynamicFilter();
  });

  filterFieldDyn.addEventListener('change', () => {
    const field = filterFieldDyn.value;
    dynamicFilter.field = field;
    dynamicFilter.value = '';

    filterValueDyn.innerHTML = '<option value="">Value…</option>';
    filterValueDyn.disabled = true;

    if (!field || !dynamicFilter.layerTitle) {
      applyDynamicFilter();
      return;
    }

    const layer = allFilterableLayers.find((l) => l.get('title') === dynamicFilter.layerTitle);
    if (!layer) return;

    const feats = layer.getSource().getFeatures();
    const vals = new Set();
    feats.forEach((ft) => {
      const v = ft.get(field);
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        vals.add(String(v));
      }
    });

    Array.from(vals)
      .sort()
      .forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        filterValueDyn.appendChild(opt);
      });

    filterValueDyn.disabled = false;
    applyDynamicFilter();
  });

  filterValueDyn.addEventListener('change', () => {
    dynamicFilter.value = filterValueDyn.value;
    applyDynamicFilter();
  });

  // ---------- WRAP LAYERS TO OBEY DYNAMIC FILTER ----------
  thematicGroup.getLayers().forEach((layer) => {
    const origStyle = layer.getStyle();
    const title = layer.get('title');
    if (!origStyle) return;

    layer.setStyle(function (feature, resolution) {
      if (!passesDynamicFilter(feature, title)) {
        return null;
      }
      if (typeof origStyle === 'function') {
        return origStyle.call(this, feature, resolution);
      }
      return origStyle;
    });
  });

  // ---------- CLEAR FILTERS ----------
  clearBtn.addEventListener('click', () => {
    reserveSel.value = '';
    filterState.reserve = '';
    searchInput.value = '';
    filterState.search = '';

    // dynamic
    filterLayerDyn.value = '';
    filterFieldDyn.innerHTML = '<option value="">Field…</option>';
    filterFieldDyn.disabled = true;
    filterValueDyn.innerHTML = '<option value="">Value…</option>';
    filterValueDyn.disabled = true;
    dynamicFilter.layerTitle = '';
    dynamicFilter.field = '';
    dynamicFilter.value = '';

    applyFilters();
    applyDynamicFilter();
    showToast('Filters cleared');
    saveSessionState();
  });

  // ---------- SAVE / RESTORE ----------
  saveBtn.addEventListener('click', () => {
    persistState();
    showToast('Saved');
  });
  restoreBtn.addEventListener('click', () => {
    const ok = restoreState();
    showToast(ok ? 'Restored' : 'Nothing saved yet');
  });

  // ---------- EXPORT (download only filtered layer) ----------
  exportBtn.addEventListener('click', () => {
    exportFilteredLayer();
  });

  // ---------- MAP CLICK HANDLING ----------
  map.on('singleclick', (e) => {
    const oe = e.originalEvent;
    if (oe && oe.ctrlKey) {
      showGeographicCoords(e);
      return;
    }
    if (oe && oe.shiftKey) {
      showProjectedCoords(e);
      return;
    }

    let hit = map.forEachFeatureAtPixel(
      e.pixel,
      (feature, layer) => {
        if (!layer || !layer.get('title')) return;
        if (!isPointLayerTitle(layer.get('title'))) return;
        return { feature, layerTitle: layer.get('title') };
      },
      { hitTolerance: 6 }
    );

    if (!hit) {
      popup.setPosition(undefined);
      return;
    }

    if (oe && oe.altKey) {
      openFeatureInNewTab(hit.feature);
      return;
    }
    openFeatureModal(hit.feature);
  });

  // ================ HELPERS ==================

  function makePointLayer({ url, title, icon }) {
    const iconStyle = new ol.style.Style({ image: icon });
    return new ol.layer.VectorImage({
      source: new ol.source.Vector({ url, format: new ol.format.GeoJSON() }),
      title,
      visible: false,
      renderMode: 'image',
      style: (feature) => (passesFilters(feature) && passesDynamicFilter(feature, title) ? iconStyle : null)
    });
  }

  function passesFilters(feature) {
    const r = clean(feature.get('Reserve') || feature.get('reserve'));
    const nm = clean(feature.get('Names') || feature.get('Name'));

    if (filterState.reserve) {
      if (r !== clean(filterState.reserve)) return false;
    }
    if (filterState.search) {
      if (!nm || !nm.includes(clean(filterState.search))) return false;
    }
    return true;

    function clean(v) {
      return (v ?? '').toString().trim().toLowerCase();
    }
  }

  function passesDynamicFilter(feature, layerTitle) {
    if (!dynamicFilter.layerTitle) return true;
    if (dynamicFilter.layerTitle !== layerTitle) return true;
    if (!dynamicFilter.field || !dynamicFilter.value) return true;

    const raw = feature.get(dynamicFilter.field);
    if (raw == null) return false;
    return String(raw).trim() === String(dynamicFilter.value).trim();
  }

  function applyFilters() {
    // only point layers use the simple reserve/search
    pointLayers.forEach((l) => l.changed());
  }

  function applyDynamicFilter() {
    thematicGroup.getLayers().forEach((l) => l.changed());
  }

  function isPointLayerTitle(t) {
    return ['projects', 'waterPoints', 'boreholes', 'camps', 'woodlots', 'gabions'].includes(t);
  }

  function waitForVectorReady(layer) {
    return new Promise((resolve) => {
      const src = layer.getSource();
      if (src.getFeatures && src.getFeatures().length > 0) return resolve();
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
    const out = Object.fromEntries(fields.map((f) => [f, new Set()]));
    const push = (f, val) => val != null && String(val).trim() && out[f].add(String(val));
    layers.forEach((l) => {
      const src = l.getSource();
      (src.getFeatures() || []).forEach((ft) => fields.forEach((f) => push(f, ft.get(f))));
    });
    return Object.fromEntries(fields.map((f) => [f, Array.from(out[f]).sort((a, b) => a.localeCompare(b))]));
  }

  function fillReserveSelect(selectEl, values) {
    selectEl.innerHTML = '<option value="">All reserves</option>';
    values.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
  }

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

  // ---------- EXPORT ONLY FILTERED LAYER ----------
  function exportFilteredLayer() {
    const layerTitle = dynamicFilter.layerTitle;
    if (!layerTitle) {
      showToast('Select a layer in the filter first.');
      return;
    }

    const layer = thematicGroup
      .getLayers()
      .getArray()
      .find((l) => l.get('title') === layerTitle);

    if (!layer || !layer.getSource) {
      showToast('Layer not found or not exportable.');
      return;
    }

    const feats = layer.getSource().getFeatures();
    const format = new ol.format.GeoJSON();

    const filtered = feats
      .filter((f) => {
        // only point layers also obey reserve/search
        const basicOK = isPointLayerTitle(layerTitle) ? passesFilters(f) : true;
        const dynOK = passesDynamicFilter(f, layerTitle);
        return basicOK && dynOK;
      })
      .map((f) => {
        const c = f.clone();
        const g = c.getGeometry();
        if (g && g.transform) g.transform('EPSG:3857', 'EPSG:4326');
        return c;
      });

    if (!filtered.length) {
      showToast('No features to export for this filter.');
      return;
    }

    const geojson = format.writeFeaturesObject(filtered, {
      featureProjection: 'EPSG:4326',
      decimals: 6
    });

    const filenameSafe = layerTitle.replace(/[^a-z0-9_-]/gi, '_');
    downloadJSON(geojson, `export_${filenameSafe}.geojson`);
    showToast('Layer exported');
  }

  function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- SAVE / RESTORE ----------
  const STATE_KEY = 'geohub_state_v1';

  function persistState() {
    const view = map.getView();
    const base = baseMapsLayerGroup.getLayers().getArray().find((l) => l.getVisible());
    const visible = thematicGroup
      .getLayers()
      .getArray()
      .filter((l) => l.getVisible())
      .map((l) => l.get('title'));

    const state = {
      view: { center: view.getCenter(), zoom: view.getZoom(), rotation: view.getRotation() },
      base: base ? base.get('title') : 'OSMStand',
      visibleLayers: visible,
      filters: {
        ...filterState,
        dynamic: { ...dynamicFilter }
      }
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  function saveSessionState() {
    persistState();
  }

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
      baseMapsLayerGroup.getLayers().forEach((l) => l.setVisible(l.get('title') === state.base));
      baseRadios.forEach((r) => (r.checked = r.value === state.base));
    }

    const visibleSet = new Set(state.visibleLayers || []);
    thematicGroup.getLayers().forEach((l) => l.setVisible(visibleSet.has(l.get('title'))));
    layerCheckboxes.forEach((cb) => (cb.checked = visibleSet.has(cb.value)));

    if (state.filters) {
      filterState.reserve = state.filters.reserve || '';
      filterState.search = state.filters.search || '';
      reserveSel.value = filterState.reserve;
      searchInput.value = filterState.search;

      if (state.filters.dynamic) {
        dynamicFilter.layerTitle = state.filters.dynamic.layerTitle || '';
        dynamicFilter.field = state.filters.dynamic.field || '';
        dynamicFilter.value = state.filters.dynamic.value || '';

        if (dynamicFilter.layerTitle) {
          filterLayerDyn.value = dynamicFilter.layerTitle;
        }
      }

      applyFilters();
      applyDynamicFilter();
    }
    return true;
  }

  // try to restore once
  restoreState();

  // ---------- FEATURE MODAL / PAGE ----------
  const IMAGE_BASE_DIR = './resources/images/dams/';
  const IMAGE_EXT = '.jpg';
  const IMAGE_KEYS = [
    'imgUrl',
    'imgURL',
    'IMGURL',
    'Picture',
    'picture',
    'Photo',
    'photo',
    'Image',
    'image',
    'Img',
    'img',
    'ImageURL',
    'image_url',
    'URL',
    'url',
    'Link',
    'link',
    'PIC_URL',
    'pic_url'
  ];

  function getImageUrlFromFeature(ft) {
    for (const k of IMAGE_KEYS) {
      const v = ft.get(k);
      if (v && String(v).trim()) return String(v).trim();
    }
    const name = ft.get('Names') || ft.get('Name');
    if (name && String(name).trim()) {
      const file = encodeURIComponent(String(name).trim()) + IMAGE_EXT;
      return IMAGE_BASE_DIR + file;
    }
    return null;
  }

  function buildAttributesTable(ft) {
    const preferred = [
      'Names',
      'Name',
      'Project',
      'Type',
      'Program',
      'District',
      'Ward',
      'Reserve',
      'Village',
      'Longitude',
      'Latitude'
    ];
    const rows = [];

    preferred.forEach((k) => {
      const v = ft.get(k);
      if (v != null && String(v).trim()) rows.push([k, v]);
    });

    const seen = new Set(rows.map(([k]) => k));
    Object.keys(ft.getProperties())
      .sort()
      .forEach((k) => {
        if (k === 'geometry' || seen.has(k)) return;
        const v = ft.get(k);
        if (v != null && String(v).trim()) rows.push([k, v]);
      });

    if (!rows.length) return '<em>No attributes</em>';

    const html = rows
      .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`)
      .join('');
    return `<table class="fm-table">${html}</table>`;
  }

  function openFeatureModal(ft) {
    const modal = document.getElementById('feature-modal');
    const body = document.getElementById('fm-body');
    const btnClose = document.getElementById('fm-close');
    const btnOpenTab = document.getElementById('fm-open-tab');

    const title = ft.get('Names') || ft.get('Name') || 'Feature Details';
    document.getElementById('fm-title').textContent = title;

    const imgUrl = getImageUrlFromFeature(ft);
    const imgHtml = imgUrl
      ? `<img class="fm-image" src="${escapeAttr(imgUrl)}" alt="${escapeAttr(
          title
        )}" onerror="this.style.display='none'">`
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
    window.addEventListener(
      'keydown',
      (ev) => {
        if (ev.key === 'Escape') close();
      },
      { once: true }
    );

    btnOpenTab.onclick = () => openFeatureInNewTab(ft);
  }

  function openFeatureInNewTab(ft) {
    const w = window.open('', '_blank');
    if (!w) {
      showToast('Popup blocked. Please allow popups.');
      return;
    }
    w.document.write(buildFeaturePageHtml(ft));
    w.document.close();
  }

  function buildFeaturePageHtml(ft) {
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
    <div>${
      img
        ? `<img class="img" src="${escapeAttr(img)}" alt="${title}" onerror="this.style.display='none'">`
        : `<div class="img" style="display:grid;place-items:center;color:#999;">No image</div>`
    }</div>
    <div>${table}</div>
  </section>
</main>
</body>
</html>`;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }
}
