/* ============================================================================
   CARBambase — Cordillera Bamboo Database
   data.js — assembles DATA.* from the real datasets loaded before this file
   (occurrences, species, establishments, nurseries, suitability, provinces).
   Products, technologies, publications and news remain illustrative content.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* MUNICIPALITIES (real CAR towns w/ approx. coordinates & base elev.) */
  /* ------------------------------------------------------------------ */
  const TOWNS = [
    // Benguet
    { name: "La Trinidad", province: "Benguet", lat: 16.455, lon: 120.588, elev: 1300 },
    { name: "Baguio City", province: "Benguet", lat: 16.402, lon: 120.596, elev: 1470 },
    { name: "Itogon", province: "Benguet", lat: 16.366, lon: 120.683, elev: 900 },
    { name: "Tuba", province: "Benguet", lat: 16.355, lon: 120.56, elev: 1100 },
    { name: "Atok", province: "Benguet", lat: 16.58, lon: 120.69, elev: 2000 },
    { name: "Buguias", province: "Benguet", lat: 16.74, lon: 120.83, elev: 1800 },
    { name: "Mankayan", province: "Benguet", lat: 16.86, lon: 120.79, elev: 1500 },
    { name: "Kapangan", province: "Benguet", lat: 16.58, lon: 120.6, elev: 1200 },
    // Abra
    { name: "Bangued", province: "Abra", lat: 17.598, lon: 120.617, elev: 180 },
    { name: "Lagangilang", province: "Abra", lat: 17.61, lon: 120.73, elev: 250 },
    { name: "Dolores", province: "Abra", lat: 17.64, lon: 120.7, elev: 200 },
    { name: "Bucay", province: "Abra", lat: 17.53, lon: 120.72, elev: 220 },
    // Apayao
    { name: "Kabugao", province: "Apayao", lat: 18.018, lon: 121.182, elev: 300 },
    { name: "Conner", province: "Apayao", lat: 17.78, lon: 121.3, elev: 200 },
    { name: "Luna", province: "Apayao", lat: 18.32, lon: 121.36, elev: 60 },
    { name: "Pudtol", province: "Apayao", lat: 18.15, lon: 121.25, elev: 150 },
    // Ifugao
    { name: "Lagawe", province: "Ifugao", lat: 16.797, lon: 121.122, elev: 700 },
    { name: "Banaue", province: "Ifugao", lat: 16.917, lon: 121.058, elev: 1200 },
    { name: "Kiangan", province: "Ifugao", lat: 16.78, lon: 121.08, elev: 900 },
    { name: "Lamut", province: "Ifugao", lat: 16.65, lon: 121.22, elev: 300 },
    { name: "Mayoyao", province: "Ifugao", lat: 16.97, lon: 121.27, elev: 1000 },
    // Kalinga
    { name: "Tabuk City", province: "Kalinga", lat: 17.454, lon: 121.444, elev: 250 },
    { name: "Rizal", province: "Kalinga", lat: 17.62, lon: 121.45, elev: 200 },
    { name: "Pinukpuk", province: "Kalinga", lat: 17.61, lon: 121.3, elev: 300 },
    { name: "Lubuagan", province: "Kalinga", lat: 17.35, lon: 121.18, elev: 800 },
    { name: "Tinglayan", province: "Kalinga", lat: 17.2, lon: 121.13, elev: 900 },
    // Mountain Province
    { name: "Bontoc", province: "Mountain Province", lat: 17.09, lon: 120.976, elev: 900 },
    { name: "Sagada", province: "Mountain Province", lat: 17.083, lon: 120.9, elev: 1500 },
    { name: "Bauko", province: "Mountain Province", lat: 16.99, lon: 120.86, elev: 1600 },
    { name: "Tadian", province: "Mountain Province", lat: 16.95, lon: 120.8, elev: 1400 },
    { name: "Sabangan", province: "Mountain Province", lat: 17.02, lon: 120.93, elev: 1100 },
    { name: "Barlig", province: "Mountain Province", lat: 17.06, lon: 121.1, elev: 1500 },
  ];

  /* ------------------------------------------------------------------ */
  /* SPECIES REGISTRY + OCCURRENCES (real data)                          */
  /* Built by assets/build_occurrences.py from bamboolist.csv (final     */
  /* species list) + occurrence-list.csv (field records). The globals    */
  /* window.OCC_SPECIES / OCC_PROVINCES / OCC_MUNIS / OCC_RECORDS are     */
  /* loaded before this file (see index.html). Coordinates were          */
  /* normalised at build time (part of the source was recorded           */
  /* latitude-first). Records are compact arrays:                        */
  /*   [speciesIdx, muniIdx, provIdx, culms|null, lon, lat, elev]        */
  /* OCC_SPECIES is the authoritative 49-species list; the dummy SPECIES */
  /* array above still backs the Species/Establishments/Nursery tabs     */
  /* until those are migrated too.                                       */
  /* ------------------------------------------------------------------ */
  const _occSrc = (typeof window !== "undefined" && window.OCC_SPECIES) || [];
  const _occMunis = (typeof window !== "undefined" && window.OCC_MUNIS) || [];
  const _occProv = (typeof window !== "undefined" && window.OCC_PROVINCES) || [];
  const _occRecs = (typeof window !== "undefined" && window.OCC_RECORDS) || [];

  const OCC_SPECIES = _occSrc.map((e) => ({
    id: e.id, scientific: e.sci, common: e.cn, author: e.au,
    distribution: e.dist, redlist: e.red, provinces: e.prov, synonyms: e.syn,
    color: e.color, modeled: e.modeled, count: e.n,
  }));
  const OCC_SPECIES_BY_ID = Object.fromEntries(OCC_SPECIES.map((s) => [s.id, s]));

  const OCCURRENCES = _occRecs.map((r, i) => {
    const sp = OCC_SPECIES[r[0]] || {};
    return {
      id: "OCC-" + i,
      speciesId: sp.id,
      scientific: sp.scientific,
      common: sp.common,
      municipality: _occMunis[r[1]],
      province: _occProv[r[2]],
      culms: r[3],           // number, or null when unrecorded
      lon: r[4],
      lat: r[5],
      elevation: r[6],
    };
  });

  // Attach researched traits (js/species_info.js, loaded before this file) and
  // the municipalities each species was actually recorded in. Species with no
  // records are available at the BSU Forestry Nursery (surfaced in the UI).
  const _spInfo = (typeof window !== "undefined" && window.SPECIES_INFO) || {};
  const _spImg = (typeof window !== "undefined" && window.SPECIES_IMAGES) || {};
  const _muniBySpecies = {};
  OCCURRENCES.forEach((o) => (_muniBySpecies[o.speciesId] || (_muniBySpecies[o.speciesId] = new Set())).add(o.municipality));
  OCC_SPECIES.forEach((s) => {
    const info = _spInfo[s.scientific] || {};
    s.habit = info.habit || "";
    s.height = info.height || "";
    s.diameter = info.diameter || "";
    s.uses = info.uses || "";
    s.description = info.description || "";
    s.municipalities = [...(_muniBySpecies[s.id] || [])].sort();
    const img = _spImg[s.scientific];
    s.image = img ? img.f : "";            // real photo path, or "" -> placeholder
    s.imageCredit = img ? img.c : "";
  });

  /* ------------------------------------------------------------------ */
  /* ESTABLISHMENTS (matrix)                                             */
  /* ------------------------------------------------------------------ */
  // Turn establishment species given as scientific names / synonyms into common
  // names (first common name); names already common or not in the masterlist are
  // kept as-is (masterlist linking of the rest is deferred).
  const _sciToCommon = {};
  OCC_SPECIES.forEach((s) => {
    const first = (s.common || "").split("|")[0].trim() || s.scientific;
    _sciToCommon[s.scientific.toLowerCase()] = first;
    (s.synonyms || []).forEach((x) => (_sciToCommon[x.n.toLowerCase()] = first));
  });
  const _toCommon = (name) => _sciToCommon[String(name).trim().toLowerCase()] || name;
  // Format an area (already converted to hectares in the build) for display.
  const _fmtHa = (v) =>
    v == null ? "" :
    v >= 1 ? (Math.round(v * 100) / 100).toLocaleString() + " ha" :
    v >= 0.001 ? (Math.round(v * 10000) / 10000) + " ha" :
    Number(v.toPrecision(2)) + " ha";
  const ESTABLISHMENTS = ((typeof window !== "undefined" && window.ESTABLISHMENT_RECORDS) || []).map((e, i) => ({
    id: "EST-" + i,
    name: e.name,
    type: e.type,
    municipality: e.municipality,
    province: e.province,
    areaHa: e.areaHa,                 // numeric hectares (m² converted in the build), or null
    areaDisplay: _fmtHa(e.areaHa),    // e.g. "0.52 ha" — always hectares
    lon: e.lon,                       // number, or null (Unknown/out-of-range handled by the map)
    lat: e.lat,
    species: (e.species || []).map(_toCommon),  // scientific names shown as common names
    year: e.year,
  }));
  const EST_TYPES = [...new Set(ESTABLISHMENTS.map((e) => e.type))].sort();

  /* ------------------------------------------------------------------ */
  /* NURSERY MONITORING (real data)                                      */
  /* Built by assets/build_nurseries.py from nursery_monitoring.csv;     */
  /* window.NURSERY_RECORDS is loaded before this file. Each nursery's   */
  /* municipality/province is assigned here, and the species colour/id   */
  /* is looked up from the OCC_SPECIES registry by scientific name.      */
  /* ------------------------------------------------------------------ */
  const NURSERY_LOC = {
    "BSU College of Forestry Nursery": { municipality: "La Trinidad", province: "Benguet" },
    "ASIST Bamboo Nursery": { municipality: "Lagangilang", province: "Abra" },
  };
  const _occBySci = Object.fromEntries(OCC_SPECIES.map((s) => [s.scientific, s]));
  const NURSERIES = ((typeof window !== "undefined" && window.NURSERY_RECORDS) || []).map((r, i) => {
    const sp = _occBySci[r.sci] || {};
    const loc = NURSERY_LOC[r.nursery] || {};
    return {
      id: "NUR-" + i,
      nursery: r.nursery,
      municipality: loc.municipality || "",
      province: loc.province || "",
      scientific: r.sci,
      speciesId: sp.id || "",
      common: r.common || sp.common || "",
      color: sp.color || "#8a8a7a",
      type: r.type,
      count: r.count == null ? null : r.count,   // number, or null when unrecorded
      provenance: r.provenance || "",
      date: r.date || "",
      status: r.status || "",
    };
  });

  /* ------------------------------------------------------------------ */
  /* SUITABILITY (real, modelled -> classified -> vectorized)            */
  /* Per-species land-suitability surfaces (the single "suitable" class) */
  /* built by assets/build_suitability.py from the species GeoPackages.  */
  /* The manifest (window.SUIT_INDEX, loaded before this file) lists      */
  /* every layer; each species' geometry lives in its own                */
  /* js/suitability/<slug>.js and is lazy-loaded by map.js on demand.    */
  /* Every polygon carries its area in hectares for the click popup.     */
  /* .layers: [{slug, scientific, color, totalHa, polys, bounds}]        */
  /* .bounds: overall [[south, west], [north, east]] for the map view.   */
  /* ------------------------------------------------------------------ */
  const SUITABILITY = (typeof window !== "undefined" && window.SUIT_INDEX) || {
    layers: [],
    bounds: [[16.18, 120.44], [18.39, 121.65]],
  };


  /* ------------------------------------------------------------------ */
  /* PRODUCTS                                                            */
  /* ------------------------------------------------------------------ */
  const PRODUCTS = [
    { name: "Engineered Bamboo Panels", maker: "BSU–DTI Shared Facility", location: "La Trinidad, Benguet", species: "Dendrocalamus asper", tag: "Construction", desc: "Laminated bamboo boards for furniture and interior finishing produced at the regional shared service facility." },
    { name: "Bamboo Charcoal & Vinegar", maker: "Itogon Bamboo Cooperative", location: "Itogon, Benguet", species: "Bambusa blumeana", tag: "Energy / Agri", desc: "Pyrolised bamboo charcoal briquettes and wood-vinegar by-product for soil conditioning." },
    { name: "Woven Sawali Panels", maker: "Tinglayan Weavers' Assn.", location: "Tinglayan, Kalinga", species: "Schizostachyum lumampao", tag: "Handicraft", desc: "Traditional split-bamboo wall panels woven by Cordilleran communities." },
    { name: "Bamboo Furniture Set", maker: "Bangued Furniture Makers", location: "Bangued, Abra", species: "Gigantochloa levis", tag: "Furniture", desc: "Sala sets and chairs from treated bolo culms." },
    { name: "Bamboo Shoots (Labong)", maker: "Lamut Agroforestry Farm", location: "Lamut, Ifugao", species: "Dendrocalamus latiflorus", tag: "Food", desc: "Fresh and bottled sweet bamboo shoots for local markets." },
    { name: "Bamboo Bike Frame", maker: "BSU Design & Innovation Lab", location: "La Trinidad, Benguet", species: "Bambusa blumeana", tag: "Innovation", desc: "Prototype lightweight bamboo bicycle frame showcased at regional fairs." },
    { name: "Handwoven Baskets", maker: "Sagada Craft Circle", location: "Sagada, Mountain Province", species: "Schizostachyum lumampao", tag: "Handicraft", desc: "Carrying baskets (kayabang) and décor for the tourism market." },
    { name: "Bamboo Musical Instruments", maker: "Kalinga Sound Heritage", location: "Lubuagan, Kalinga", species: "Gigantochloa atter", tag: "Culture", desc: "Tongatong, saggeypo, and bamboo flutes for cultural performances." },
    { name: "Bamboo Slats & Poles", maker: "Pinukpuk Plantation Co-op", location: "Pinukpuk, Kalinga", species: "Dendrocalamus asper", tag: "Construction", desc: "Graded poles and treated slats for the construction supply chain." },
    { name: "Bamboo Eco-Straws & Tumblers", maker: "Benguet Green Crafts", location: "La Trinidad, Benguet", species: "Bambusa vulgaris", tag: "Lifestyle", desc: "Reusable bamboo straws, cups, and utensils for the zero-waste market." },
    { name: "Decorative Bamboo Fencing", maker: "Mankayan Livelihood Group", location: "Mankayan, Benguet", species: "Bambusa multiplex", tag: "Landscaping", desc: "Garden screens and fences for resorts and households." },
    { name: "Bamboo Activated Carbon", maker: "ASIST Research Spin-off", location: "Lagangilang, Abra", species: "Bambusa blumeana", tag: "Innovation", desc: "Activated carbon for water filtration, an R&D product under field testing." },
  ];

  /* ------------------------------------------------------------------ */
  /* TECHNOLOGIES & MACHINERIES                                          */
  /* ------------------------------------------------------------------ */
  const TECHNOLOGIES = [
    { name: "Bamboo Splitting Machine", category: "Machinery", suc: "BSU", location: "La Trinidad, Benguet", status: "Available", desc: "Motorized splitter that divides culms into uniform strips for furniture, slats, and handicraft production." },
    { name: "Engineered Bamboo Hot Press", category: "Machinery", suc: "BSU", location: "La Trinidad, Benguet", status: "Available", desc: "Hydraulic hot press for laminating treated bamboo strips into boards and panels (engineered bamboo)." },
    { name: "Boucherie Treatment System", category: "Machinery", suc: "KSU", location: "Tabuk City, Kalinga", status: "Available", desc: "Sap-displacement preservative treatment unit that extends culm service life against borers and fungi." },
    { name: "Bamboo Charcoal Pyrolizer & Kiln", category: "Machinery", suc: "IFSU", location: "Lamut, Ifugao", status: "Available", desc: "Controlled kiln converting bamboo offcuts into charcoal briquettes, with wood-vinegar capture." },
    { name: "Bamboo Slat & Stick Sizing Machine", category: "Machinery", suc: "ASIST", location: "Lagangilang, Abra", status: "Available", desc: "Produces uniform slats, sticks, and skewers from split bamboo for downstream products." },
    { name: "Solar Bamboo Drying Kiln", category: "Machinery", suc: "MPSU", location: "Bontoc, Mountain Province", status: "Prototype", desc: "Solar-assisted kiln that reduces moisture content of culms prior to treatment and processing." },
    { name: "Bamboo Cross-cut & Sizing Saw", category: "Machinery", suc: "ASC", location: "Luna, Apayao", status: "Available", desc: "Bench saw assembly for cutting culms to length with consistent diameter sizing." },
    { name: "Fabrication & Machine Shop", category: "Fabricator", suc: "BSU", location: "La Trinidad, Benguet", status: "Available", desc: "In-house fabrication of bamboo processing equipment for partner SUCs, LGUs, and cooperatives." },
    { name: "Engineering Fabrication Unit", category: "Fabricator", suc: "ASIST", location: "Lagangilang, Abra", status: "Available", desc: "Designs and builds customized bamboo machinery and jigs for community-based enterprises." },
    { name: "Bamboo Tissue-Culture Protocol", category: "Technology", suc: "BSU", location: "La Trinidad, Benguet", status: "Newly developed", desc: "Micropropagation protocol for mass production of disease-free, uniform planting materials." },
    { name: "Bamboo Activated-Carbon Process", category: "Technology", suc: "ASIST", location: "Lagangilang, Abra", status: "Newly developed", desc: "Process for producing activated carbon from bamboo biomass for water and air filtration." },
    { name: "Bamboo Composite Board Technology", category: "Technology", suc: "KSU", location: "Tabuk City, Kalinga", status: "Newly developed", desc: "Formulation for bamboo–polymer composite boards using bamboo processing residues." },
  ];

  /* ------------------------------------------------------------------ */
  /* PUBLICATIONS                                                        */
  /* ------------------------------------------------------------------ */
  const PUBLICATIONS = [
    { title: "Bamboo Propagation Manual for the Cordillera", type: "Technical Manual", author: "Cordillera Bamboo Program / BSU", year: 2024, desc: "Step-by-step protocols for branch-cutting, marcotting, and tissue-culture propagation of priority species." },
    { title: "Bamboo Species of the Cordillera: A Field Guide", type: "Field Guide", author: "BSU & IFSU", year: 2024, desc: "Illustrated identification guide to native and introduced bamboos of the CAR." },
    { title: "Nursery Establishment & Management Module", type: "Training Module", author: "Cordillera Bamboo Program", year: 2023, desc: "Instructional module used in regional training-of-trainers workshops." },
    { title: "Suitability Mapping of Bamboo in CAR", type: "Research Paper", author: "BSU GIS Laboratory", year: 2025, desc: "Land-suitability analysis combining climate, slope, and soil layers for plantation siting." },
    { title: "Engineered Bamboo Value-Chain Study", type: "Policy Brief", author: "DTI-CAR & Cordillera Bamboo Program", year: 2024, desc: "Market and value-chain assessment for engineered-bamboo enterprises." },
    { title: "Indigenous Bamboo Crafts of the Cordillera", type: "Monograph", author: "MPSU", year: 2023, desc: "Documentation of weaving traditions and craft livelihoods using Schizostachyum lumampao." },
    { title: "Carbon Sequestration Potential of Bamboo Stands", type: "Research Paper", author: "KSU & DENR-CAR", year: 2025, desc: "Biomass and carbon estimates from monitored bamboo plots across the region." },
    { title: "Cordillera Bamboo Program Primer (IEC Material)", type: "IEC / Primer", author: "Program Secretariat", year: 2023, desc: "Public information primer on the program's goals, partners, and milestones." },
    { title: "Bamboo Pest & Disease Management Guide", type: "Technical Manual", author: "Apayao State College", year: 2025, desc: "Identification and management of common bamboo pests in nursery and field settings." },
  ];

  /* ------------------------------------------------------------------ */
  /* NEWS / ENGAGEMENTS                                                  */
  /* ------------------------------------------------------------------ */
  const NEWS = [
    { title: "Regional Bamboo Summit 2026", category: "Event", date: "2026-04-22", location: "Baguio City", desc: "CAR SUCs, LGUs, and industry partners convened to align the regional bamboo roadmap." },
    { title: "Training of Trainers: Bamboo Propagation", category: "Training", date: "2026-03-12", location: "La Trinidad, Benguet", desc: "40 extension workers trained on nursery and propagation techniques." },
    { title: "Bamboo Tech Demo in Tabuk", category: "Tech Demo", date: "2026-02-28", location: "Tabuk City, Kalinga", desc: "Live demonstration of bamboo treatment and engineered-bamboo fabrication." },
    { title: "Stakeholder Consultation Workshop", category: "Workshop", date: "2026-02-05", location: "Lagawe, Ifugao", desc: "Community consultation on plantation siting and benefit-sharing." },
    { title: "MOU Signing with LGU Partners", category: "Meeting", date: "2026-01-18", location: "Bontoc, Mountain Province", desc: "Memorandum of understanding signed for nursery and plantation support." },
    { title: "Bamboo Planting Caravan", category: "Event", date: "2025-11-09", location: "Tuba, Benguet", desc: "Riverbank rehabilitation planting with volunteers and student groups." },
    { title: "Women in Bamboo Crafts Workshop", category: "Workshop", date: "2025-10-21", location: "Sagada, Mountain Province", desc: "Skills upgrading for women weavers' associations." },
    { title: "Bamboo R&D Forum", category: "Meeting", date: "2025-09-15", location: "Baguio City", desc: "Researchers presented findings on growth performance and carbon studies." },
    { title: "Field Validation in Apayao", category: "Tech Demo", date: "2025-08-30", location: "Luna, Apayao", desc: "On-site validation of nursery protocols and survival monitoring." },
    { title: "Inter-SUC Coordination Meeting", category: "Meeting", date: "2025-07-12", location: "Lamut, Ifugao", desc: "Quarterly coordination among the seven CAR state universities and colleges." },
    { title: "Bamboo Enterprise Trade Fair", category: "Event", date: "2025-06-20", location: "Bangued, Abra", desc: "Showcase of community bamboo products and market linkaging." },
    { title: "School-on-the-Air: Bamboo Livelihoods", category: "Training", date: "2025-05-10", location: "Region-wide (radio)", desc: "Radio-based extension program on bamboo livelihoods reaching upland barangays." },
  ];

  /* ------------------------------------------------------------------ */
  /* PARTNERS / PUBLISHERS                                               */
  /* ------------------------------------------------------------------ */
  const PARTNERS = {
    sucs: [
      { abbr: "ASIST", name: "Abra State Institute of Sciences and Technology", address: "Lagangilang, Abra", logo: "assets/logo/asist.png" },
      { abbr: "ASC", name: "Apayao State College", address: "Luna, Apayao", logo: "assets/logo/asc.png" },
      { abbr: "BSU", name: "Benguet State University", address: "La Trinidad, Benguet", logo: "assets/logo/bsu.png" },
      { abbr: "IFSU", name: "Ifugao State University", address: "Potia, Ifugao", logo: "assets/logo/ifsu.png" },
      { abbr: "KSU", name: "Kalinga State University", address: "Tabuk City, Kalinga", logo: "assets/logo/ksu.png" },
      { abbr: "MPSU", name: "Mountain Province State University", address: "Tadian, Mountain Province", logo: "assets/logo/mpsu.png" },
    ],
    partners: [
      { abbr: "DBM", name: "Department of Budget and Management", logo: "assets/logo/dbm.svg", tag: "Funding & Monitoring" },
      { abbr: "CHED-CAR", name: "Commission on Higher Education – Cordillera Administrative Region", logo: "assets/logo/ched.png", tag: "Co-Implementing Agency" },
      { abbr: "DOST-FPRDI", name: "Department of Science & Technology – Forest Products Research & Development Institute", logo: "assets/logo/fprdi.png", tag: "Oversight Agency" },
      { abbr: "PBIDC", name: "Philippine Bamboo Industry Development Council", logo: "assets/logo/pbidc.png", tag: "Oversight Agency" },
      // Hidden for now — restore when partnership is confirmed
      // { abbr: "MMSU", name: "Mariano Marcos State University", logo: "assets/logo/mmsu.png", tag: "Partner SUC" },
      // { abbr: "ISU", name: "Isabela State University", logo: "assets/logo/isu.png", tag: "Partner SUC" },
    ],
  };

  /* ------------------------------------------------------------------ */
  /* SUMMARY STATS (for hero)                                            */
  /* ------------------------------------------------------------------ */
  const STATS = {
    occurrences: OCCURRENCES.length,
    species: OCC_SPECIES.length,
    establishments: ESTABLISHMENTS.length,
    nurseries: NURSERIES.length,
    provinces: 6,
    seedlings: NURSERIES.reduce((s, n) => s + (n.count || 0), 0),
  };

  /* ------------------------------------------------------------------ */
  window.DATA = {
    OCC_SPECIES,
    OCC_SPECIES_BY_ID,
    TOWNS,
    OCCURRENCES,
    ESTABLISHMENTS,
    EST_TYPES,
    NURSERIES,
    SUITABILITY,
    PRODUCTS,
    TECHNOLOGIES,
    PUBLICATIONS,
    NEWS,
    PARTNERS,
    STATS,
  };
})();
