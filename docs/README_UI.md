Vegeterian - Static UI module
=================================

This folder (`docs/`) contains a small static single-page app that parses
orders Excel (`.xlsx`) and customers CSV files in the browser and provides
three simple flows:

- Leftovers / Parsed Orders view — shows parsed customers and order items.
- Text page — generate messages and open WhatsApp web/wa.me links.
- Search ordered customer — search parsed orders by name.

Why this exists
---------------
You asked for a way to use the upload/processing UI without running the
Spring Boot application. This static app runs entirely in the browser and
doesn't require a backend. Put the repository on GitHub and enable GitHub
Pages (see below) to serve the UI from GitHub.

How to publish with GitHub Pages
--------------------------------
1. Commit & push the repo to GitHub (already done in this project).
2. In your repository, go to Settings → Pages.
3. Under "Source" choose "Branch: main" and folder `/docs` and save.
4. After a moment the site will be available at `https://<owner>.github.io/<repo>/`.

Usage notes and limitations
--------------------------
- All parsing happens in the browser. Uploaded files are not sent anywhere.
- The parser attempts to follow the original server logic (detecting
  customer headers with the string `איסוף: לוד`) but may not cover every
  edge case. If the workbook structure differs, the parsed results may be
  incomplete — you can extend `docs/app.js` to match your exact sheet.
- For privacy the UI computes a masked phone (last 6 digits) but keeps
  the raw phone internally so the WhatsApp link can be opened — if you
  prefer masking only, remove or adjust that behavior in `app.js`.

Files
-----
- `index.html` — main single-page UI
- `app.js` — client-side logic (parsing and UI wiring)
- `styles.css` — small stylesheet

Extending or testing locally
---------------------------
You can open `docs/index.html` directly in a browser or use a static server
for local testing (e.g., `npx http-server docs` or `python -m http.server` in the `docs` directory).

If you want, I can:
- Improve the parser to match your exact Excel layout (send a sample XLSX with sensitive data removed or a sanitized sample layout).
- Add a small settings panel so you can configure tokens/strings such as the pickup marker (`איסוף: לוד`) and which columns contain product/quantity/price.
- Create a dedicated GitHub Pages deployment (I already placed the static site in `docs/` so enabling Pages is the last step).
