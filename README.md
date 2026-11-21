# Field Atlas

A free dashboard for searching and tracking journal literature across GIS, remote sensing, geospatial analysis, geography, atmospheric science, human–environment interaction, public health and GeoAI.

[Open the dashboard](https://bipul-roy-ai.github.io/georesearch-intelligence/) · [Open in GitHub Codespaces](https://codespaces.new/Bipul-roy-AI/georesearch-intelligence) · [Download the project ZIP](https://github.com/Bipul-roy-AI/georesearch-intelligence/archive/refs/heads/main.zip)

## Functions

- **Explore** — search 50 literature sources (41 live integrations: Crossref, OpenAlex, PubMed, Europe PMC, DOAJ, Scopus, Web of Science, and more) by topic, DOI or ISSN.
- **Paper subjects** — classify each paper into one or more of 42 topics across 6 research domains.
- **Journal ranking filter** — filter by SCImago/JCR quartile and category.
- **Free full text** — find an open-access copy of a paywalled article via Unpaywall.
- **Dashboards** — Trends (publications per year, top-cited papers, top journals, fastest-growing topics) and Geography (publications by country, multi-country comparison), both powered by live OpenAlex data.
- **Import/Export** — import RIS, PubMed NBIB, CSL JSON, Zotero JSON, RSS/Atom and OAI-PMH; export saved papers as RIS.
- **Saved list** — keep a personal shortlist in the browser, synced through RIS export/import.
- **n8n workflow** — run the included Crossref search workflow and import its RIS output.

## Run it

- **Windows:** unzip, double-click `Start_Field_Atlas.cmd` (needs Node.js 22+), or just open `index.html` for offline use.
- **macOS/Linux:** `npm start` or `node field-atlas-server.cjs`.
- **GitHub:** Codespaces runs the server; Pages serves the static version. See [GITHUB.md](GITHUB.md).

Optional API keys for extra sources (OpenAlex, Scopus, Web of Science, etc.) go in a `.env` file — see `.env.example`.

## Development

Source is under `src/`. After editing, run `npm run build` then `npm test` (no third-party packages needed).
