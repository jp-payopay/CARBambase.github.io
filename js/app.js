/* ============================================================================
   CARBambase — app.js
   Routing, rendering, search, galleries, tables, modal, and inline SVG art.
   ========================================================================== */

window.App = (function () {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let searchScope = "occurrences";
  let homeRendered = false;

  /* --------------------------------------------------------------------- */
  /* Inline SVG "photo" generator — keeps the prototype fully offline.      */
  /* --------------------------------------------------------------------- */
  function shade(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * pct); g = Math.round(g + (255 - g) * pct); b = Math.round(b + (255 - b) * pct);
    return `rgb(${r},${g},${b})`;
  }
  function darken(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r * (1 - pct)); g = Math.round(g * (1 - pct)); b = Math.round(b * (1 - pct));
    return `rgb(${r},${g},${b})`;
  }

  // Draw a stylised bamboo grove illustration tinted to `color`, with an
  // optional emblem (emoji-free, vector) and a caption strip.
  function artSVG(color, caption, kind) {
    const W = 400, H = 300;
    const sky1 = shade(color, 0.72), sky2 = shade(color, 0.5);
    const culm = color, culmDark = darken(color, 0.22), leaf = darken(color, 0.1);
    const culms = [];
    const xs = [70, 130, 195, 250, 320];
    xs.forEach((x, i) => {
      const w = 12 + (i % 3) * 5;
      const top = 40 + (i % 4) * 14;
      let segs = "";
      for (let y = top; y < 250; y += 34) {
        segs += `<line x1="${x - w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y}" stroke="${culmDark}" stroke-width="2.5"/>`;
      }
      culms.push(
        `<g opacity="${0.55 + (i % 3) * 0.15}">
           <rect x="${x - w / 2}" y="${top}" width="${w}" height="${250 - top}" rx="${w / 2}" fill="${culm}"/>
           ${segs}
           <path d="M${x} ${top} q -26 -12 -40 -34 q 30 6 40 30 q 10 -24 40 -30 q -14 22 -40 34 z" fill="${leaf}" opacity=".85"/>
         </g>`
      );
    });

    let emblem = "";
    if (kind === "product")
      emblem = `<g transform="translate(330,55)" opacity=".85"><circle r="22" fill="rgba(255,255,255,.85)"/><path d="M-9 -2 L0 -11 L9 -2 L9 9 L-9 9 Z" fill="${culmDark}"/></g>`;
    else if (kind === "publication")
      emblem = `<g transform="translate(330,55)" opacity=".9"><circle r="22" fill="rgba(255,255,255,.85)"/><rect x="-10" y="-11" width="20" height="22" rx="2" fill="${culmDark}"/><line x1="0" y1="-11" x2="0" y2="11" stroke="#fff" stroke-width="1.6"/></g>`;
    else if (kind === "news")
      emblem = `<g transform="translate(330,55)" opacity=".9"><circle r="22" fill="rgba(255,255,255,.85)"/><circle r="7" fill="${culmDark}"/><g stroke="${culmDark}" stroke-width="2.4"><line x1="0" y1="-16" x2="0" y2="-11"/><line x1="0" y1="11" x2="0" y2="16"/><line x1="-16" y1="0" x2="-11" y2="0"/><line x1="11" y1="0" x2="16" y2="0"/></g></g>`;

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient></defs>
        <rect width="${W}" height="${H}" fill="url(#g)"/>
        <ellipse cx="200" cy="300" rx="260" ry="60" fill="${darken(color, 0.3)}" opacity=".25"/>
        ${culms.join("")}
        ${emblem}
        ${kind === "species" ? "" : `<rect x="0" y="248" width="${W}" height="52" fill="rgba(31,61,23,.55)"/><text x="18" y="280" font-family="Segoe UI, sans-serif" font-size="18" font-weight="700" fill="#fff">${esc(caption).slice(0, 34)}</text>`}
      </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  const TAG_COLORS = {
    Construction: "#6a4f2a", "Energy / Agri": "#558b2f", Handicraft: "#c62828", Furniture: "#8a6d3b",
    Food: "#ef6c00", Innovation: "#1565c0", Culture: "#ad1457", Lifestyle: "#00838f", Landscaping: "#2e7d32",
    "Agri / Energy": "#558b2f",
  };
  const PUBTYPE_COLORS = {
    "Technical Manual": "#3d6b27", "Field Guide": "#00838f", "Training Module": "#ef6c00",
    "Research Paper": "#1565c0", "Policy Brief": "#6a1b9a", Monograph: "#ad1457", "IEC / Primer": "#8a6d3b",
  };
  const NEWS_COLORS = {
    Event: "#2e7d32", Training: "#ef6c00", "Tech Demo": "#1565c0", Workshop: "#ad1457", Meeting: "#6a1b9a",
  };
  const TECH_COLORS = { Machinery: "#1565c0", Fabricator: "#6a4f2a", Technology: "#2e7d32" };

  /* --------------------------------------------------------------------- */
  /* Routing                                                                */
  /* --------------------------------------------------------------------- */
  const ROUTES = ["home", "occurrences", "species", "establishments", "nurseries", "about", "contribute", "contact"];

  function go(route, pane) {
    if (!ROUTES.includes(route)) route = "home";
    $$(".view").forEach((v) => v.classList.remove("active"));
    $("#view-" + route).classList.add("active");

    // hero only on home; white topbar text + scroll-hide behavior are scoped to home
    $("#hero").style.display = route === "home" ? "" : "none";
    document.body.classList.toggle("route-home", route === "home");
    const tb = $(".topbar");
    if (tb) tb.classList.remove("topbar--hidden"); // always reveal on route change
    closeMobileNav();
    lastScrollY = 0;

    // nav highlight
    $$("#mainnav a").forEach((a) => a.classList.toggle("active", a.dataset.route === route && (route !== "home" || !pane)));

    // lazy render
    if (route === "home") {
      renderHome();
      if (pane) switchHomeTab(pane);
    } else if (route === "occurrences") renderOccurrences();
    else if (route === "species") renderSpecies();
    else if (route === "establishments") renderEstablishments();
    else if (route === "nurseries") renderNurseries();
    else if (route === "about") renderAbout();
    else if (route === "contribute") renderContribute();
    else if (route === "contact") renderContact();

    window.scrollTo({ top: route === "home" ? 0 : 0, behavior: "instant" in window ? "instant" : "auto" });

    if (route === "home") scheduleSizeHero();
  }

  /* --------------------------------------------------------------------- */
  /* Search                                                                 */
  /* --------------------------------------------------------------------- */
  function setupSearch() {
    $$("#searchtabs .search-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("#searchtabs .search-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        searchScope = btn.dataset.tab;
        const ph = {
          occurrences: "Search bamboo occurrences in the Cordillera…",
          species: "Search bamboo species…",
          establishments: "Search establishments (nurseries, gardens, plantations)…",
          nurseries: "Search nursery monitoring records…",
        }[searchScope];
        $("#heroSearch").placeholder = ph;
      });
    });
    const run = () => doSearch($("#heroSearch").value.trim());
    $("#heroSearchBtn").addEventListener("click", run);
    $("#heroSearch").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  }

  function doSearch(term) {
    pendingSearch[searchScope] = term;
    go(searchScope);
  }
  function quick(term) {
    searchScope = "occurrences";
    pendingSearch.occurrences = term;
    go("occurrences");
  }
  const pendingSearch = { occurrences: "", species: "", establishments: "", nurseries: "" };

  /* --------------------------------------------------------------------- */
  /* HOME — tabs                                                            */
  /* --------------------------------------------------------------------- */
  function renderHome() {
    if (homeRendered) return;
    homeRendered = true;
    renderStatsBand();
    renderMapPane();
    renderStatistics();
    renderProducts();
    renderTechnologies();
    renderPublications();
    renderNews();
    renderPartners();
    renderRequestForm();

    $$("#hometabs button").forEach((b) =>
      b.addEventListener("click", () => switchHomeTab(b.dataset.pane))
    );

    // Map is the default-active home tab, so initialise it now (switchHomeTab
    // isn't fired for the already-active tab on first load).
    const activePane = $("#hometabs button.active");
    if (activePane && activePane.dataset.pane === "map") {
      requestAnimationFrame(() => BamMap.init());
    }
  }

  function switchHomeTab(pane) {
    $$("#hometabs button").forEach((b) => b.classList.toggle("active", b.dataset.pane === pane));
    $$(".tabpane").forEach((p) => p.classList.remove("active"));
    const el = $("#pane-" + pane);
    if (el) el.classList.add("active");
    if (pane === "map") BamMap.init();
    document.querySelector("#hometabs").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderStatsBand() {
    const s = DATA.STATS;
    // Hectares established = total establishment area (all areas in hectares).
    const hectares = DATA.ESTABLISHMENTS.reduce((a, e) => a + (e.areaHa || 0), 0);
    const items = [
      [s.occurrences.toLocaleString(), "Occurrences"],
      [s.species, "Species"],
      [s.establishments, "Establishments"],
      [s.nurseries, "Nursery records"],
      [Math.round(hectares).toLocaleString(), "Hectares established"],
      [s.seedlings.toLocaleString(), "Planting materials"],
    ];
    $("#statsBand").innerHTML =
      `<div class="stats-band-card">
        <div class="stats-band-eyebrow">The database at a glance</div>
        <div class="stats-band-grid">
          ${items.map(([n, l]) => `<div class="stat"><span class="num">${n}</span><span class="lbl">${l}</span></div>`).join("")}
        </div>
      </div>`;
  }

  /* ---- Map pane ---- */
  function renderMapPane() {
    // Real occurrence species present on the map, most-recorded first; labelled
    // by common name (scientific kept as a hover title).
    const present = DATA.OCC_SPECIES.filter((s) => s.count > 0).slice().sort((a, b) => b.count - a.count);
    // show only the first of any pipe-separated common names, for a clean UI
    const firstCommon = (cn) => (cn || "").split("|")[0].trim();
    const legend = present
      .map(
        (sp) =>
          `<div class="legend-item" data-sp="${esc(sp.id)}" title="${esc(sp.scientific)}">
             <span class="dot" style="background:${sp.color}"></span>
             <span><span class="cn">${esc(firstCommon(sp.common) || sp.scientific)}</span> <span class="legend-count">${sp.count.toLocaleString()}</span></span>
           </div>`
      )
      .join("");

    // common-name lookup for the modelled-suitability species (matched by scientific)
    const commonBySci = {};
    DATA.OCC_SPECIES.forEach((s) => (commonBySci[s.scientific] = s.common));

    // Per-species suitability surfaces (multi-select; lazy-loaded on toggle),
    // labelled by common name. None shown by default — the occurrence points
    // are the primary layer; users tick suitability to overlay.
    const DEFAULT_SUIT = [];
    const suitItems = (DATA.SUITABILITY.layers || [])
      .map((l) => ({ l, cn: firstCommon(commonBySci[l.scientific]) || l.scientific }))
      .sort((a, b) => a.cn.localeCompare(b.cn))   // list species alphabetically
      .map(({ l, cn }) => {
        const checked = DEFAULT_SUIT.includes(l.slug) ? " checked" : "";
        return `<label class="layer-toggle suit-item" title="${esc(l.scientific)}">
          <input type="checkbox" data-suit="${esc(l.slug)}"${checked}>
          <span class="legend-swatch" style="background:${l.color}"></span>
          <span class="cn">${esc(cn)}</span>
          <span class="suit-ha">${Math.round(l.totalHa).toLocaleString()} ha</span>
        </label>`;
      })
      .join("") || `<div class="muted" style="font-size:.8rem">No suitability layers available.</div>`;

    const estLegend = Object.entries(BamMap.EST_TYPE_COLORS)
      .map(
        ([type, c]) =>
          `<div class="legend-item"><span class="est-diamond" style="background:${c}"></span>${esc(type)}</div>`
      )
      .join("");

    const chev = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    const panel = (title, body, collapsed) =>
      `<div class="map-panel${collapsed ? " collapsed" : ""}">
        <button class="map-panel-head" type="button"><span>${title}</span>${chev}</button>
        <div class="map-panel-body">${body}</div>
      </div>`;

    const occTotal = DATA.OCCURRENCES.length.toLocaleString();
    $("#pane-map").innerHTML = `
      <h2 class="section-title">Distribution &amp; Suitability Map</h2>
      <p class="section-sub">${occTotal} field occurrence records across the Cordillera — colored by species and clustered (zoom in to separate) — with modelled land-suitability surfaces you can overlay.</p>
      <div class="map-layout">
        <div id="map"></div>
        <div class="map-side">
          <button type="button" id="clearMap" class="btn-clear map-clear">✕ Clear map</button>
          ${panel("Species — click to isolate",
            `<label class="layer-toggle"><input type="checkbox" id="tgOcc" checked> Show species occurrences</label>
             <div style="font-size:.78rem;margin:8px 0" class="muted">Click a name to show only that species · <a id="showAllSp" style="cursor:pointer">show all</a></div>${legend}`, true)}
          ${panel("Suitability by species",
            `<div style="font-size:.78rem;margin:0 0 8px" class="muted">Modelled suitable area per species · tick to overlay · <a id="clearSuit" style="cursor:pointer">clear all</a></div>${suitItems}`, true)}
          ${panel("Establishments",
            `<label class="layer-toggle"><input type="checkbox" id="tgEst"> Show establishments</label>
             <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;margin:10px 0 4px" class="muted">Types</div>${estLegend}`, true)}
        </div>
      </div>`;

    // collapsible panels
    $$("#pane-map .map-panel-head").forEach((h) =>
      h.addEventListener("click", () => h.parentElement.classList.toggle("collapsed"))
    );

    // suitability overlays
    $$("#pane-map input[data-suit]").forEach((cb) =>
      cb.addEventListener("change", () => BamMap.toggleSuitability(cb.dataset.suit, cb.checked))
    );
    $("#clearSuit").addEventListener("click", () => {
      $$("#pane-map input[data-suit]").forEach((cb) => {
        if (cb.checked) { cb.checked = false; BamMap.toggleSuitability(cb.dataset.suit, false); }
      });
    });

    // show/hide all occurrence points
    $("#tgOcc").addEventListener("change", (e) => BamMap.toggleOccurrences(e.target.checked));

    // establishments overlay
    $("#tgEst").addEventListener("change", (e) => BamMap.toggleEstablishments(e.target.checked));

    // click a species to isolate its points; show all resets
    $$("#pane-map .legend-item[data-sp]").forEach((li) => {
      li.addEventListener("click", () => {
        BamMap.isolateOccSpecies(li.dataset.sp);
        $("#tgOcc").checked = true;   // isolating implies the layer is shown
        $$("#pane-map .legend-item[data-sp]").forEach((x) => x.classList.toggle("off", x !== li));
      });
    });
    $("#showAllSp").addEventListener("click", () => {
      BamMap.showAllOccSpecies();
      BamMap.toggleOccurrences(true);
      $("#tgOcc").checked = true;
      $$("#pane-map .legend-item[data-sp]").forEach((x) => x.classList.remove("off"));
    });

    // clear map — reset overlays, selection, focus pin, and view; sync controls
    $("#clearMap").addEventListener("click", () => {
      BamMap.clearMap();
      $$("#pane-map input[data-suit]").forEach((cb) => (cb.checked = false));
      $("#tgEst").checked = false;
      $("#tgOcc").checked = true;
      $$("#pane-map .legend-item[data-sp]").forEach((x) => x.classList.remove("off"));
    });
  }

  /* ---- Carousel helper ---- */
  function carousel(cards) {
    const id = "car" + Math.random().toString(36).slice(2, 7);
    return `
      <div class="carousel">
        <button class="carousel-btn prev" data-car="${id}">‹</button>
        <div class="carousel-track" id="${id}">${cards}</div>
        <button class="carousel-btn next" data-car="${id}">›</button>
      </div>`;
  }
  function wireCarousels(root = document) {
    $$(".carousel-btn", root).forEach((btn) => {
      btn.addEventListener("click", () => {
        const track = document.getElementById(btn.dataset.car);
        if (track) track.scrollBy({ left: btn.classList.contains("next") ? 340 : -340, behavior: "smooth" });
      });
    });
  }

  /* ---- Products ---- */
  function renderProducts() {
    $("#pane-products").innerHTML = `
      <h2 class="section-title">Bamboo Products of the Cordillera</h2>
      <p class="section-sub">Community enterprises and value-added products, with their locations across the region.</p>
      ${comingSoon("🛍️", "The six SUCs are cataloguing community enterprises and value-added bamboo products from across the region. Check back soon!")}`;
  }

  /* ---- Coming-soon teaser (Technologies, Publications, News) ---- */
  function comingSoon(ico, msg) {
    return `
      <div class="coming-soon">
        <div class="coming-soon-ico">${ico}</div>
        <h3>Coming Soon<span class="cs-dots"><span>.</span><span>.</span><span>.</span></span></h3>
        <p>${msg}</p>
      </div>`;
  }

  /* ---- Technologies & Machineries ---- */
  function renderTechnologies() {
    $("#pane-technologies").innerHTML = `
      <h2 class="section-title">Technologies &amp; Machineries</h2>
      <p class="section-sub">Machineries, fabrication services, and newly developed technologies from the SUCs.</p>
      ${comingSoon("⚙️", "The six SUCs are compiling their machineries, fabrication services, and newly developed bamboo technologies. Check back soon!")}`;
  }

  /* ---- Publications ---- */
  function renderPublications() {
    $("#pane-publications").innerHTML = `
      <h2 class="section-title">Publications &amp; Manuals</h2>
      <p class="section-sub">Manuals, modules, field guides, and research outputs produced under the program.</p>
      ${comingSoon("📚", "Manuals, modules, field guides, and research outputs from the program are being prepared for publication. Check back soon!")}`;
  }

  /* ---- News ---- */
  function renderNews() {
    $("#pane-news").innerHTML = `
      <h2 class="section-title">News &amp; Engagements</h2>
      <p class="section-sub">Meetings, trainings, workshops, technology demonstrations, and events of the program.</p>
      ${comingSoon("📰", "Updates on meetings, trainings, workshops, technology demonstrations, and program events will be posted here. Check back soon!")}`;
  }

  /* ---- Partners ---- */
  function renderPartners() {
    const card = (p, tag) => `<div class="suc-card">
          <img class="suc-logo" src="${p.logo}" alt="${esc(p.abbr)} logo" loading="lazy"/>
          <div class="suc-abbr">${esc(p.abbr)}</div>
          <div class="suc-name">${esc(p.name)}</div>
          ${p.address ? `<div class="suc-addr">📍 ${esc(p.address)}</div>` : ""}
          <div class="suc-tag">${esc(tag || p.tag || "")}</div>
        </div>`;
    const sucs = DATA.PARTNERS.sucs.map((p) => card(p, "Co-Implementing Agency")).join("");
    const partners = DATA.PARTNERS.partners.map((p) => card(p)).join("");
    $("#pane-partners").innerHTML = `
      <h2 class="section-title">Publishers, Partners &amp; Stakeholders</h2>
      <p class="section-sub">The consortium of Cordillera State Universities and Colleges and partner agencies driving the Cordillera Bamboo Program.</p>
      <h3 style="color:var(--forest-700);margin-top:10px">State Universities &amp; Colleges (CAR)</h3>
      <div class="suc-grid" style="margin-bottom:30px">${sucs}</div>
      <h3 style="color:var(--forest-700)">Partner Agencies &amp; Stakeholders</h3>
      <div class="suc-grid">${partners}</div>`;
  }

  /* --------------------------------------------------------------------- */
  /* STATISTICS — province-level summary + charts + report                 */
  /* --------------------------------------------------------------------- */
  function provinceSummary() {
    const provs = {};
    const ensure = (p) =>
      provs[p] || (provs[p] = { province: p, occ: 0, culms: 0, est: 0, nur: 0, seedlings: 0, species: new Set() });
    DATA.OCCURRENCES.forEach((o) => { const r = ensure(o.province); r.occ++; r.culms += (o.culms || 0); r.species.add(o.speciesId); });
    DATA.ESTABLISHMENTS.forEach((e) => { ensure(e.province).est++; });
    DATA.NURSERIES.forEach((n) => { const r = ensure(n.province); r.nur++; r.seedlings += (n.count || 0); });
    return Object.values(provs)
      .map((r) => ({ ...r, speciesCount: r.species.size }))
      .sort((a, b) => b.occ - a.occ);
  }

  function barChart(title, items, color) {
    const max = Math.max(...items.map((i) => i.value), 1);
    const rows = items
      .map(
        (i) => `<div class="bar-row">
          <div class="bar-label" title="${esc(i.label)}">${esc(i.label)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${((i.value / max) * 100).toFixed(1)}%;background:${i.color || color}"></div></div>
          <div class="bar-val">${i.value.toLocaleString()}</div>
        </div>`
      )
      .join("");
    return `<div class="chart-card"><h4>${esc(title)}</h4>${rows}</div>`;
  }

  function municipalitySummary(province) {
    const towns = {};
    const ensure = (m) => towns[m] || (towns[m] = { municipality: m, occ: 0, culms: 0, est: 0, seedlings: 0, species: new Set() });
    DATA.OCCURRENCES.filter((o) => o.province === province).forEach((o) => { const r = ensure(o.municipality); r.occ++; r.culms += (o.culms || 0); r.species.add(o.speciesId); });
    DATA.ESTABLISHMENTS.filter((e) => e.province === province).forEach((e) => { ensure(e.municipality).est++; });
    DATA.NURSERIES.filter((n) => n.province === province).forEach((n) => { const r = ensure(n.municipality); r.seedlings += (n.count || 0); });
    return Object.values(towns).map((r) => ({ ...r, speciesCount: r.species.size })).sort((a, b) => b.occ - a.occ);
  }

  function renderStatistics() {
    const provinces = provinceSummary().map((r) => r.province).sort();
    $("#pane-statistics").innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:14px">
        <div>
          <h2 class="section-title">Regional Statistics</h2>
          <p class="section-sub" style="margin-bottom:0">Summary of bamboo occurrences, establishments, and planting materials across the Cordillera.</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <label style="font-size:.88rem;font-weight:600;color:var(--muted)">Province
            <select id="statProvince" style="margin-left:6px;font-family:var(--font-body);font-size:.92rem;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:#fff">
              <option value="">All provinces (CAR)</option>
              ${provinces.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("")}
            </select>
          </label>
          <button class="btn-primary" onclick="App.generateReport()">⤓ Generate Summary Report</button>
        </div>
      </div>
      <div class="kpi-row" id="statKpis"></div>
      <div id="statTable"></div>
      <div class="chart-grid" id="statCharts"></div>`;

    $("#statProvince").addEventListener("change", (e) => applyStats(e.target.value));
    applyStats("");
  }

  function applyStats(province) {
    const kpiRow = (items) =>
      items.map(([n, l]) => `<div class="kpi"><div class="kpi-num">${n}</div><div class="kpi-lbl">${l}</div></div>`).join("");

    if (!province) {
      // ---- region-wide view ----
      const ps = provinceSummary();
      const s = DATA.STATS;
      $("#statKpis").innerHTML = kpiRow([
        [s.occurrences, "Occurrence records"],
        [s.species, "Species documented"],
        [s.establishments, "Establishments"],
        [s.seedlings.toLocaleString(), "Planting materials"],
      ]);
      $("#statTable").innerHTML = `<div class="table-wrap" style="margin:8px 0 26px"><table class="data">
        <thead><tr><th>Province</th><th>Occurrences</th><th>Culms recorded</th><th>Species</th><th>Establishments</th><th>Nursery records</th><th>Planting materials</th></tr></thead>
        <tbody>${ps.map((r) => `<tr><td><strong>${esc(r.province)}</strong></td><td>${r.occ}</td><td>${r.culms.toLocaleString()}</td><td>${r.speciesCount}</td><td>${r.est}</td><td>${r.nur}</td><td>${r.seedlings.toLocaleString()}</td></tr>`).join("")}</tbody>
      </table></div>`;
      const spCounts = DATA.OCC_SPECIES.filter((sp) => sp.count > 0).map((sp) => ({ label: sp.scientific, value: sp.count, color: sp.color })).sort((a, b) => b.value - a.value);
      $("#statCharts").innerHTML =
        barChart("Occurrences by province", ps.map((r) => ({ label: r.province, value: r.occ })), "#4a7c2f") +
        barChart("Planting materials by province", ps.map((r) => ({ label: r.province, value: r.seedlings })), "#c9a86a") +
        barChart("Culms recorded by province", ps.map((r) => ({ label: r.province, value: r.culms })), "#3d6b27") +
        barChart("Occurrences by species", spCounts, "#4a7c2f");
      return;
    }

    // ---- single-province view (breakdown by municipality) ----
    const ms = municipalitySummary(province);
    const occ = DATA.OCCURRENCES.filter((o) => o.province === province);
    const est = DATA.ESTABLISHMENTS.filter((e) => e.province === province);
    const nur = DATA.NURSERIES.filter((n) => n.province === province);
    const speciesHere = new Set(occ.map((o) => o.speciesId));
    const seedlings = nur.reduce((a, n) => a + n.count, 0);

    $("#statKpis").innerHTML = kpiRow([
      [occ.length, "Occurrences in " + province],
      [speciesHere.size, "Species recorded"],
      [est.length, "Establishments"],
      [seedlings.toLocaleString(), "Planting materials"],
    ]);

    if (!ms.length) {
      $("#statTable").innerHTML = `<div class="disclaimer" style="margin:8px 0 26px">No municipal records for ${esc(province)} in this prototype dataset.</div>`;
      $("#statCharts").innerHTML = "";
      return;
    }

    $("#statTable").innerHTML = `<div class="table-wrap" style="margin:8px 0 26px"><table class="data">
      <thead><tr><th>Municipality</th><th>Occurrences</th><th>Culms recorded</th><th>Species</th><th>Establishments</th><th>Planting materials</th></tr></thead>
      <tbody>${ms.map((r) => `<tr><td><strong>${esc(r.municipality)}</strong></td><td>${r.occ}</td><td>${r.culms.toLocaleString()}</td><td>${r.speciesCount}</td><td>${r.est}</td><td>${r.seedlings.toLocaleString()}</td></tr>`).join("")}</tbody>
    </table></div>`;

    const spCounts = DATA.OCC_SPECIES.map((sp) => ({ label: sp.scientific, value: occ.filter((o) => o.speciesId === sp.id).length, color: sp.color }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);

    $("#statCharts").innerHTML =
      barChart("Occurrences by municipality", ms.map((r) => ({ label: r.municipality, value: r.occ })), "#4a7c2f") +
      barChart("Planting materials by municipality", ms.map((r) => ({ label: r.municipality, value: r.seedlings })), "#c9a86a") +
      barChart("Culms recorded by municipality", ms.map((r) => ({ label: r.municipality, value: r.culms })), "#3d6b27") +
      barChart(`Occurrences by species in ${province}`, spCounts, "#4a7c2f");
  }

  /* ---- Printable / PDF summary report (opens in a new tab) ---- */
  function generateReport() {
    const ps = provinceSummary();
    const s = DATA.STATS;
    const now = new Date();
    const stamp = now.toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" });

    const estByType = {};
    DATA.ESTABLISHMENTS.forEach((e) => (estByType[e.type] = (estByType[e.type] || 0) + 1));
    const nurByStatus = {};
    DATA.NURSERIES.forEach((n) => (nurByStatus[n.status] = (nurByStatus[n.status] || 0) + 1));

    const provRows = ps
      .map(
        (r) => `<tr><td>${r.province}</td><td>${r.occ}</td><td>${r.culms.toLocaleString()}</td>
          <td>${r.speciesCount}</td><td>${r.est}</td><td>${r.nur}</td><td>${r.seedlings.toLocaleString()}</td></tr>`
      )
      .join("");
    const totals = ps.reduce(
      (a, r) => ({ occ: a.occ + r.occ, culms: a.culms + r.culms, est: a.est + r.est, nur: a.nur + r.nur, seed: a.seed + r.seedlings }),
      { occ: 0, culms: 0, est: 0, nur: 0, seed: 0 }
    );

    const spRows = DATA.OCC_SPECIES.filter((sp) => sp.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((sp) => {
        const occ = DATA.OCCURRENCES.filter((o) => o.speciesId === sp.id);
        const culms = occ.reduce((a, o) => a + (o.culms || 0), 0);
        return `<tr><td><em>${sp.scientific}</em></td><td>${sp.common || "—"}</td><td>${occ.length.toLocaleString()}</td><td>${culms.toLocaleString()}</td></tr>`;
      }).join("");

    const estRows = Object.entries(estByType).map(([t, n]) => `<tr><td>${t}</td><td>${n}</td></tr>`).join("");
    const nurRows = Object.entries(nurByStatus).map(([t, n]) => `<tr><td>${t}</td><td>${n}</td></tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cordillera Bamboo Database — Summary Report</title>
      <style>
        @page { margin: 18mm; }
        body { font-family: "Segoe UI", system-ui, sans-serif; color:#2b2b26; max-width:900px; margin:0 auto; padding:24px; }
        h1 { color:#2f5320; margin-bottom:2px; } h2 { color:#3d6b27; border-bottom:2px solid #e6ddcb; padding-bottom:5px; margin-top:30px; }
        .sub { color:#6f6e62; } .stamp { color:#6f6e62; font-size:.85rem; }
        table { width:100%; border-collapse:collapse; margin-top:10px; font-size:.9rem; }
        th,td { border:1px solid #e0d8c4; padding:7px 9px; text-align:left; } th { background:#e8f0dd; color:#1f3d17; }
        tfoot td { font-weight:700; background:#faf7f0; }
        .kpis { display:flex; gap:10px; flex-wrap:wrap; margin:14px 0; }
        .k { border:1px solid #e6ddcb; border-radius:8px; padding:10px 16px; min-width:120px; }
        .k b { font-size:1.5rem; color:#2f5320; display:block; } .k span { font-size:.78rem; color:#6f6e62; }
        .note { background:#efe6d3; border:1px dashed #c9a86a; color:#8a6d3b; padding:8px 12px; border-radius:6px; font-size:.82rem; margin:14px 0; }
        .toolbar { position:sticky; top:0; background:#fff; padding:10px 0; border-bottom:1px solid #e6ddcb; margin-bottom:10px; }
        .toolbar button { background:#3d6b27; color:#fff; border:none; padding:9px 18px; border-radius:7px; font-weight:700; cursor:pointer; font-size:.9rem; }
        @media print { .toolbar { display:none; } }
      </style></head><body>
      <div class="toolbar"><button onclick="window.print()">⤓ Print / Save as PDF</button></div>
      <h1>Cordillera Bamboo Database</h1>
      <div class="sub">Regional Summary Report — Cordillera Bamboo Program</div>
      <div class="stamp">Generated ${stamp}</div>
      <div class="note">Prototype report — all figures below are illustrative dummy data for presentation purposes.</div>

      <div class="kpis">
        <div class="k"><b>${s.occurrences}</b><span>Occurrence records</span></div>
        <div class="k"><b>${s.species}</b><span>Species documented</span></div>
        <div class="k"><b>${s.establishments}</b><span>Establishments</span></div>
        <div class="k"><b>${s.nurseries}</b><span>Nursery records</span></div>
        <div class="k"><b>${s.seedlings.toLocaleString()}</b><span>Planting materials</span></div>
      </div>

      <h2>Summary by Province</h2>
      <table>
        <thead><tr><th>Province</th><th>Occurrences</th><th>Culms</th><th>Species</th><th>Establishments</th><th>Nursery records</th><th>Planting materials</th></tr></thead>
        <tbody>${provRows}</tbody>
        <tfoot><tr><td>Total (CAR)</td><td>${totals.occ}</td><td>${totals.culms.toLocaleString()}</td><td>${s.species}</td><td>${totals.est}</td><td>${totals.nur}</td><td>${totals.seed.toLocaleString()}</td></tr></tfoot>
      </table>

      <h2>Species Recorded</h2>
      <table><thead><tr><th>Scientific name</th><th>Common name</th><th>Occurrences</th><th>Culms recorded</th></tr></thead><tbody>${spRows}</tbody></table>

      <h2>Establishments by Type</h2>
      <table><thead><tr><th>Type</th><th>Count</th></tr></thead><tbody>${estRows}</tbody></table>

      <h2>Nursery Records by Status</h2>
      <table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>${nurRows}</tbody></table>

      <p class="stamp" style="margin-top:30px">© 2026 Cordillera Bamboo Program · CAR State Universities and Colleges · CARBambase prototype.</p>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups to view the summary report."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  /* --------------------------------------------------------------------- */
  /* REQUEST DATA — form                                                    */
  /* --------------------------------------------------------------------- */
  function renderRequestForm() {
    const datasets = ["Occurrences", "Species", "Establishments", "Nurseries", "Map / spatial layers"];
    $("#pane-request").innerHTML = `
      <h2 class="section-title">Request Data</h2>
      <p class="section-sub">Researchers, agencies, and partners may request access to bamboo datasets. Complete the form and the data management team will respond.</p>
      <div class="request-layout">
        <form id="reqForm" class="req-form" novalidate>
          <div class="field-row">
            <label>Full name *<input type="text" name="name" required placeholder="Juan Dela Cruz"></label>
            <label>Email *<input type="email" name="email" required placeholder="name@example.com"></label>
          </div>
          <div class="field-row">
            <label>Organization / Affiliation *<input type="text" name="org" required placeholder="University / Agency / LGU"></label>
            <label>Contact number<input type="text" name="phone" placeholder="+63 9xx xxx xxxx"></label>
          </div>

          <label class="block-label">Datasets requested *</label>
          <div class="checks">
            ${datasets.map((d) => `<label class="chk"><input type="checkbox" name="datasets" value="${esc(d)}"> ${esc(d)}</label>`).join("")}
          </div>

          <div class="field-row">
            <label>Preferred format
              <select name="format"><option>CSV</option><option>Microsoft Excel (.xlsx)</option><option>GeoJSON / shapefile</option><option>PDF report</option></select>
            </label>
            <label>Intended use *
              <select name="useType" required>
                <option value="">Select…</option>
                <option>Academic research</option><option>Government / policy</option>
                <option>Conservation / NGO</option><option>Commercial / enterprise</option><option>Education</option><option>Other</option>
              </select>
            </label>
          </div>

          <label class="block-label">Purpose / description of request *
            <textarea name="purpose" rows="4" required placeholder="Briefly describe how the data will be used…"></textarea>
          </label>

          <label class="chk" style="margin:6px 0 14px"><input type="checkbox" name="agree" required> I agree to use the data responsibly and to cite the Cordillera Bamboo Program as the source. *</label>

          <div class="form-error" id="reqError" style="display:none"></div>
          <button type="submit" class="btn-primary">Submit Request</button>
        </form>

        <aside class="req-aside">
          <h4>How requests are handled</h4>
          <ol class="req-steps">
            <li>Submit this form with your intended use.</li>
            <li>The data management team reviews the request (typically 3–5 working days).</li>
            <li>Approved datasets are shared in your preferred format with usage terms.</li>
          </ol>
          <p class="muted" style="font-size:.85rem">For urgent or bulk requests, coordinate directly with the lead implementing SUC.</p>
        </aside>
      </div>`;

    $("#reqForm").addEventListener("submit", submitRequest);
  }

  function submitRequest(e) {
    e.preventDefault();
    const f = e.target;
    const el = (n) => f.elements[n];
    const data = {
      name: el("name").value.trim(),
      email: el("email").value.trim(),
      org: el("org").value.trim(),
      phone: el("phone").value.trim(),
      datasets: $$('input[name="datasets"]:checked', f).map((c) => c.value),
      format: el("format").value,
      useType: el("useType").value,
      purpose: el("purpose").value.trim(),
      agree: el("agree").checked,
    };
    const errEl = $("#reqError");
    const problems = [];
    if (!data.name) problems.push("full name");
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) problems.push("a valid email");
    if (!data.org) problems.push("organization");
    if (!data.datasets.length) problems.push("at least one dataset");
    if (!data.useType) problems.push("intended use");
    if (!data.purpose) problems.push("purpose");
    if (!data.agree) problems.push("agreement to the usage terms");
    if (problems.length) {
      errEl.style.display = "block";
      errEl.textContent = "Please provide: " + problems.join(", ") + ".";
      errEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const ref = "REQ-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);
    const body = encodeURIComponent(
      `Data Request ${ref}\n\nName: ${data.name}\nEmail: ${data.email}\nOrganization: ${data.org}\nContact: ${data.phone || "—"}\n` +
        `Datasets: ${data.datasets.join(", ")}\nFormat: ${data.format}\nIntended use: ${data.useType}\n\nPurpose:\n${data.purpose}\n`
    );
    const mailto = `mailto:geoinformatics@bsu.edu.ph?subject=${encodeURIComponent("Bamboo Data Request " + ref)}&body=${body}`;
    window.location.href = mailto;

    $("#pane-request").innerHTML = `
      <div class="request-success">
        <div class="success-check">✓</div>
        <h2>Almost done — send the email</h2>
        <p class="muted">Thank you, ${esc(data.name)}. Your email app should now be open with the request below pre-filled and addressed to <strong>geoinformatics@bsu.edu.ph</strong> — just press <strong>Send</strong> to complete your request.</p>
        <div class="ref-badge">Reference no. <strong>${ref}</strong></div>
        <table class="taxon-table" style="max-width:520px;margin:18px auto 0;text-align:left">
          <tr><td>Organization</td><td>${esc(data.org)}</td></tr>
          <tr><td>Email</td><td>${esc(data.email)}</td></tr>
          <tr><td>Datasets</td><td>${esc(data.datasets.join(", "))}</td></tr>
          <tr><td>Format</td><td>${esc(data.format)}</td></tr>
          <tr><td>Intended use</td><td>${esc(data.useType)}</td></tr>
        </table>
        <div class="disclaimer" style="max-width:520px;margin:18px auto">Email app didn't open? Use the button below, or send the details above to <strong>geoinformatics@bsu.edu.ph</strong> quoting your reference number.</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <a class="btn-primary" href="${mailto}">✉ Open email draft again</a>
          <button class="btn-ghost" onclick="App.resetRequest()">Submit another request</button>
        </div>
      </div>`;
  }

  function resetRequest() { renderRequestForm(); }

  /* --------------------------------------------------------------------- */
  /* Table row -> map focus                                                 */
  /* --------------------------------------------------------------------- */
  // go() routes to the home Map tab but snaps the page back to the hero; pull the
  // "Distribution & Suitability Map" section into view instead of making the user
  // scroll down manually.
  function scrollToMapSection() {
    const doScroll = () => {
      const el = document.getElementById("pane-map");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 320); // re-assert once the hero finishes sizing
  }

  function showOccurrenceOnMap(id) {
    const o = DATA.OCCURRENCES.find((x) => x.id === id);
    go("home", "map");
    scrollToMapSection();
    if (!o) return;
    const color = (DATA.OCC_SPECIES_BY_ID[o.speciesId] || {}).color || "#d81b60";
    const html =
      `<strong class="sci">${esc(o.scientific)}</strong><br><span style="color:#666">${esc(o.common || "")}</span><br><br>` +
      `<b>${esc(o.municipality)}</b>, ${esc(o.province)}<br>` +
      (o.culms != null ? `Culms: <b>${o.culms.toLocaleString()}</b><br>` : "") +
      `Elevation: <b>${o.elevation.toLocaleString()} m</b><br>` +
      `<span style="color:#888;font-size:.85em">${o.lat.toFixed(5)}, ${o.lon.toFixed(5)}</span>`;
    setTimeout(() => BamMap.focusPoint(o.lat, o.lon, html, color), 420);
  }
  function showEstablishmentOnMap(id) {
    go("home", "map");
    scrollToMapSection();
    const cb = $("#tgEst");
    if (cb) cb.checked = true;
    setTimeout(() => BamMap.focusEstablishment(id), 420);
  }

  /* --------------------------------------------------------------------- */
  /* ABOUT                                                                  */
  /* --------------------------------------------------------------------- */
  function renderAbout() {
    const objectives = [
      ["🎋", "Harness natural stands", "Develop and harness the naturally growing bamboo plants in the provinces of Abra, Apayao, Benguet, Ifugao, Kalinga, and Mountain Province."],
      ["🌱", "Bamboo nurseries", "Develop bamboo setum nurseries that produce an abundant supply of planting materials of various useful varieties."],
      ["🌾", "Plantation areas", "Establish plantation areas for farm demonstration and research purposes."],
      ["🧺", "Marketable products", "Develop environmentally friendly bamboo products targeting both small and large-scale uses and markets."],
      ["🏪", "Market linkages", "Harness marketing outlets that bring significant economic returns to bamboo farmers and MSMEs in the countryside."],
      ["⚙️", "Processing machinery", "Fabricate or use cost-efficient machines that process bamboo into finished products for large-scale commercial uses, such as trellises for vegetable production."],
      ["🧵", "Bamboo rayon", "Produce rayon from bamboo (cellulose derivatives) for textile and fabric use."],
      ["♻️", "Residue utilization", "Utilize field and mill residues to produce bio-organic fertilizers and other products."],
    ].map(([icon, t, d]) => `<div class="feature-card"><div class="feature-icon">${icon}</div><h3>${t}</h3><p>${d}</p></div>`).join("");

    const components = [
      ["🔬", "Research &amp; Development", "Technology-driven R&amp;D in plantation management, marketable products for post-COVID-19 economic recovery, bamboo rayon production, and the use of field and mill residues for bio-organic fertilizers — alongside the fabrication or adoption of cost-efficient machines for large-scale bamboo processing."],
      ["🎓", "Extension &amp; Training", "Bamboo nurseries producing planting materials for distribution to interested farmers, techno-demo farms showcasing technologies to cooperators and adopters, technology books and flyers, and needs-based training to build the capacity of bamboo growers."],
      ["🤝", "Partnerships", "The six CAR SUCs partner with their Provincial Local Governments to strengthen program implementation, and collaborate with DOST-FPRDI, the PBIDC, and CHED to harness research and development gains for the bamboo industry."],
    ].map(([icon, t, d]) => `<div class="feature-card"><div class="feature-icon">${icon}</div><h3>${t}</h3><p>${d}</p></div>`).join("");

    const provinces = ["Abra", "Apayao", "Benguet", "Ifugao", "Kalinga", "Mountain Province"]
      .map((p) => `<span class="chip-lg">${p}</span>`).join("");

    $("#about-root").innerHTML = `
      <div class="breadcrumb"><a onclick="App.go('home')">Home</a> › About</div>
      <h1 class="page-title">About the Program</h1>
      <p class="page-sub"><strong>CAR-SUCs Regional Collaboration Program on Bamboo Industry Development for Environment Conservation and Countryside Post-Covid Economic Boom</strong> — a collaborative research, development, and extension (RDE) program of the State Universities and Colleges of the Cordillera Administrative Region.</p>

      <div class="about-intro">
        <p>The program aims to conserve the environment, mitigate the impact of climate change, and provide sustainable livelihoods for people in the countryside who were severely affected by the COVID-19 pandemic. It pursues its objectives in line with the Philippine Bamboo Industry Roadmap — developing the region's bamboo resources into an industry that restores forest cover while bringing economic returns to farmers and MSMEs.</p>
      </div>

      <h2 class="section-title" style="margin-top:36px">Program at a Glance</h2>
      <table class="taxon-table" style="max-width:920px">
        <tr><td>Implementing SUCs</td><td>Ifugao State University (IFSU), Apayao State College (ASC), Abra State Institute of Science &amp; Technology (ASIST), Kalinga State University (KSU), Benguet State University (BSU), and Mountain Province State University (MPSU)</td></tr>
        <tr><td>Partner organizations</td><td>DOST – Forest Products Research and Development Institute (FPRDI), Philippine Bamboo Industry Development Council (PBIDC), and Commission on Higher Education (CHED)</td></tr>
        <tr><td>Duration</td><td>January 2024 – December 2027 (3-year implementation period)</td></tr>
        <tr><td>Coverage</td><td>This program covers, but is not limited to, the six provinces of the Cordillera Administrative Region</td></tr>
      </table>

      <h2 class="section-title" style="margin-top:44px">Background &amp; Rationale</h2>
      <div class="prose" style="max-width:1800px;color:#3f3d31;line-height:1.7">
        <p>Bamboos have traditionally populated the natural forest cover of the Philippines, contributing to diverse yet balanced ecosystems. Efforts to restore the country's forest cover should therefore include planting bamboo in suitable environments to aid in restoring the forests' ability to mitigate climate change, retain and sustain water sources, and keep soil firm against large-scale erosion and landslides, while offering an alternative to timber for construction, furniture, and even trellises for vegetable farming. The industry's potential is remarkable: global exports of bamboo and bamboo products are estimated at US$12 billion, and Philippine exports were valued at US$10 million in 2014. Bamboo production and processing provide direct and indirect employment to an estimated 190,000 people which can continue to rise with the right support system in place. In the Cordillera, expanding bamboo plantations will help conserve the water resources that irrigate agricultural farms prevent the soil erosion and landslides that have caused significant damage to lives and properties, and supply raw materials for house construction, furniture, handicrafts, trellises, fences, and animal cages, reducing pressure on unlawful and environmentally damaging timber extraction. Government support has grown steadily: Executive Order 879 (2010) established the Philippine Bamboo Industry and mandated that at least 25% of desk and furniture needs of public schools use indigenous materials; House Bill No. 3469 and Memorandum Circular No. 30 s. 2012 followed to ensure full implementation; and the Philippine Bamboo Industry Development Council now provides policy and program direction for the industry's stakeholders.</p>
      </div>

      <h2 class="section-title" style="margin-top:44px">Program Objectives</h2>
      <p class="section-sub">Eight objectives aligned with the Philippine Bamboo Industry Roadmap.</p>
      <div class="feature-grid">${objectives}</div>

      <h2 class="section-title" style="margin-top:44px">Program Components</h2>
      <div class="feature-grid">${components}</div>

      <h2 class="section-title" style="margin-top:44px">Coverage</h2>
      <p class="section-sub">Implemented across the six provinces of the Cordillera Administrative Region.</p>
      <div class="chip-row">${provinces}</div>

      <div class="cta-band">
        <div>
          <h3 style="color:#fff;margin:0 0 4px">Powered by a regional consortium</h3>
          <p style="margin:0;color:rgba(243,239,228,.85)">Six State Universities and Colleges with their Provincial LGUs, DOST-FPRDI, PBIDC, CHED, and partner SUCs drive the program forward.</p>
        </div>
        <button class="btn-ghost" onclick="App.go('home','partners')">Meet the partners →</button>
      </div>`;
  }

  /* --------------------------------------------------------------------- */
  /* CONTRIBUTE DATA                                                        */
  /* --------------------------------------------------------------------- */
  function renderContribute() {
    const types = ["Occurrence records", "Species information", "Establishment", "Nursery monitoring", "Products", "Publications", "Other"];
    const provinces = ["Abra", "Apayao", "Benguet", "Ifugao", "Kalinga", "Mountain Province"];
    $("#contribute-root").innerHTML = `
      <div class="breadcrumb"><a onclick="App.go('home')">Home</a> › Contribute</div>
      <h1 class="page-title">Contribute Data</h1>
      <p class="page-sub">Partner SUCs, agencies, LGUs, and community groups can submit bamboo data to be included in the database. Every contribution helps build a complete regional picture.</p>

      <div class="review-note">
        <span class="review-ico">🛡️</span>
        <div><strong>All submissions are reviewed before publishing.</strong> Contributed data undergoes validation and quality review by the program's data management team. Records are only published on the site once verified — this keeps the database accurate and trustworthy.</div>
      </div>

      <div class="request-layout">
        <form id="contribForm" class="req-form" novalidate>
          <div class="field-row">
            <label>Contributor name *<input type="text" name="name" required placeholder="Juan Dela Cruz"></label>
            <label>Email *<input type="email" name="email" required placeholder="name@example.com"></label>
          </div>
          <div class="field-row">
            <label>Organization / SUC *<input type="text" name="org" required placeholder="University / Agency / LGU"></label>
            <label>Role / position<input type="text" name="role" placeholder="e.g. Researcher, Forester"></label>
          </div>
          <div class="field-row">
            <label>Type of data *
              <select name="dtype" required><option value="">Select…</option>${types.map((t) => `<option>${esc(t)}</option>`).join("")}</select>
            </label>
            <label>Province covered
              <select name="province"><option value="">Region-wide / N/A</option>${provinces.map((p) => `<option>${esc(p)}</option>`).join("")}</select>
            </label>
          </div>
          <div class="field-row">
            <label>Municipality / locality<input type="text" name="locality" placeholder="e.g. Tabuk City"></label>
            <label>Approx. number of records<input type="text" name="count" placeholder="e.g. 25"></label>
          </div>

          <label class="block-label">Description of the dataset *
            <textarea name="desc" rows="4" required placeholder="Describe what the data contains, how and when it was collected, and any methods or sources…"></textarea>
          </label>

          <label class="block-label">Attach data file (CSV / Excel) — optional
            <input type="file" name="file" accept=".csv,.xlsx,.xls,.zip,.geojson">
          </label>

          <label class="chk" style="margin:6px 0 14px"><input type="checkbox" name="agree" required> I confirm the data is accurate to the best of my knowledge and consent to its review and possible publication, with attribution to the source. *</label>

          <div class="form-error" id="contribError" style="display:none"></div>
          <button type="submit" class="btn-primary">Submit for Review</button>
        </form>

        <aside class="req-aside">
          <h4>Review process</h4>
          <ol class="req-steps">
            <li><strong>Submit</strong> your dataset using this form.</li>
            <li><strong>Review &amp; validation</strong> by the data management team (typically 5–10 working days).</li>
            <li><strong>Publication</strong> on the site once verified — you'll be credited as the source.</li>
          </ol>
          <p class="muted" style="font-size:.85rem">Need a standard template? Request the data-contribution format from the <a onclick="App.go('contact')">program office</a>.</p>
        </aside>
      </div>`;

    $("#contribForm").addEventListener("submit", submitContribute);
  }

  function submitContribute(e) {
    e.preventDefault();
    const f = e.target;
    const el = (n) => f.elements[n];
    const data = {
      name: el("name").value.trim(),
      email: el("email").value.trim(),
      org: el("org").value.trim(),
      dtype: el("dtype").value,
      province: el("province").value || "Region-wide / N/A",
      locality: el("locality").value.trim(),
      count: el("count").value.trim(),
      desc: el("desc").value.trim(),
      file: (el("file").files && el("file").files[0]) ? el("file").files[0].name : "—",
      agree: el("agree").checked,
    };
    const problems = [];
    if (!data.name) problems.push("contributor name");
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) problems.push("a valid email");
    if (!data.org) problems.push("organization");
    if (!data.dtype) problems.push("type of data");
    if (!data.desc) problems.push("a description");
    if (!data.agree) problems.push("the confirmation checkbox");
    const errEl = $("#contribError");
    if (problems.length) {
      errEl.style.display = "block";
      errEl.textContent = "Please provide: " + problems.join(", ") + ".";
      errEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const ref = "SUB-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);
    const body = encodeURIComponent(
      `Data Contribution ${ref}\n\nName: ${data.name}\nEmail: ${data.email}\nOrganization: ${data.org}\n` +
        `Type of data: ${data.dtype}\nProvince covered: ${data.province}\nMunicipality / locality: ${data.locality || "—"}\n` +
        `Approx. number of records: ${data.count || "—"}\nData file: ${data.file}\n\nDescription:\n${data.desc}\n`
    );
    const mailto = `mailto:geoinformatics@bsu.edu.ph?subject=${encodeURIComponent("Bamboo Data Contribution " + ref)}&body=${body}`;
    window.location.href = mailto;
    $("#contribute-root").innerHTML = `
      <div class="request-success">
        <div class="success-check">🛡️</div>
        <h2>Almost done — send the email</h2>
        <p class="muted">Thank you, ${esc(data.name)}. Your email app should now be open with the contribution details pre-filled and addressed to <strong>geoinformatics@bsu.edu.ph</strong> — just press <strong>Send</strong> to submit it for review.</p>
        <div class="ref-badge">Submission no. <strong>${ref}</strong> · <span style="color:var(--clay-800)">Status: Pending review</span></div>
        <table class="taxon-table" style="max-width:520px;margin:18px auto 0;text-align:left">
          <tr><td>Organization</td><td>${esc(data.org)}</td></tr>
          <tr><td>Data type</td><td>${esc(data.dtype)}</td></tr>
          <tr><td>Coverage</td><td>${esc(data.province)}</td></tr>
          <tr><td>Data file</td><td>${esc(data.file)}</td></tr>
        </table>
        ${data.file !== "—" ? `<div class="disclaimer" style="max-width:520px;margin:18px auto 0">📎 Please attach <strong>${esc(data.file)}</strong> to the email before sending — files cannot be attached automatically.</div>` : ""}
        <div class="review-note" style="max-width:560px;margin:18px auto;text-align:left"><span class="review-ico">🛡️</span><div>Your data <strong>will be reviewed and validated before publishing</strong> on the site. The team will contact you at <strong>${esc(data.email)}</strong> if clarification is needed.</div></div>
        <div class="disclaimer" style="max-width:520px;margin:0 auto 18px">Email app didn't open? Use the button below, or send the details above to <strong>geoinformatics@bsu.edu.ph</strong> quoting your submission number.</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <a class="btn-primary" href="${mailto}">✉ Open email draft again</a>
          <button class="btn-ghost" onclick="App.resetContribute()">Submit another contribution</button>
        </div>
      </div>`;
  }
  function resetContribute() { renderContribute(); }

  /* --------------------------------------------------------------------- */
  /* CONTACT                                                                */
  /* --------------------------------------------------------------------- */
  function renderContact() {
    const cards = [
      ["🧺", "ASIST", "Bamboo Fiber and Crafts", "Lagangilang, Abra", "asistmain@yahoo.com", "09455636208"],
      ["🧪", "ASC", "Bamboo Tissue Culture &amp; By-products", "Malama Conner, Apayao", "op_asc@yahoo.com", "(074) 634 0091"],
      ["📊", "BSU", "Data Management and Nursery R&amp;D", "La Trinidad, Benguet", "geoinformatics@bsu.edu.ph", "(074) 422 2402"],
      ["🍶", "IFSU", "Wine and Food Product Development", "Potia, Alfonso Lista, Ifugao", "ryan21tejada@gmail.com", "09994384619"],
      ["🛠️", "KSU", "Novelty and Engineered Bamboo Development &amp; By-products", "Tabuk City, Kalinga", "ksumail@ksu.edu.ph", "09972889367"],
      ["🏞️", "MPSU", "Bamboo Ecotourism and Amenities", "Bontoc, Mountain Province", "op@mpsu.edu.ph", "(074) 604 1551"],
    ].map(([ico, t, sub, addr, email, phone]) =>
      `<div class="contact-card"><div class="contact-ico">${ico}</div><h3>${t}</h3><p class="muted">${sub}</p>
        <p>📍 ${addr}<br>📧 <a href="mailto:${email}">${email}</a><br>📞 ${phone}</p></div>`
    ).join("");

    $("#contact-root").innerHTML = `
      <div class="breadcrumb"><a onclick="App.go('home')">Home</a> › Contact</div>
      <h1 class="page-title">Contact Us</h1>
      <p class="page-sub">Get in touch with the Cordillera Bamboo Program for inquiries, collaboration, data, or media engagements.</p>

      <div class="contact-grid">${cards}</div>

      <div class="request-layout" style="margin-top:30px">
        <form id="contactForm" class="req-form" novalidate>
          <div class="field-row">
            <label>Name *<input type="text" name="name" required placeholder="Your name"></label>
            <label>Email *<input type="email" name="email" required placeholder="name@example.com"></label>
          </div>
          <label>Subject *<input type="text" name="subject" required placeholder="How can we help?"></label>
          <label class="block-label">Message *
            <textarea name="message" rows="5" required placeholder="Write your message…"></textarea>
          </label>
          <div class="form-error" id="contactError" style="display:none"></div>
          <button type="submit" class="btn-primary">Send Message</button>
        </form>
        <aside class="req-aside">
          <h4>Office hours</h4>
          <p style="font-size:.9rem;color:#5a4f3a;margin-top:0">Monday – Friday<br>8:00 AM – 5:00 PM (PHT)</p>
          <h4 style="margin-top:16px">Quick links</h4>
          <p style="font-size:.9rem">
            <a onclick="App.go('about')">About the Program</a><br>
            <a onclick="App.go('contribute')">Contribute Data</a><br>
            <a onclick="App.go('home','request')">Request Data</a><br>
            <a onclick="App.go('home','partners')">Partners &amp; SUCs</a>
          </p>
        </aside>
      </div>`;

    $("#contactForm").addEventListener("submit", submitContact);
  }

  function submitContact(e) {
    e.preventDefault();
    const f = e.target;
    const el = (n) => f.elements[n];
    const data = { name: el("name").value.trim(), email: el("email").value.trim(), subject: el("subject").value.trim(), message: el("message").value.trim() };
    const problems = [];
    if (!data.name) problems.push("your name");
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) problems.push("a valid email");
    if (!data.subject) problems.push("a subject");
    if (!data.message) problems.push("a message");
    const errEl = $("#contactError");
    if (problems.length) {
      errEl.style.display = "block";
      errEl.textContent = "Please provide: " + problems.join(", ") + ".";
      errEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const mailto = `mailto:geoinformatics@bsu.edu.ph?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.message + "\n\n— " + data.name + " (" + data.email + ")")}`;
    window.location.href = mailto;
    $("#contact-root").innerHTML = `
      <div class="request-success">
        <div class="success-check">✓</div>
        <h2>Almost done — send the email</h2>
        <p class="muted">Thank you, ${esc(data.name)}. Your email app should now be open with your message pre-filled and addressed to <strong>geoinformatics@bsu.edu.ph</strong> — just press <strong>Send</strong>. We'll respond to <strong>${esc(data.email)}</strong> as soon as we can.</p>
        <div class="disclaimer" style="max-width:520px;margin:18px auto">Email app didn't open? Use the button below, or email us directly at <strong>geoinformatics@bsu.edu.ph</strong>.</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <a class="btn-primary" href="${mailto}">✉ Open email draft again</a>
          <button class="btn-ghost" onclick="App.resetContact()">Send another message</button>
        </div>
      </div>`;
  }
  function resetContact() { renderContact(); }

  /* --------------------------------------------------------------------- */
  /* Generic sortable table                                                 */
  /* --------------------------------------------------------------------- */
  function buildTable(container, columns, rows, options) {
    options = options || {};
    const pageSize = options.pageSize || 0;   // 0 = show all (no pagination)
    const state = { key: null, dir: 1, page: 0 };
    function render() {
      let data = rows.slice();
      if (state.key) {
        const col = columns.find((c) => c.key === state.key);
        data.sort((a, b) => {
          const va = col.sortVal ? col.sortVal(a) : a[state.key];
          const vb = col.sortVal ? col.sortVal(b) : b[state.key];
          if (va < vb) return -1 * state.dir;
          if (va > vb) return 1 * state.dir;
          return 0;
        });
      }
      const total = data.length;
      const pages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
      if (state.page >= pages) state.page = pages - 1;
      const start = pageSize ? state.page * pageSize : 0;
      const pageRows = pageSize ? data.slice(start, start + pageSize) : data;

      const head = columns
        .map(
          (c) =>
            `<th data-k="${c.key}">${esc(c.label)} ${
              state.key === c.key ? `<span class="arrow">${state.dir === 1 ? "▲" : "▼"}</span>` : ""
            }</th>`
        )
        .join("");
      const clickable = typeof options.onRowClick === "function";
      const body = pageRows
        .map((r, i) => `<tr${clickable ? ` class="row-link" data-i="${i}" tabindex="0"` : ""}>` + columns.map((c) => `<td>${c.render(r)}</td>`).join("") + "</tr>")
        .join("");

      let pager = "";
      if (pageSize && total > 0) {
        const from = start + 1, to = start + pageRows.length;
        pager = `<div class="pager">
          <button class="pg-btn" data-pg="first" ${state.page === 0 ? "disabled" : ""}>« First</button>
          <button class="pg-btn" data-pg="prev" ${state.page === 0 ? "disabled" : ""}>‹ Prev</button>
          <span class="pg-info">${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}</span>
          <button class="pg-btn" data-pg="next" ${state.page >= pages - 1 ? "disabled" : ""}>Next ›</button>
          <button class="pg-btn" data-pg="last" ${state.page >= pages - 1 ? "disabled" : ""}>Last »</button>
        </div>`;
      }

      container.innerHTML = `<div class="table-wrap"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${pager}`;
      $$("th", container).forEach((th) =>
        th.addEventListener("click", () => {
          const k = th.dataset.k;
          if (state.key === k) state.dir *= -1;
          else { state.key = k; state.dir = 1; }
          state.page = 0;
          render();
        })
      );
      $$(".pg-btn", container).forEach((b) =>
        b.addEventListener("click", () => {
          const a = b.dataset.pg;
          if (a === "first") state.page = 0;
          else if (a === "prev") state.page = Math.max(0, state.page - 1);
          else if (a === "next") state.page = Math.min(pages - 1, state.page + 1);
          else if (a === "last") state.page = pages - 1;
          render();
          container.scrollIntoView({ behavior: "smooth", block: "start" });
        })
      );
      if (clickable) {
        $$("tr.row-link", container).forEach((tr) => {
          const row = pageRows[+tr.dataset.i];
          tr.addEventListener("click", () => options.onRowClick(row));
          tr.addEventListener("keydown", (e) => { if (e.key === "Enter") options.onRowClick(row); });
        });
      }
    }
    render();
  }

  function spName(scientific, common, color) {
    return `<span class="sp-dot" style="background:${color}"></span><span class="sci-name">${esc(scientific)}</span><br><span class="muted" style="font-size:.85em">${esc(common)}</span>`;
  }

  /* --------------------------------------------------------------------- */
  /* OCCURRENCES                                                            */
  /* --------------------------------------------------------------------- */
  function renderOccurrences() {
    const root = $("#occ-root");
    const present = DATA.OCC_SPECIES.filter((s) => s.count > 0);
    const colorOf = (id) => (DATA.OCC_SPECIES_BY_ID[id] || {}).color || "#8a8a7a";

    // Precompute lookups used by the cross-filter:
    //  commonMap: common-name token -> Set(speciesId)  (source separates with "|")
    //  spTokens:  speciesId -> [tokens]
    //  muniProv:  municipality -> province
    const commonMap = {};
    const spTokens = {};
    present.forEach((s) => {
      const toks = (s.common || "").split("|").map((t) => t.trim()).filter(Boolean);
      spTokens[s.id] = toks;
      toks.forEach((t) => (commonMap[t] || (commonMap[t] = new Set())).add(s.id));
    });
    const cnHas = (tok, id) => !!(commonMap[tok] && commonMap[tok].has(id));
    const muniProv = {};
    DATA.OCCURRENCES.forEach((o) => (muniProv[o.municipality] = o.province));

    root.innerHTML = `
      <div class="breadcrumb"><a onclick="App.go('home')">Home</a> › Occurrences</div>
      <h1 class="page-title">Occurrences</h1>
      <p class="page-sub">Geo-referenced bamboo occurrence records across the Cordillera Administrative Region.</p>
      <div class="explorer-head">
        <div class="filters">
          <input type="search" id="occSearch" placeholder="Search species, common name, municipality…"/>
          <select id="occSpecies"><option value="">All species</option></select>
          <select id="occCommon"><option value="">All common names</option></select>
          <select id="occMunicipality"><option value="">All municipalities</option></select>
          <select id="occProvince"><option value="">All provinces</option></select>
          <button type="button" id="occClear" class="btn-clear">✕ Clear filters</button>
        </div>
        <div class="result-count" id="occCount"></div>
      </div>
      <div class="map-tip">📍 Tip: click any row to locate that occurrence on the interactive map.</div>
      <div id="occTable"></div>`;

    const columns = [
      { key: "scientific", label: "Scientific name", sortVal: (r) => r.scientific, render: (r) => spName(r.scientific, r.common || "—", colorOf(r.speciesId)) },
      { key: "municipality", label: "Municipality", render: (r) => esc(r.municipality) },
      { key: "province", label: "Province", render: (r) => esc(r.province) },
      { key: "culms", label: "# Culms", sortVal: (r) => (r.culms == null ? -1 : r.culms), render: (r) => (r.culms == null ? '<span class="muted">—</span>' : r.culms.toLocaleString()) },
      { key: "lon", label: "Longitude", sortVal: (r) => r.lon, render: (r) => r.lon.toFixed(5) },
      { key: "lat", label: "Latitude", sortVal: (r) => r.lat, render: (r) => r.lat.toFixed(5) },
      { key: "elevation", label: "Elev. (m)", sortVal: (r) => r.elevation, render: (r) => r.elevation.toLocaleString() },
    ];

    const els = { sp: $("#occSpecies"), cn: $("#occCommon"), mu: $("#occMunicipality"), pr: $("#occProvince") };
    const text = (o) => `${o.scientific} ${o.common || ""} ${o.municipality} ${o.province}`.toLowerCase();
    const readSel = () => ({ sp: els.sp.value, cn: els.cn.value, mu: els.mu.value, pr: els.pr.value });

    // Does record o satisfy the dropdown filters, ignoring the `except` field?
    // (the free-text search is applied separately, up front.)
    function passSel(o, f, except) {
      if (except !== "sp" && f.sp && o.speciesId !== f.sp) return false;
      if (except !== "cn" && f.cn && !cnHas(f.cn, o.speciesId)) return false;
      if (except !== "mu" && f.mu && o.municipality !== f.mu) return false;
      if (except !== "pr" && f.pr && o.province !== f.pr) return false;
      return true;
    }

    // Available values for each field = distinct values among records that pass
    // every OTHER active filter (that's what makes the fields cross-narrow), with
    // a live count per value.
    function facets(base, f) {
      const sp = new Map(), cn = new Map(), mu = new Map(), pr = new Map();
      const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
      for (const o of base) {
        if (passSel(o, f, "sp")) inc(sp, o.speciesId);
        if (passSel(o, f, "mu")) inc(mu, o.municipality);
        if (passSel(o, f, "pr")) inc(pr, o.province);
        if (passSel(o, f, "cn")) { const t = spTokens[o.speciesId] || []; for (const x of t) inc(cn, x); }
      }
      return { sp, cn, mu, pr };
    }

    // If a change made a current selection impossible, clear it (may cascade).
    // `keep` = the field the user just changed; it is never cleared, so the most
    // recent choice always wins and the conflicting older filter is dropped.
    function reconcile(base, f, keep) {
      for (let i = 0; i < 4; i++) {
        const fac = facets(base, f);
        let changed = false;
        if (keep !== "sp" && f.sp && !fac.sp.has(f.sp)) { f.sp = ""; changed = true; }
        if (keep !== "cn" && f.cn && !fac.cn.has(f.cn)) { f.cn = ""; changed = true; }
        if (keep !== "mu" && f.mu && !fac.mu.has(f.mu)) { f.mu = ""; changed = true; }
        if (keep !== "pr" && f.pr && !fac.pr.has(f.pr)) { f.pr = ""; changed = true; }
        if (!changed) break;
      }
      return f;
    }

    function fillSpecies(fac, sel) {
      const opts = present.filter((s) => fac.sp.has(s.id)).sort((a, b) => a.scientific.localeCompare(b.scientific));
      els.sp.innerHTML = `<option value="">All species (${opts.length})</option>` +
        opts.map((s) => `<option value="${esc(s.id)}">${esc(s.scientific)} (${fac.sp.get(s.id).toLocaleString()})</option>`).join("");
      els.sp.value = sel;
    }
    function fillCommon(fac, sel) {
      const toks = [...fac.cn.keys()].sort((a, b) => a.localeCompare(b));
      els.cn.innerHTML = `<option value="">All common names (${toks.length})</option>` +
        toks.map((t) => `<option value="${esc(t)}">${esc(t)} (${fac.cn.get(t).toLocaleString()})</option>`).join("");
      els.cn.value = sel;
    }
    function fillMunicipality(fac, sel) {
      const groups = {};
      [...fac.mu.keys()].forEach((m) => (groups[muniProv[m]] || (groups[muniProv[m]] = [])).push(m));
      const html = Object.keys(groups).sort().map((p) =>
        `<optgroup label="${esc(p)}">` + groups[p].sort()
          .map((m) => `<option value="${esc(m)}">${esc(m)} (${fac.mu.get(m).toLocaleString()})</option>`).join("") + `</optgroup>`
      ).join("");
      els.mu.innerHTML = `<option value="">All municipalities (${fac.mu.size})</option>` + html;
      els.mu.value = sel;
    }
    function fillProvince(fac, sel) {
      const provs = [...fac.pr.keys()].sort();
      els.pr.innerHTML = `<option value="">All provinces (${provs.length})</option>` +
        provs.map((p) => `<option value="${esc(p)}">${esc(p)} (${fac.pr.get(p).toLocaleString()})</option>`).join("");
      els.pr.value = sel;
    }

    function apply(keep) {
      const q = $("#occSearch").value.toLowerCase().trim();
      const base = q ? DATA.OCCURRENCES.filter((o) => text(o).includes(q)) : DATA.OCCURRENCES;
      const f = reconcile(base, readSel(), keep);
      const fac = facets(base, f);
      fillSpecies(fac, f.sp);
      fillCommon(fac, f.cn);
      fillMunicipality(fac, f.mu);
      fillProvince(fac, f.pr);
      const rows = base.filter((o) => passSel(o, f, null));
      $("#occCount").textContent = `${rows.length.toLocaleString()} of ${DATA.OCCURRENCES.length.toLocaleString()} records`;
      $("#occClear").disabled = !(q || f.sp || f.cn || f.mu || f.pr);
      buildTable($("#occTable"), columns, rows, { onRowClick: (r) => showOccurrenceOnMap(r.id), pageSize: 50 });
    }
    const fieldOf = { occSpecies: "sp", occCommon: "cn", occMunicipality: "mu", occProvince: "pr" };
    ["occSearch", "occSpecies", "occCommon", "occMunicipality", "occProvince"].forEach((id) => {
      $("#" + id).addEventListener(id === "occSearch" ? "input" : "change", () => apply(fieldOf[id] || null));
    });
    $("#occClear").addEventListener("click", () => {
      $("#occSearch").value = "";
      els.sp.value = ""; els.cn.value = ""; els.mu.value = ""; els.pr.value = "";
      apply();
    });

    if (pendingSearch.occurrences) { $("#occSearch").value = pendingSearch.occurrences; pendingSearch.occurrences = ""; }
    apply();
  }

  /* --------------------------------------------------------------------- */
  /* SPECIES — gallery + carousel + detail modal                            */
  /* --------------------------------------------------------------------- */
  function renderSpecies() {
    const root = $("#sp-root");
    const all = DATA.OCC_SPECIES;

    const card = (s, wide) => `<div class="card${wide ? " wide" : ""}" onclick="App.modalSpecies('${s.id}')">
        <img class="thumb" loading="lazy" src="${s.image || artSVG(s.color, s.scientific, "species")}" alt="${esc(s.scientific)}"${s.imageCredit ? ` title="Photo: ${esc(s.imageCredit)}"` : ""}/>
        <div class="body">
          <h3 class="sci-name">${esc(s.scientific)}</h3>
          <div class="meta">${esc(s.common || "—")}</div>
          <div class="sp-tags">
            <span class="pill tan">${esc(speciesHabitType(s.habit))}</span>
            ${s.distribution ? `<span class="pill ${distClass(s.distribution)}">${esc(s.distribution)}</span>` : ""}
            ${s.redlist ? `<span class="pill dao">${esc(s.redlist)}</span>` : ""}
            ${s.count ? `<span class="pill soft">${s.count.toLocaleString()} records</span>` : `<span class="pill soft">BSU Nursery</span>`}
          </div>
          ${s.synonyms && s.synonyms.length ? `<div class="sp-syn">${formatSynonyms(s.synonyms)}</div>` : ""}
          ${wide ? `<div class="desc">${esc((s.description || "").slice(0, 95))}${(s.description || "").length > 95 ? "…" : ""}</div>` : ""}
        </div>
      </div>`;

    const bySci = all.slice().sort((a, b) => a.scientific.localeCompare(b.scientific));
    // searchable text per species: scientific + all common names + synonyms +
    // distribution + red-list + provinces + habit type + uses + description
    const searchText = (s) => [
      s.scientific, s.common, s.distribution, s.redlist,
      (s.provinces || []).join(" "),
      (s.synonyms || []).map((x) => x.n).join(" "),
      speciesHabitType(s.habit), s.uses, s.description,
    ].join(" ").toLowerCase();

    root.innerHTML = `
      <div class="breadcrumb"><a onclick="App.go('home')">Home</a> › Species</div>
      <h1 class="page-title">Bamboo Species</h1>
      <div class="explorer-head">
        <div class="filters filters--grow">
          <input type="search" id="spSearch" placeholder="Search species, common name, synonym, province…"/>
        </div>
        <div class="result-count" id="spCount"></div>
      </div>
      <div class="grid cols-4" id="spGrid" style="margin-top:6px"></div>`;

    function apply() {
      const q = $("#spSearch").value.toLowerCase().trim();
      const rows = q ? bySci.filter((s) => searchText(s).includes(q)) : bySci;
      $("#spCount").textContent = `${rows.length} of ${all.length} species`;
      $("#spGrid").innerHTML = rows.length
        ? rows.map((s) => card(s, false)).join("")
        : `<div class="muted" style="grid-column:1/-1;padding:24px 4px">No species match “${esc(q)}”.</div>`;
    }
    $("#spSearch").addEventListener("input", apply);

    if (pendingSearch.species) { $("#spSearch").value = pendingSearch.species; pendingSearch.species = ""; }
    apply();
  }

  // Short habit label ("Clumping" / "Running" / "Climbing") from the full note.
  function speciesHabitType(h) {
    if (/run/i.test(h)) return "Running";
    if (/(climb|scandent|scrambl)/i.test(h)) return "Climbing";
    if (/clump/i.test(h)) return "Clumping";
    return h ? h.split(/[ ,(]/)[0] : "—";
  }

  // Tag color class by distribution: red exotic, blue naturalized, green native/endemic.
  function distClass(d) {
    if (/exotic/i.test(d)) return "exotic";
    if (/naturaliz/i.test(d)) return "naturalized";
    if (/native|endemic/i.test(d)) return "native";
    return "";
  }

  // Inline SVG mini-map of the 6 CAR provinces; provinces in `highlight`
  // (the species' checklist provinces) are filled in the species color.
  function provinceMap(highlight, color) {
    const data = typeof window !== "undefined" && window.CAR_PROVINCES;
    if (!data || !data.provinces) return "";
    const hi = new Set((highlight || []).map((p) => String(p).trim()));
    const SHORT = { "Mountain Province": "Mt. Prov." };
    const shapes = data.provinces.map((pr) => {
      const on = hi.has(pr.name);
      return `<path d="${pr.path}" fill="${on ? color : "#e7e3d7"}" stroke="#fff" stroke-width="0.9" opacity="${on ? 0.95 : 0.55}"><title>${esc(pr.name)}</title></path>`;
    }).join("");
    const labels = data.provinces.map((pr) => {
      const on = hi.has(pr.name);
      return `<text x="${pr.cx}" y="${pr.cy}" text-anchor="middle" dominant-baseline="middle" font-size="8" font-weight="${on ? 700 : 500}" fill="${on ? "#fff" : "#8a8676"}" paint-order="stroke" stroke="${on ? "rgba(0,0,0,.3)" : "rgba(255,255,255,.8)"}" stroke-width="0.6">${esc(SHORT[pr.name] || pr.name)}</text>`;
    }).join("");
    return `<svg class="prov-map" viewBox="${data.viewBox}" role="img" aria-label="CAR provinces where the species is found">${shapes}${labels}</svg>`;
  }

  // Render synonyms grouped by marker: "≡ homotypic names   = heterotypic names".
  function formatSynonyms(syn) {
    if (!syn || !syn.length) return "";
    const groups = {};
    syn.forEach((x) => (groups[x.s] || (groups[x.s] = [])).push(x.n));
    return ["≡", "="]
      .filter((sym) => groups[sym])
      .map((sym) => `<span class="syn-sym">${sym}</span> ` + groups[sym].map((n) => `<em>${esc(n)}</em>`).join(", "))
      .join(" &nbsp; ");
  }

  /* --------------------------------------------------------------------- */
  /* ESTABLISHMENTS — matrix                                                */
  /* --------------------------------------------------------------------- */
  function renderEstablishments() {
    const root = $("#est-root");
    const all = DATA.ESTABLISHMENTS;
    const provinces = [...new Set(all.map((e) => e.province))].sort();
    const types = [...new Set(all.map((e) => e.type))].sort();
    const dash = '<span class="muted">—</span>';

    root.innerHTML = `
      <div class="breadcrumb"><a onclick="App.go('home')">Home</a> › Establishments</div>
      <h1 class="page-title">Establishments</h1>
      <p class="page-sub">Bamboo establishments across the Cordillera — bambuseta, nurseries, plantations, demo farms, and parks.</p>
      <div class="explorer-head">
        <div class="filters">
          <input type="search" id="estSearch" placeholder="Search name, municipality, species…"/>
          <select id="estType"><option value="">All types</option>${types.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>
          <select id="estProvince"><option value="">All provinces</option>${provinces.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("")}</select>
        </div>
        <div class="result-count" id="estCount"></div>
      </div>
      <div class="map-tip">📍 Tip: click a row to locate that establishment on the map (where coordinates are available).</div>
      <div id="estTable"></div>`;

    const columns = [
      { key: "type", label: "Type", render: (r) => `<span class="tag-cell" style="background:var(--forest-100);color:var(--forest-800)">${esc(r.type)}</span>` },
      { key: "name", label: "Establishment", render: (r) => `<strong>${esc(r.name)}</strong>` },
      { key: "municipality", label: "Municipality", render: (r) => esc(r.municipality) },
      { key: "province", label: "Province", render: (r) => esc(r.province) },
      { key: "area", label: "Size / Area", sortVal: (r) => (r.areaHa == null ? -1 : r.areaHa), render: (r) => (r.areaDisplay ? esc(r.areaDisplay) : dash) },
      { key: "species", label: "Species", render: (r) => (r.species && r.species.length ? `<div class="species-mini">${r.species.map((n) => `<span class="chip">${esc(n)}</span>`).join("")}</div>` : dash) },
      { key: "year", label: "Est.", sortVal: (r) => (typeof r.year === "number" ? r.year : 0), render: (r) => (r.year ? esc(String(r.year)) : dash) },
    ];

    function apply() {
      const q = $("#estSearch").value.toLowerCase().trim();
      const t = $("#estType").value, pr = $("#estProvince").value;
      const rows = all.filter((e) => {
        if (t && e.type !== t) return false;
        if (pr && e.province !== pr) return false;
        if (q && !`${e.name} ${e.municipality} ${e.province} ${(e.species || []).join(" ")}`.toLowerCase().includes(q)) return false;
        return true;
      });
      $("#estCount").textContent = `${rows.length} of ${all.length} establishments`;
      buildTable($("#estTable"), columns, rows, { onRowClick: (r) => showEstablishmentOnMap(r.id) });
    }
    $("#estSearch").addEventListener("input", apply);
    $("#estType").addEventListener("change", apply);
    $("#estProvince").addEventListener("change", apply);
    if (pendingSearch.establishments) { $("#estSearch").value = pendingSearch.establishments; pendingSearch.establishments = ""; }
    apply();
  }

  /* --------------------------------------------------------------------- */
  /* NURSERIES — monitoring matrix                                          */
  /* --------------------------------------------------------------------- */
  function renderNurseries() {
    const root = $("#nur-root");
    const all = DATA.NURSERIES;
    const nurseries = [...new Set(all.map((n) => n.nursery))].sort();
    const types = [...new Set(all.map((n) => n.type))].sort();
    // species present in the nursery data (id -> scientific), for the dropdown
    const spMap = {};
    all.forEach((n) => { if (n.speciesId && !spMap[n.speciesId]) spMap[n.speciesId] = n.scientific; });
    const species = Object.entries(spMap).sort((a, b) => a[1].localeCompare(b[1]));
    const totalSeedlings = all.reduce((s, n) => s + (n.count || 0), 0);

    root.innerHTML = `
      <div class="breadcrumb"><a onclick="App.go('home')">Home</a> › Nurseries</div>
      <h1 class="page-title">Nursery Monitoring</h1>
      <p class="page-sub">Bamboo planting materials across the program's nurseries — species, source type, seedling counts, provenance, and status. ${all.length} records · ${totalSeedlings.toLocaleString()} seedlings.</p>
      <div class="explorer-head">
        <div class="filters">
          <input type="search" id="nurSearch" placeholder="Search nursery, species, common name, provenance…"/>
          <select id="nurNursery"><option value="">All nurseries</option>${nurseries.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select>
          <select id="nurType"><option value="">All source types</option>${types.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>
          <select id="nurSpecies"><option value="">All species</option>${species.map(([id, sci]) => `<option value="${esc(id)}">${esc(sci)}</option>`).join("")}</select>
        </div>
        <div class="result-count" id="nurCount"></div>
      </div>
      <div id="nurTable"></div>`;

    const dash = '<span class="muted">—</span>';
    const columns = [
      { key: "nursery", label: "Nursery", render: (r) => `<strong>${esc(r.nursery)}</strong>${r.municipality ? `<br><span class="muted" style="font-size:.85em">${esc(r.municipality)}, ${esc(r.province)}</span>` : ""}` },
      { key: "scientific", label: "Species", sortVal: (r) => r.scientific, render: (r) => spName(r.scientific, r.common || "—", r.color) },
      { key: "type", label: "Type", render: (r) => `<span class="tag-cell" style="background:var(--clay-100);color:var(--clay-800)">${esc(r.type)}</span>` },
      { key: "count", label: "# Seedlings", sortVal: (r) => (r.count == null ? -1 : r.count), render: (r) => (r.count == null ? dash : `<strong>${r.count.toLocaleString()}</strong>`) },
      { key: "provenance", label: "Provenance", render: (r) => (r.provenance ? esc(r.provenance) : dash) },
      { key: "date", label: "Date", render: (r) => (r.date ? esc(r.date) : dash) },
      { key: "status", label: "Status", render: (r) => `<span class="tag-cell status-${esc(r.status)}">${esc(r.status)}</span>` },
    ];

    function apply() {
      const q = $("#nurSearch").value.toLowerCase().trim();
      const nu = $("#nurNursery").value, t = $("#nurType").value, sp = $("#nurSpecies").value;
      const rows = all.filter((n) => {
        if (nu && n.nursery !== nu) return false;
        if (t && n.type !== t) return false;
        if (sp && n.speciesId !== sp) return false;
        if (q && !`${n.nursery} ${n.scientific} ${n.common} ${n.provenance}`.toLowerCase().includes(q)) return false;
        return true;
      });
      const total = rows.reduce((s, n) => s + (n.count || 0), 0);
      $("#nurCount").textContent = `${rows.length} records · ${total.toLocaleString()} seedlings`;
      buildTable($("#nurTable"), columns, rows);
    }
    ["nurSearch", "nurNursery", "nurType", "nurSpecies"].forEach((id) => {
      $("#" + id).addEventListener(id === "nurSearch" ? "input" : "change", apply);
    });
    if (pendingSearch.nurseries) { $("#nurSearch").value = pendingSearch.nurseries; pendingSearch.nurseries = ""; }
    apply();
  }

  /* --------------------------------------------------------------------- */
  /* MODALS                                                                 */
  /* --------------------------------------------------------------------- */
  function openModal(html, wide) {
    $("#modalBody").innerHTML = html;
    const m = $(".modal");
    if (m) m.classList.toggle("modal--wide", !!wide);
    $("#modalBg").classList.add("open");
  }
  function closeModal() { $("#modalBg").classList.remove("open"); }

  function modalSpecies(id) {
    const s = DATA.OCC_SPECIES_BY_ID[id];
    if (!s) return;
    const val = (v) => (v && String(v).trim() ? esc(v) : `<span class="muted">—</span>`);
    const recordsRow = s.count
      ? `${s.count.toLocaleString()} occurrence record(s)`
      : `<span class="muted">Not yet in the occurrence records</span>`;
    const muniRow = s.count
      ? esc(s.municipalities.join(", "))
      : `<span style="color:var(--forest-700);font-weight:600">Available at the BSU Forestry Nursery</span>`;
    const synHtml = formatSynonyms(s.synonyms);
    const provMap = (s.provinces && s.provinces.length) ? provinceMap(s.provinces, s.color) : "";
    openModal(`
      <div class="species-detail">
        <div>
          <div class="photo"><img src="${s.image || artSVG(s.color, s.scientific, "species")}" alt="${esc(s.scientific)}"/></div>
          ${s.imageCredit ? `<div class="photo-credit">📷 ${esc(s.imageCredit)}</div>` : ""}
          <div class="sp-tags" style="margin-top:10px">
            <span class="pill" style="background:${shade(s.color,.78)};color:${darken(s.color,.2)}">${esc(speciesHabitType(s.habit))}</span>
            ${s.distribution ? `<span class="pill ${distClass(s.distribution)}">${esc(s.distribution)}</span>` : ""}
            ${s.redlist ? `<span class="pill dao">${esc(s.redlist)}</span>` : ""}
          </div>
          ${synHtml ? `<div class="sp-syn-block"><div class="sp-syn-label">Synonyms</div><div class="sp-syn">${synHtml}</div></div>` : ""}
        </div>
        <div>
          <h2 class="sci-name" style="font-size:1.7rem;margin-bottom:0">${esc(s.scientific)}</h2>
          <div class="muted" style="margin-bottom:10px">${val(s.author)} · ${esc(s.common || "—")}</div>
          <p>${val(s.description)}</p>
          <table class="taxon-table">
            <tr><td>Growth habit / type</td><td>${val(s.habit)}</td></tr>
            <tr><td>Culm height</td><td>${val(s.height)}</td></tr>
            <tr><td>Culm diameter</td><td>${val(s.diameter)}</td></tr>
            <tr><td>Primary uses</td><td>${val(s.uses)}</td></tr>
            <tr><td>Distribution</td><td>${val(s.distribution)}</td></tr>
            <tr><td>Conservation status</td><td>${s.redlist ? esc(s.redlist) : `<span class="muted">Not listed</span>`}</td></tr>
            <tr><td>Recorded provinces</td><td>${(s.provinces && s.provinces.length) ? esc(s.provinces.join(", ")) : `<span class="muted">—</span>`}</td></tr>
            <tr><td>Records in database</td><td>${recordsRow}</td></tr>
            <tr><td>Recorded municipalities</td><td>${muniRow}</td></tr>
          </table>
          ${provMap ? `<div class="prov-map-block">
            <div class="prov-map-label">Where it's found</div>
            <div class="prov-map-row">
              ${provMap}
              <div class="prov-map-legend">
                <div><span class="prov-swatch" style="background:${s.color}"></span> Recorded province</div>
                <div><span class="prov-swatch other"></span> Other CAR province</div>
              </div>
            </div>
          </div>` : ""}
          ${s.count ? `<button style="margin-top:14px;border:none;background:var(--forest-700);color:#fff;padding:11px 18px;border-radius:8px;cursor:pointer;font-weight:700;font-family:var(--font-body);font-size:.92rem" onclick="App.closeModal();App.quickSpecies('${id}')">View occurrences in table →</button>` : ""}
        </div>
      </div>`, true);
  }
  function quickSpecies(id) {
    const s = DATA.OCC_SPECIES_BY_ID[id];
    if (!s) return;
    pendingSearch.occurrences = s.scientific;
    go("occurrences");
  }

  function modalProduct(p) {
    const color = TAG_COLORS[p.tag] || "#3d6b27";
    openModal(`
      <img src="${artSVG(color, p.name, "product")}" style="width:100%;border-radius:10px;margin-bottom:16px"/>
      <span class="pill" style="background:${shade(color,.78)};color:${darken(color,.2)}">${esc(p.tag)}</span>
      <h2 style="margin-top:8px">${esc(p.name)}</h2>
      <p class="muted">📍 ${esc(p.location)} · Maker: ${esc(p.maker)}</p>
      <p>${esc(p.desc)}</p>
      <table class="taxon-table"><tr><td>Bamboo species</td><td class="sci-name">${esc(p.species)}</td></tr>
      <tr><td>Category</td><td>${esc(p.tag)}</td></tr><tr><td>Location</td><td>${esc(p.location)}</td></tr></table>`);
  }
  function modalPublication(p) {
    const color = PUBTYPE_COLORS[p.type] || "#3d6b27";
    openModal(`
      <img src="${artSVG(color, p.title, "publication")}" style="width:100%;border-radius:10px;margin-bottom:16px"/>
      <span class="pill" style="background:${shade(color,.8)};color:${darken(color,.2)}">${esc(p.type)}</span>
      <h2 style="margin-top:8px">${esc(p.title)}</h2>
      <p class="muted">${esc(p.author)} · ${p.year}</p>
      <p>${esc(p.desc)}</p>
      <p class="muted" style="font-size:.85rem">Prototype entry — document not attached in this demo.</p>`);
  }
  function modalNews(p) {
    const color = NEWS_COLORS[p.category] || "#3d6b27";
    openModal(`
      <img src="${artSVG(color, p.title, "news")}" style="width:100%;border-radius:10px;margin-bottom:16px"/>
      <span class="pill" style="background:${shade(color,.8)};color:${darken(color,.2)}">${esc(p.category)}</span>
      <h2 style="margin-top:8px">${esc(p.title)}</h2>
      <p class="muted">🗓 ${esc(p.date)} · 📍 ${esc(p.location)}</p>
      <p>${esc(p.desc)}</p>`);
  }

  /* --------------------------------------------------------------------- */
  /* Size the hero so hero + database summary fill the first screen exactly, */
  /* pushing the home tabs (Map / Statistics / …) below the fold.            */
  // publish the real topbar height so the hero can slide up under the transparent bar
  function measureTopbar() {
    const tb = $(".topbar");
    if (tb) document.documentElement.style.setProperty("--topbar-h", tb.offsetHeight + "px");
  }
  function sizeHero() {
    const hero = $("#hero");
    if (!hero || getComputedStyle(hero).display === "none") return;
    hero.style.minHeight = ""; // reset before measuring
    const top = hero.getBoundingClientRect().top + window.scrollY; // hero sits at page top
    const h = window.innerHeight - top;
    if (h > 0) hero.style.minHeight = h + "px"; // video fills the whole first screen
  }
  function scheduleSizeHero() {
    measureTopbar();
    requestAnimationFrame(sizeHero);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measureTopbar(); sizeHero(); });
  }

  // On the home page only, hide the topbar while scrolling down; reveal it when
  // scrolling back up or near the top. Other pages keep the sticky topbar.
  let lastScrollY = 0;
  function onScroll() {
    const tb = $(".topbar");
    if (!tb) return;
    if (!document.body.classList.contains("route-home")) { tb.classList.remove("topbar--hidden"); return; }
    const y = window.scrollY || window.pageYOffset || 0;
    if (y > 100 && y > lastScrollY) { tb.classList.add("topbar--hidden"); closeMobileNav(); }
    else tb.classList.remove("topbar--hidden");
    lastScrollY = y;
  }

  /* Mobile hamburger nav (≤620px) */
  function closeMobileNav() {
    const tb = $(".topbar"), btn = $("#navToggle");
    if (tb) tb.classList.remove("nav-open");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  function setupMobileNav() {
    const tb = $(".topbar"), btn = $("#navToggle");
    if (!tb || !btn) return;
    btn.addEventListener("click", () => {
      const open = tb.classList.toggle("nav-open");
      btn.setAttribute("aria-expanded", String(open));
    });
    $$("#mainnav a").forEach((a) => a.addEventListener("click", closeMobileNav));
  }

  /* --------------------------------------------------------------------- */
  function init() {
    setupSearch();
    setupMobileNav();
    renderHome();
    document.body.classList.add("route-home"); // default view is home
    measureTopbar();
    scheduleSizeHero();
    window.addEventListener("load", () => { measureTopbar(); sizeHero(); });
    window.addEventListener("resize", () => { measureTopbar(); sizeHero(); });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); closeMobileNav(); } });
  }

  return {
    init, go, quick, quickSpecies,
    modalSpecies, modalProduct, modalPublication, modalNews, closeModal,
    generateReport, resetRequest, resetContribute, resetContact,
    showOccurrenceOnMap, showEstablishmentOnMap,
  };
})();

document.addEventListener("DOMContentLoaded", App.init);
