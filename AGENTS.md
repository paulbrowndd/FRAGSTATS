# AGENTS.md

## Cursor Cloud specific instructions

### What this is
FRAG "Node War Stats" is a **fully static, client-side website** (no build step, no
package manager, no server-side code) that visualizes Black Desert Online node-war
statistics for the FRAG guild. It is deployed via GitHub Pages (`.nojekyll` disables
Jekyll processing).

Key files (all served as-is):
- `index.html` – page shell / DOM structure.
- `app.js` – all rendering + logic (views: Daily/Weekly/Monthly/Lifetime/Attendance, MVP scoring, defense wheel).
- `data.js` – the war result dataset (`window.NODE_WAR_DATA`), by far the largest file (~850KB).
- `guild.js` – canonical guild roster + name aliases (`window.GUILD_ROSTER`).
- `styles.css`, `frag-logo.png` – styling / assets.

### Running (development)
There are **no dependencies to install**. Serve the repo root over HTTP (opening
`index.html` via `file://` also works, but a server matches production):

```bash
python3 -m http.server 8000   # from repo root; then open http://localhost:8000/
```

Any static file server works (e.g. `npx serve`). Editing any `.js`/`.css`/`.html`
file just requires a browser refresh — there is no bundler or hot-reload.

### Lint / test / build
- **No build**: files are shipped verbatim; there is no bundling/transpiling.
- **No linter or test suite** is configured in this repo (no `package.json`, no CI test config).
  "Verifying" a change means loading the site in a browser and exercising the affected view.

### The `.swift` files are NOT part of the web app
`_hdr.swift` and `_ocr.swift` are **macOS-only** helper scripts using Apple's Vision
framework (`import Vision`/`AppKit`). They are used offline (on a Mac) to OCR node-war
result screenshots into the numbers that get hand-entered into `data.js`. They cannot
run on Linux and are irrelevant to running or developing the website.
