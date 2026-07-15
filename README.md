# CARBambase — Cordillera Bamboo Database

Static website for the Cordillera Bamboo Database (CARBambase), built under the
Bamboo Industry Development program of the six CAR State Universities and Colleges
(ASIST, ASC, BSU, IFSU, KSU, MPSU).

This folder is a self-contained, deploy-ready copy of the site: plain HTML/CSS/JS
with no build step or server-side code. Map tiles, Leaflet, and Google Fonts load
from public CDNs; everything else is bundled here.

## Contents

| Path | Purpose |
|------|---------|
| `index.html` | Single-page app shell (all routes render client-side) |
| `css/styles.css` | Site stylesheet (responsive, mobile-ready) |
| `js/` | App logic, generated datasets (occurrences, species, nurseries, establishments), and lazy-loaded suitability layers (`js/suitability/*.js`) |
| `assets/logo/` | Partner and SUC seals |
| `assets/species_images/` | Species profile photos |
| `assets/vids/banner1.mp4` | Hero banner video |
| `.nojekyll` | Tells GitHub Pages to serve files as-is (skip Jekyll) |

Build-time sources (Python scripts, CSVs, GeoPackages) are intentionally **not**
included — regenerate the `js/` data files from the main working folder if the
source data changes.

## Deploying to GitHub Pages

1. Create a new repository on GitHub (e.g. `carbambase`).
2. From this folder:

   ```bash
   git init
   git add .
   git commit -m "Initial CARBambase site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/carbambase.git
   git push -u origin main
   ```

3. On GitHub: **Settings → Pages → Build and deployment**, set
   **Source** to *Deploy from a branch*, choose branch **main** and folder **/ (root)**, then save.
4. The site goes live in a minute or two at
   `https://<your-username>.github.io/carbambase/`.

All asset paths are relative, so the site works both at a project URL
(`/carbambase/`) and at a custom domain or user root.

## Running locally

Any static file server works, e.g.:

```bash
python -m http.server 8000
```

then open <http://localhost:8000>.

## Notes

- The ceremonial launch animation from the working prototype is removed in this
  deploy copy — the site loads directly.
- Contact, Request Data, and Contribute Data forms compose a pre-filled email
  to `geoinformatics@bsu.edu.ph` via the visitor's mail app.
- Products, Technologies, Publications, and News tabs currently show
  "Coming Soon" teasers until real data is added.
