/* ============================================================================
   CARBambase — map.js
   Leaflet interactive map: real bamboo occurrence points (13k, colour-coded by
   species and clustered), lazy per-species suitability surfaces, and a
   toggleable establishments layer. Basemap switching, fullscreen, focus-from-
   table, and a clear-map reset.
   ========================================================================== */

window.BamMap = (function () {
  "use strict";

  let map = null;
  let initialized = false;

  // occurrence points (real records) — clustered when the plugin is present
  let occLayer = null;             // MarkerClusterGroup, or LayerGroup fallback
  const occBySpecies = {};         // speciesId -> [circleMarker]
  let activeOcc = new Set();       // speciesIds currently shown
  let occBuilt = false;

  const estMarkers = {};           // establishment id -> marker
  let estLayer = null;

  const suitLayers = {};           // slug -> L.geoJSON (built on first show)
  const suitLoading = {};          // slug -> pending onload callbacks
  const suitMeta = {};             // slug -> manifest entry
  let focusMarker = null;

  (DATA.SUITABILITY.layers || []).forEach((l) => (suitMeta[l.slug] = l));

  const ZONE_COLORS = { High: "#2f7a36", Moderate: "#bd8a55", Low: "#a98a64" };
  const EST_TYPE_COLORS = {
    "Bambusetum": "#6a8a2f",
    "Nursery": "#2f7a36",
    "Plantation": "#8a5d33",
    "Techno/Demo Farm": "#bd8a55",
    "Park/Garden": "#3f7a6a",
  };

  // municipality -> {lat, lon} lookup from the canonical town list (establishments)
  const TOWN_COORDS = {};
  (DATA.TOWNS || []).forEach((t) => (TOWN_COORDS[t.name] = { lat: t.lat, lon: t.lon }));

  function estDivIcon(color) {
    return L.divIcon({
      className: "est-pin",
      html: `<span style="display:block;width:14px;height:14px;background:${color};border:1.6px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3);transform:rotate(45deg);border-radius:2px"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  function baseLayers() {
    return {
      "Light": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19, subdomains: "abcd", attribution: "&copy; OpenStreetMap &copy; CARTO",
      }),
      "Terrain": L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        maxZoom: 17, subdomains: "abc",
        attribution: "Map data: &copy; OpenStreetMap, SRTM | &copy; OpenTopoMap (CC-BY-SA)",
      }),
      "Streets": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
      }),
      "Satellite": L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics" }
      ),
    };
  }

  /* ---- custom fullscreen control (browser Fullscreen API) ---- */
  function addFullscreenControl(m) {
    const expand =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
    const compress =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3a1 1 0 0 0 1-1V4M20 8h-3a1 1 0 0 1-1-1V4M4 16h3a1 1 0 0 1 1 1v3M20 16h-3a1 1 0 0 0-1 1v3"/></svg>';
    const Ctl = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        const c = L.DomUtil.create("div", "leaflet-bar leaflet-control bam-fs");
        const a = L.DomUtil.create("a", "", c);
        a.href = "#"; a.title = "Toggle fullscreen"; a.setAttribute("role", "button");
        a.innerHTML = expand;
        const container = m.getContainer();
        const isFs = () => document.fullscreenElement || document.webkitFullscreenElement;
        L.DomEvent.on(a, "click", L.DomEvent.stop).on(a, "click", () => {
          if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
          else (container.requestFullscreen || container.webkitRequestFullscreen).call(container);
        });
        const sync = () => { a.innerHTML = isFs() ? compress : expand; setTimeout(() => m.invalidateSize(), 120); };
        document.addEventListener("fullscreenchange", sync);
        document.addEventListener("webkitfullscreenchange", sync);
        return c;
      },
    });
    m.addControl(new Ctl());
  }

  /* ---- suitability surfaces: lazy-loaded, multi-select ----
     Each species' geometry lives in js/suitability/<slug>.js and sets
     window.SUIT_DATA[slug]. We inject it with a <script> tag (rather than
     fetch) so it also works when the prototype is opened from file://. */
  function loadSuitData(slug, cb) {
    if (window.SUIT_DATA && window.SUIT_DATA[slug]) { cb(window.SUIT_DATA[slug]); return; }
    if (suitLoading[slug]) { suitLoading[slug].push(cb); return; }
    suitLoading[slug] = [cb];
    const s = document.createElement("script");
    s.src = "js/suitability/" + slug + ".js";
    s.onload = () => { const d = (window.SUIT_DATA || {})[slug]; (suitLoading[slug] || []).forEach((fn) => fn(d)); suitLoading[slug] = null; };
    s.onerror = () => { (suitLoading[slug] || []).forEach((fn) => fn(null)); suitLoading[slug] = null; };
    document.head.appendChild(s);
  }

  function buildSuitLayer(slug, data) {
    const meta = suitMeta[slug] || {};
    const color = meta.color || "#2f7a36";
    const name = meta.scientific || slug;
    return L.geoJSON(data, {
      style: () => ({ color: color, weight: 1, fillColor: color, fillOpacity: 0.45 }),
      onEachFeature: (f, layer) => {
        const ha = f.properties && f.properties.areaHa;
        layer.bindPopup(
          `<strong>Suitable area</strong><br><em class="sci">${name}</em><br><br>` +
          `Patch area: <b>${ha != null ? ha.toLocaleString() : "—"} ha</b>`
        );
        layer.bindTooltip(`${name} — suitable`, { sticky: true });
        layer.on("mouseover", () => layer.setStyle({ weight: 2.5, fillOpacity: 0.6 }));
        layer.on("mouseout", () => suitLayers[slug] && suitLayers[slug].resetStyle(layer));
      },
    });
  }

  function toggleSuitability(slug, on) {
    if (!map) return;
    if (!on) {
      if (suitLayers[slug] && map.hasLayer(suitLayers[slug])) map.removeLayer(suitLayers[slug]);
      return;
    }
    if (suitLayers[slug]) { suitLayers[slug].addTo(map); return; }
    loadSuitData(slug, (data) => {
      if (!data) return;
      suitLayers[slug] = buildSuitLayer(slug, data);
      suitLayers[slug].addTo(map);
    });
  }
  function suitabilityVisible(slug) { return !!(suitLayers[slug] && map && map.hasLayer(suitLayers[slug])); }

  /* ---- occurrence points (real records, colour-coded, clustered) ---- */
  function occColor(speciesId) { return (DATA.OCC_SPECIES_BY_ID[speciesId] || {}).color || "#8a8a7a"; }

  // A small bamboo-culm vector tinted to the species colour. One icon instance is
  // cached per colour (26 total) and shared across all 13k markers.
  const bambooIcons = {};
  function bambooIcon(color) {
    if (bambooIcons[color]) return bambooIcons[color];
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30">` +
      `<g fill="${color}" stroke="#fff" stroke-width="1.3" stroke-linejoin="round">` +
      `<path d="M13.7 7.6 Q15.5 1 23 1.8 Q18 5 13.7 7.6 Z"/>` +    // right leaf (fuller)
      `<path d="M10.3 9.6 Q8.5 3 1 3.8 Q6 7 10.3 9.6 Z"/>` +       // left leaf (fuller)
      `<rect x="9.2" y="12.4" width="5.6" height="9.2" rx="2.7"/>` +   // lower segment
      `<rect x="9.2" y="6.5" width="5.6" height="5.3" rx="2.7"/>` +    // middle segment
      `<rect x="9.2" y="1.7" width="5.6" height="4.2" rx="2.2"/>` +    // top segment
      `</g></svg>`;
    const icon = L.divIcon({
      html: svg, className: "occ-bamboo",
      iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14],
    });
    bambooIcons[color] = icon;
    return icon;
  }

  function occPopup(o) {
    const sp = DATA.OCC_SPECIES_BY_ID[o.speciesId] || {};
    return `<strong class="sci">${sp.scientific || ""}</strong>` +
      (sp.common ? `<br><span style="color:#666">${sp.common}</span>` : "") + "<br><br>" +
      `<b>${o.municipality}</b>, ${o.province}<br>` +
      (o.culms != null ? `Culms: <b>${o.culms.toLocaleString()}</b><br>` : "") +
      `Elevation: <b>${o.elevation.toLocaleString()} m</b><br>` +
      `<span style="color:#888;font-size:.85em">${o.lat.toFixed(5)}, ${o.lon.toFixed(5)}</span>`;
  }

  function clusterIcon(cluster) {
    const n = cluster.getChildCount();
    const cls = n < 50 ? "occ-cluster-s" : n < 500 ? "occ-cluster-m" : "occ-cluster-l";
    const label = n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : n;
    return L.divIcon({ html: `<span>${label}</span>`, className: "occ-cluster " + cls, iconSize: L.point(38, 38), iconAnchor: L.point(19, 19) });
  }

  function buildOccurrences() {
    if (occBuilt) return;
    occBuilt = true;
    const clustered = typeof L.markerClusterGroup === "function";
    occLayer = clustered
      ? L.markerClusterGroup({
          chunkedLoading: true, maxClusterRadius: 55, showCoverageOnHover: false,
          spiderfyOnMaxZoom: true, disableClusteringAtZoom: 16, iconCreateFunction: clusterIcon,
        })
      : L.layerGroup();
    (DATA.OCCURRENCES || []).forEach((o) => {
      const m = L.marker([o.lat, o.lon], { icon: bambooIcon(occColor(o.speciesId)) });
      m.bindPopup(() => occPopup(o));   // content built lazily on open (13k records)
      (occBySpecies[o.speciesId] || (occBySpecies[o.speciesId] = [])).push(m);
    });
    activeOcc = new Set(Object.keys(occBySpecies));
    refreshOcc();
  }

  function refreshOcc() {
    if (!occLayer) return;
    occLayer.clearLayers();
    const markers = [];
    activeOcc.forEach((sid) => { const arr = occBySpecies[sid]; if (arr) for (const m of arr) markers.push(m); });
    if (occLayer.addLayers) occLayer.addLayers(markers);      // markercluster bulk add
    else markers.forEach((m) => occLayer.addLayer(m));         // plain layerGroup
  }

  function toggleOccurrences(on) {
    if (!occLayer || !map) return;
    if (on) occLayer.addTo(map); else map.removeLayer(occLayer);
  }
  function occurrencesVisible() { return !!(occLayer && map && map.hasLayer(occLayer)); }
  function isolateOccSpecies(id) { activeOcc = new Set([id]); refreshOcc(); toggleOccurrences(true); }
  function showAllOccSpecies() { activeOcc = new Set(Object.keys(occBySpecies)); refreshOcc(); }

  /* ---- establishments (plotted at their real coordinates) ---- */
  const inCAR = (lat, lon) => lat != null && lon != null && lon >= 120 && lon <= 122.5 && lat >= 15.5 && lat <= 19.5;
  function buildEstablishments() {
    estLayer = L.layerGroup();
    DATA.ESTABLISHMENTS.forEach((e) => {
      if (!inCAR(e.lat, e.lon)) return;   // Unknown / out-of-range coords aren't plotted
      const color = EST_TYPE_COLORS[e.type] || "#8a5d33";
      const m = L.marker([e.lat, e.lon], { icon: estDivIcon(color) });
      const speciesList = (e.species && e.species.length) ? e.species.map((n) => `<em>${n}</em>`).join(", ") : "—";
      m.bindPopup(
        `<span style="display:inline-block;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#fff;background:${color};padding:2px 8px;border-radius:999px">${e.type}</span><br>` +
        `<strong>${e.name}</strong><br><br>` +
        `<b>${e.municipality}</b>, ${e.province}<br>Area: <b>${e.areaDisplay || "—"}</b> · Est. ${e.year || "—"}<br>` +
        `<span style="font-size:.85em">Species: ${speciesList}</span>`
      );
      m.bindTooltip(`${e.type}: ${e.name}`, { sticky: true });
      estLayer.addLayer(m);
      estMarkers[e.id] = m;
    });
  }
  function toggleEstablishments(on) { if (estLayer && map) { on ? estLayer.addTo(map) : map.removeLayer(estLayer); } }
  function establishmentsVisible() { return !!(estLayer && map && map.hasLayer(estLayer)); }
  function focusEstablishment(id) {
    toggleEstablishments(true);
    const m = estMarkers[id];
    if (!m) return;
    map.setView(m.getLatLng(), 12, { animate: true });
    setTimeout(() => m.openPopup(), 350);
  }

  // Drop/replace a single highlighted marker at an arbitrary point — used by the
  // Occurrences table to pinpoint the clicked row distinctly from the clusters.
  function focusPoint(lat, lon, html, color) {
    if (!map) return;
    if (focusMarker) map.removeLayer(focusMarker);
    focusMarker = L.circleMarker([lat, lon], {
      radius: 8, color: "#fff", weight: 2, fillColor: color || "#d81b60", fillOpacity: 0.95,
    }).addTo(map);
    if (html) focusMarker.bindPopup(html);
    map.setView([lat, lon], 13, { animate: true });
    if (html) setTimeout(() => focusMarker && focusMarker.openPopup(), 350);
  }

  // Frame the Cordillera study area, then nudge in ~half a level so the region
  // fills more of the viewport while still showing the whole of CAR.
  function frameRegion() {
    if (!map) return;
    map.fitBounds(DATA.SUITABILITY.bounds);
    map.setZoom(map.getZoom() + 0.5, { animate: false });
  }
  function resetView() { frameRegion(); }

  // Reset the map to its default state (all species shown, no suitability/
  // establishments overlays, no focus pin, framed to the region).
  function clearMap() {
    if (!map) return;
    showAllOccSpecies();
    toggleOccurrences(true);
    Object.keys(suitLayers).forEach((slug) => { if (map.hasLayer(suitLayers[slug])) map.removeLayer(suitLayers[slug]); });
    if (estLayer && map.hasLayer(estLayer)) map.removeLayer(estLayer);
    if (focusMarker) { map.removeLayer(focusMarker); focusMarker = null; }
    resetView();
  }

  function init() {
    if (initialized) { setTimeout(() => map && map.invalidateSize(), 60); return; }
    if (typeof L === "undefined") {
      const el = document.getElementById("map");
      if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;color:#6c6a5b">The map library could not be loaded. Please check your internet connection and refresh.</div>';
      return;
    }
    initialized = true;

    const bases = baseLayers();
    map = L.map("map", { scrollWheelZoom: true, zoomControl: true, preferCanvas: true, zoomSnap: 0.5, layers: [bases.Light] });
    // Frame the Cordillera study area using the combined suitability extent.
    frameRegion();
    L.control.layers(bases, null, { position: "topright" }).addTo(map);
    addFullscreenControl(map);

    // suitability surfaces pre-checked in the side panel (default in app.js)
    document.querySelectorAll("#pane-map input[data-suit]").forEach((cb) => {
      if (cb.checked) toggleSuitability(cb.dataset.suit, true);
    });

    // occurrence points — the primary layer, always shown on load
    buildOccurrences();
    toggleOccurrences(true);

    // establishments — off by default
    buildEstablishments();

    setTimeout(() => map.invalidateSize(), 80);
  }

  return {
    init, toggleSuitability, suitabilityVisible,
    toggleOccurrences, occurrencesVisible, isolateOccSpecies, showAllOccSpecies,
    toggleEstablishments, establishmentsVisible, focusEstablishment,
    focusPoint, clearMap, resetView, ZONE_COLORS, EST_TYPE_COLORS,
  };
})();
