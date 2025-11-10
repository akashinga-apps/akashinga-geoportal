// main.js
window.addEventListener('DOMContentLoaded', init);

function init() {
  // ---------- MAP BASE ----------
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

  // make map responsive to viewport changes (phones, tablets)
  function updateMapSize() {
    map.updateSize();
  }
  window.addEventListener('resize', updateMapSize);
  window.addEventListener('orientationchange', updateMapSize);

  // ---------- UI REFS ----------
  const $ = (s) => document.querySelector(s);
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

  const layersPanel = $('#layers-panel');
  const layersToggle = $('#layers-toggle');
  const layersClose = $('#layers-close');

  layersToggle.addEventListener('click', () => {
    layersPanel.classList.toggle('show');
  });
  layersClose.addEventListener('click', () => {
    layersPanel.classList.remove('show');
  });

  // popup overlay
  const popupEl = $('#popup-container');
  const popup = new ol.Overlay({ element: popupEl });
  map.addOverlay(popup);

  // ---------- FILTER STATE (needed by styles) ----------
  const filterState = { reserve: '', search: '' };
  const dynamicFilter = { layerTitle: '', field: '', value: '' };

  // these are declared early so style functions can call them
  function passesFilters(feature) {
    const clean = (v) => (v ?? '').toString().trim().toLowerCase();
    const r = clean(feature.get('Reserve') || feature.get('reserve'));
    const nm = clean(feature.get('Names') || feature.get('Name'));
    if (filterState.reserve && r !== clean(filterState.reserve)) return false;
    if (filterState.search && (!nm || !nm.includes(clean(filterState.search)))) return false;
    return true;
  }
  function passesDynamicFilter(feature, layerTitle) {
    if (!dynamicFilter.layerTitle) return true;
    if (dynamicFilter.layerTitle !== layerTitle) return true;
    if (!dynamicFilter.field || !dynamicFilter.value) return true;
    const raw = feature.get(dynamicFilter.field);
    if (raw == null) return false;
    return String(raw).trim() === String(dynamicFilter.value).trim();
  }

  // ---------- STYLES ----------
  function roadStyle(feature) {
    const typeRaw = feature.get('Type');
    const type = typeRaw ? String(typeRaw).toLowerCase() : '';
    const name = feature.get('Name') || '';
    let strokeColor = '#8B4513';
    let strokeWidth = 1;
    let lineDash;

    if (type === 'national road') {
      strokeColor = '#5C2E0E'; strokeWidth = 2.2;
    } else if (type === 'district access road') {
      strokeColor = '#754022'; strokeWidth = 1.5;
    } else if (type === 'community access roads') {
      strokeColor = '#8B4513'; strokeWidth = 1.2;
    } else if (type === 'park access road') {
      strokeColor = '#A35B2A'; strokeWidth = 1.1;
    } else if (type === 'park feeder road') {
      strokeColor = '#C7824C'; strokeWidth = 1;
    } else if (type === 'tracks') {
      strokeColor = '#E2BC8E'; strokeWidth = 0.8;
    } else {
      strokeColor = '#8B4513'; strokeWidth = 0.25; lineDash = [4,4];
    }

    const style = new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: strokeColor,
        width: strokeWidth,
        lineDash
      })
    });

    if (name) {
      style.setText(new ol.style.Text({
        text: String(name),
        font: '11px Arial',
        fill: new ol.style.Fill({ color: '#2b2b2b' }),
        stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
        placement: 'line'
      }));
    }
    return style;
  }

  function campStyle(feature) {
    const name = feature.get('Name') || '';
    return (passesFilters(feature) && passesDynamicFilter(feature, 'camps'))
      ? new ol.style.Style({
          image: new ol.style.RegularShape({
            points: 3,
            radius: 10,
            rotation: Math.PI,
            fill: new ol.style.Fill({ color: '#FF8C00' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 1.5 })
          }),
          text: name ? new ol.style.Text({
            text: String(name),
            font: '11px Arial',
            fill: new ol.style.Fill({ color: '#2b2b2b' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
            offsetY: -18,
            textAlign: 'center'
          }) : undefined
        })
      : null;
  }

  function villageStyle(feature) {
    // respect existing filters
    if (!passesFilters(feature) || !passesDynamicFilter(feature, 'villages')) return null;

    const name = feature.get('Name') || feature.get('NAME') || '';

    return new ol.style.Style({
      image: new ol.style.RegularShape({
        points: 4,
        radius: 4,
        angle: Math.PI / 4,
        fill: new ol.style.Fill({ color: '#ff0000' }),
        stroke: new ol.style.Stroke({ color: '#ffffff', width: 1.5 })
      }),
      text: name
        ? new ol.style.Text({
            text: String(name),
            font: '11px Arial',
            fill: new ol.style.Fill({ color: '#ff0000' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
            offsetY: -16,
            textAlign: 'center'
          })
        : undefined
    });
  }


  function projectStyle(feature) {
    const name = feature.get('Name') || '';
    return (passesFilters(feature) && passesDynamicFilter(feature, 'projects'))
      ? new ol.style.Style({
          image: new ol.style.RegularShape({
            points: 3,
            radius: 10,
            rotation: Math.PI,
            fill: new ol.style.Fill({ color: '#14e617ff' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 1.5 })
          }),
          text: name ? new ol.style.Text({
            text: String(name),
            font: '8px Arial',
            fill: new ol.style.Fill({ color: '#2b2b2b' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
            offsetY: -18,
            textAlign: 'center'
          }) : undefined
        })
      : null;
  }

  function waterBoundaryStyle() {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({ color: '#003366', width: 0 }),
      fill: new ol.style.Fill({ color: 'rgba(0, 102, 204, 0.3)' })
    });
  }

  function buildingStyle() {
    return [
      new ol.style.Style({
        stroke: new ol.style.Stroke({ color: 'rgba(255, 255, 255, 0.5)', width: 6 })
      }),
      new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(128, 128, 128, 0.85)' }),
        stroke: new ol.style.Stroke({ color: '#666666', width: 1.8 })
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

  // ---- NEW: waterpoint style by TYPE ----
  const waterpointStyleCache = {};
  function waterPointStyle(feature) {
    if (!passesFilters(feature) || !passesDynamicFilter(feature, 'waterPoints')) return null;

    const rawType = feature.get('TYPE') || feature.get('Type') || '';
    const type = String(rawType).trim().toLowerCase();

    let key;
    if (type.includes('borehole')) key = 'borehole';
    else if (type.includes('deep')) key = 'deep well';
    else if (type.includes('shallow')) key = 'shallow well';
    else if (type.includes('spring')) key = 'spring';
    else if (type.includes('sand')) key = 'sand abstraction';
    else if (type.includes('dam')) key = 'dam';
    else if (type.includes('river')) key = 'river';
    else if (type.includes('artesian') || type.includes('artsian')) key = 'artesian';
    else if (type.includes('rain')) key = 'rain water';
    else key = 'other';

    const colorByType = {
      'borehole': '#0074D9',
      'deep well': '#85144b',
      'shallow well': '#2ECC40',
      'spring': '#FF851B',
      'sand abstraction': '#B10DC9',
      'dam': '#FF4136',
      'river': '#7FDBFF',
      'artesian': '#3D9970',
      'rain water': '#39CCCC',
      'other': '#AAAAAA'
    };

    const fillColor = colorByType[key] || colorByType['other'];

    if (!waterpointStyleCache[key]) {
      waterpointStyleCache[key] = new ol.style.Style({
        image: new ol.style.Circle({
          radius: 3,
          fill: new ol.style.Fill({ color: fillColor }),
          stroke: new ol.style.Stroke({ color: '#ffffff', width: 1 })
        })
      });
    }
    return waterpointStyleCache[key];
  }

  // ---- OTHER point styles in same pattern ----
  function boreholeStyle(feature) {
    return (passesFilters(feature) && passesDynamicFilter(feature, 'boreholes'))
      ? new ol.style.Style({
          image: new ol.style.Circle({
            radius: 5,
            fill: new ol.style.Fill({ color: '#0052cc' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 1 })
          })
        })
      : null;
  }

  function gardenStyle(feature) {
    return (passesFilters(feature) && passesDynamicFilter(feature, 'gardens'))
      ? new ol.style.Style({
          image: new ol.style.RegularShape({
            points: 4,
            radius: 6,
            angle: Math.PI / 4,
            fill: new ol.style.Fill({ color: '#1C4701' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 1 })
          })
        })
      : null;
  }

  function woodlotStyle(feature) {
    return (passesFilters(feature) && passesDynamicFilter(feature, 'woodlots'))
      ? new ol.style.Style({
          image: new ol.style.RegularShape({
            points: 5,
            radius: 6,
            fill: new ol.style.Fill({ color: '#0a7c3a' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 1 })
          })
        })
      : null;
  }

  function gabionStyle(feature) {
    return (passesFilters(feature) && passesDynamicFilter(feature, 'gabions'))
      ? new ol.style.Style({
          image: new ol.style.Circle({
            radius: 4,
            fill: new ol.style.Fill({ color: '#cccccc' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 1 })
          })
        })
      : null;
  }


    // park polygons – from WDPA-like dataset
  function parksStyle(feature) {
    const name = feature.get('NAME') || feature.get('Orig_Name') || feature.get('ORIG_NAME');
    return [
      new ol.style.Style({
        fill: new ol.style.Fill({
          color: '#0f5e19'  // soft green
        }),
        stroke: new ol.style.Stroke({
          color: '#2e8b57',
          width: 1.2
        })
      }),
      name
        ? new ol.style.Style({
            text: new ol.style.Text({
              text: String(name),
              font: '11px Arial',
              fill: new ol.style.Fill({ color: '#06310b' }),
              stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.95)', width: 3 })
            })
          })
        : null
    ].filter(Boolean);
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
        fill: new ol.style.Fill({ color: 'rgba(255,255,255,0.01)' }),
        stroke: new ol.style.Stroke({ color: '#000', width: 1.5, lineDash: [6,6] })
      }),
      labelStyle(feature, 11)
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
    visible: true,
    title: 'villages',
    style: villageStyle
  });

  const buildingsLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: './resources/shapefiles/Homesteads.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: true,
    title: 'buildings',
    style: buildingStyle
  });

  const campsLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: './resources/shapefiles/Camp.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: true,
    title: 'true',
    style: campStyle
  });

  // ---- NEW explicit point layers ----
  const waterPointsLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: './resources/shapefiles/WaterPoints.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'waterPoints',
    style: waterPointStyle
  });

  const boreholesLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: './resources/shapefiles/boreholes.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'boreholes',
    style: boreholeStyle
  });

  const gardensLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: './resources/shapefiles/gardens.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'gardens',
    style: gardenStyle
  });

  const woodlotsLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: './resources/shapefiles/Woodlots.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'woodlots',
    style: woodlotStyle
  });

  const gabionsLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      url: './resources/shapefiles/gabions.geojson',
      format: new ol.format.GeoJSON()
    }),
    visible: false,
    title: 'gabions',
    style: gabionStyle
  });
  const parksLayer = new ol.layer.VectorImage({
    source: new ol.source.Vector({
      url: './resources/shapefiles/Parks.geojson',   // <-- make sure filename matches yours
      format: new ol.format.GeoJSON()
    }),
    visible: true,
    title: 'parks',
    style: parksStyle
  });


  const thematicGroup = new ol.layer.Group({
    layers: [
      waterBoundaryLayer,
      zimbabweBoundary,
      parksLayer,
      districtsLayer,
      reserveLayer,
      wardsLayer,
      roadsLayer,
      villageLayer,
      buildingsLayer,
      gardensLayer,
      waterPointsLayer,
      projectsLayer,
      campsLayer,
      gabionsLayer,
      woodlotsLayer,
      boreholesLayer
    ]
  });
  map.addLayer(thematicGroup);

  // ---------- LAYERS PANEL JS ----------
  document.querySelectorAll('.lp-header').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const body = document.getElementById(target);
      const open = body.classList.contains('show');
      if (open) {
        body.classList.remove('show');
        btn.classList.remove('is-open');
      } else {
        body.classList.add('show');
        btn.classList.add('is-open');
      }
    });
  });

  // base layer pills
  document.querySelectorAll('.layer-pill[data-type="base"]').forEach((pill) => {
    pill.addEventListener('click', () => {
      const wanted = pill.dataset.layer;
      document.querySelectorAll('.layer-pill[data-type="base"]').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      baseMapsLayerGroup.getLayers().forEach((l) => l.setVisible(l.get('title') === wanted));
      saveSessionState();
    });
  });

  // thematic toggle pills
  document.querySelectorAll('.layer-pill[data-type="thematic"]').forEach((pill) => {
    pill.addEventListener('click', () => {
      const title = pill.dataset.layer;
      const layer = findLayerByTitle(thematicGroup, title);
      if (!layer) return;
      const willShow = !layer.getVisible();
      layer.setVisible(willShow);
      pill.classList.toggle('active', willShow);
      saveSessionState();
    });
  });

  // ---------- POINT LAYERS LIST (for reserve dropdown) ----------
  const pointLayers = [projectsLayer, waterPointsLayer, boreholesLayer, campsLayer, woodlotsLayer, gabionsLayer, villageLayer];

  Promise.all(pointLayers.map(waitForVectorReady)).then(() => {
    const values = collectUniqueValues(pointLayers, ['Reserve']);
    fillReserveSelect(reserveSel, values['Reserve'] || []);
  });

  // ---------- SIMPLE FILTERS ----------
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

  // ---------- DYNAMIC FILTER ----------
  const allFilterableLayers = thematicGroup.getLayers().getArray().filter((l) => l.getSource && l.getSource().getFormat);

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
    if (!feats.length) { applyDynamicFilter(); return; }

    const firstProps = feats[0].getProperties();
    Object.keys(firstProps).filter((k) => k !== 'geometry').forEach((f) => {
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
      if (v !== undefined && v !== null && String(v).trim() !== '') vals.add(String(v));
    });
    Array.from(vals).sort().forEach((v) => {
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

  // ---------- CLEAR ----------
  clearBtn.addEventListener('click', () => {
    reserveSel.value = '';
    filterState.reserve = '';
    searchInput.value = '';
    filterState.search = '';
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

  // ---------- EXPORT ----------
  exportBtn.addEventListener('click', () => {
    exportFilteredLayer();
  });

  // ---------- MAP CLICK ----------
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

  // ---------- APPLY FUNCTIONS ----------
  function applyFilters() {
    // force point layers to re-eval styles
    pointLayers.forEach((l) => l.changed());
  }
  function applyDynamicFilter() {
    thematicGroup.getLayers().forEach((l) => l.changed());
  }

  function isPointLayerTitle(t) {
    return ['projects', 'waterPoints', 'boreholes', 'camps', 'woodlots', 'gabions', 'villages', 'gardens'].includes(t);
  }

  // ---------- HELPERS ----------
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
    layers.forEach((l) => {
      const src = l.getSource();
      (src.getFeatures() || []).forEach((ft) => {
        fields.forEach((f) => {
          const v = ft.get(f);
          if (v != null && String(v).trim()) out[f].add(String(v));
        });
      });
    });
    return Object.fromEntries(fields.map((f) => [f, Array.from(out[f]).sort((a,b)=>a.localeCompare(b))]));
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
    setTimeout(() => toast.classList.add('hidden'), 1600);
  }

  function findLayerByTitle(group, title) {
    return group.getLayers().getArray().find((l) => l.get('title') === title);
  }

  // EXPORT
  function exportFilteredLayer() {
    const layerTitle = dynamicFilter.layerTitle;
    if (!layerTitle) { showToast('Select a layer in the filter first.'); return; }
    const layer = findLayerByTitle(thematicGroup, layerTitle);
    if (!layer || !layer.getSource) { showToast('Layer not found.'); return; }

    const feats = layer.getSource().getFeatures();
    const format = new ol.format.GeoJSON();

    const filtered = feats
      .filter((f) => {
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

    if (!filtered.length) { showToast('No features to export.'); return; }

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

  // SAVE / RESTORE
  const STATE_KEY = 'geohub_state_v1';
  function persistState() {
    const view = map.getView();
    const baseLayer = baseMapsLayerGroup.getLayers().getArray().find((l) => l.getVisible());
    const visibleLayers = thematicGroup.getLayers().getArray().filter((l) => l.getVisible()).map((l) => l.get('title'));

    const state = {
      view: { center: view.getCenter(), zoom: view.getZoom(), rotation: view.getRotation() },
      base: baseLayer ? baseLayer.get('title') : 'OSMStand',
      visibleLayers,
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
      document.querySelectorAll('.layer-pill[data-type="base"]').forEach((p) => {
        p.classList.toggle('active', p.dataset.layer === state.base);
      });
    }

    const visibleSet = new Set(state.visibleLayers || []);
    thematicGroup.getLayers().forEach((l) => l.setVisible(visibleSet.has(l.get('title'))));
    document.querySelectorAll('.layer-pill[data-type="thematic"]').forEach((p) => {
      p.classList.toggle('active', visibleSet.has(p.dataset.layer));
    });

    if (state.filters) {
      filterState.reserve = state.filters.reserve || '';
      filterState.search = state.filters.search || '';
      reserveSel.value = filterState.reserve;
      searchInput.value = filterState.search;

      if (state.filters.dynamic) {
        dynamicFilter.layerTitle = state.filters.dynamic.layerTitle || '';
        dynamicFilter.field = state.filters.dynamic.field || '';
        dynamicFilter.value = state.filters.dynamic.value || '';
        if (dynamicFilter.layerTitle) filterLayerDyn.value = dynamicFilter.layerTitle;
      }

      applyFilters();
      applyDynamicFilter();
    }

    return true;
  }

  // try restore once
  restoreState();

  // FEATURE MODAL helpers
  const IMAGE_BASE_DIR = './resources/images/dams/';
  const IMAGE_EXT = '.jpg';
  const IMAGE_KEYS = ['imgUrl','imgURL','IMGURL','Picture','picture','Photo','photo','Image','image','Img','img','ImageURL','image_url','URL','url','Link','link','PIC_URL','pic_url'];

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
    const preferred = ['Names','Name','Project','Type','Program','District','Ward','Reserve','Village','Longitude','Latitude'];
    const rows = [];
    preferred.forEach((k) => {
      const v = ft.get(k);
      if (v != null && String(v).trim()) rows.push([k, v]);
    });
    const seen = new Set(rows.map(([k]) => k));
    Object.keys(ft.getProperties()).sort().forEach((k) => {
      if (k === 'geometry' || seen.has(k)) return;
      const v = ft.get(k);
      if (v != null && String(v).trim()) rows.push([k, v]);
    });
    if (!rows.length) return '<em>No attributes</em>';
    return `<table class="fm-table">${rows.map(([k,v])=>`<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`).join('')}</table>`;
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
    window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); }, { once: true });

    btnOpenTab.onclick = () => openFeatureInNewTab(ft);
  }

  function openFeatureInNewTab(ft) {
    const w = window.open('', '_blank');
    if (!w) { showToast('Popup blocked.'); return; }
    w.document.write(buildFeaturePageHtml(ft));
    w.document.close();
  }

  function buildFeaturePageHtml(ft) {
    const title = escapeHtml(ft.get('Names') || ft.get('Name') || 'Feature Details');
    const img = getImageUrlFromFeature(ft);
    const table = buildAttributesTable(ft);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${table}${img ? `<img src="${img}">` : ''}</body></html>`;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
}
