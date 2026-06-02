# CARBambase — Cordillera Bamboo Database (Prototype)

A clean, minimal prototype web app for the **Cordillera Bamboo Program** of
the CAR State Universities and Colleges. Built as a self-contained static site
for stakeholder presentation.

> ⚠️ **All data and content are illustrative dummy data** generated for the
> prototype demo. Numbers, locations, products, publications, and news items are
> not official records.

## How to run

No installation, no build step. Either:

- **Double-click `index.html`** to open it in your browser, **or**
- Serve the folder (recommended, so the map tiles load cleanly):
  ```powershell
  # from this folder, with Node installed:
  npx serve .
  # or with Python:
  python -m http.server 8000
  ```
  then open the printed URL (e.g. http://localhost:8000).

> The interactive map (Leaflet + basemap tiles) and the web fonts (Fraunces +
> Hanken Grotesk) load from a CDN, so an **internet connection is recommended**
> for the map base layer and typography. Species points and suitability zones
> still draw without it, fonts fall back gracefully, and everything else
> (tables, galleries, search) works fully offline.

## What's included

**Search bar with tabs** (hero): Occurrences · Species · Establishments · Nurseries.

**Data views**
- **Occurrences** — sortable, filterable table: scientific name, common name,
  municipality, # of culms, longitude, latitude, elevation, date observed.
  **Click any row to view that record on the map.**
- **Species** — carousel + gallery, click for taxonomic detail modal.
- **Establishments** — matrix: type (nursery, bambusetum/garden, demo farm,
  natural, plantation), municipality, size/area, species. **Click any row to
  locate it on the map.**
- **Nurseries** — monitoring matrix: # of bamboo, type (procured/produced/
  donated), provenance, date, status, last monitored.

**Standalone pages** (top nav)
- **About** — program overview: objectives, timeline, and coverage.
- **Contribute** — a form to submit bamboo data, with a clear notice that all
  submissions are **reviewed and validated before publishing** on the site.
- **Contact** — program contact cards (office, data management, partnerships)
  and a message form.

**Home tabs**
- **Map** — interactive Leaflet map: species occurrences color-coded by species
  (click a species in the legend to isolate it) + shaded land-suitability zones
  + a **toggleable Establishments layer** (diamond markers, color-coded by type).
  Includes a **basemap switcher** (Light / Terrain / Streets / Satellite) and a
  **fullscreen** toggle.
- **Statistics** — province-level summary table and bar charts (occurrences,
  planting materials, culms, and species), plus a **Generate Summary Report**
  button that opens a printable report you can save as PDF (browser → Print → Save as PDF).
- **Products** — carousel of bamboo products and their locations.
- **Publications** — carousel of manuals, modules, and research outputs.
- **News & Events** — carousel of meetings, trainings, workshops, tech demos.
- **Publishers & Partners** — the CAR SUCs and partner agencies.
- **Request Data** — a form for researchers/agencies to request datasets
  (validated client-side; simulated submission with a reference number — no backend in this prototype).

## Editing the demo data

All content lives in **`js/data.js`** — species, municipalities, occurrences,
establishments, nurseries, suitability zones, products, publications, news, and
partners. Edit the arrays there to change what the prototype shows.

## File structure

```
index.html        app shell (nav, hero/search, views, footer, modal)
css/styles.css    earthy-bamboo theme (green + tan), responsive
js/data.js        all demo data
js/map.js         Leaflet map (points + suitability zones)
js/app.js         routing, rendering, search, tables, galleries, modals
```
