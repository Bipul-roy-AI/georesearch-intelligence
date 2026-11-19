# Field Atlas

Search published journal literature on GIS, remote sensing, geospatial analysis, geography, atmospheric science, human–environment interaction, public health, spatial epidemiology and GeoAI.

[Open the dashboard](https://bipul-roy-ai.github.io/georesearch-intelligence/) · [Open in GitHub Codespaces](https://codespaces.new/Bipul-roy-AI/georesearch-intelligence) · [Download the project ZIP](https://github.com/Bipul-roy-AI/georesearch-intelligence/archive/refs/heads/main.zip)

## Start on Windows

1. Right-click the ZIP and choose **Extract All**. Open the extracted folder.
2. Double-click **Start_Field_Atlas.cmd**. With Node.js 22 or newer installed, it opens the dashboard at **http://127.0.0.1:18776/field-atlas**. Leave its terminal open during searches. Press **Ctrl+C** to stop.
3. If Node.js is unavailable, the launcher opens **index.html** in your default browser. You can also open this file directly in Edge, Chrome or Firefox. The starter papers, filters, citation imports and saved list work offline. New searches and article links need the internet.

On macOS or Linux, open a terminal in this folder and run **npm start** or **node field-atlas-server.cjs** with Node.js 22 or newer. The standard server uses the Node.js standard library and needs no npm install. Download a supported Node.js release from [nodejs.org](https://nodejs.org/en/download).

## Run from GitHub

Copy the **extracted files**, including the dot-prefixed folders, to the repository root. **Codespaces** runs the search server and sources for which you have credentials. **Pages** serves the standalone browser version. Detailed steps and publication settings are in [GITHUB.md](GITHUB.md). The repository file view displays source code. The running dashboard opens at your private Codespaces URL or your published Pages URL.

## Search and read

1. Enter a topic, a DOI, or a journal ISSN in **Explore**. Try **urban heat Chattogram**, **satellite flood exposure**, or **spatial epidemiology**. Use **Load more** for another page from the selected indexes. Each API has its own search syntax, ranking, and maximum retrieval depth.
2. Open **Source details** below the result count to see which providers returned records, had a quota issue, or could not be reached. Filters and counts apply to the unique articles loaded so far. Year and quartile filters do not launch an exhaustive search of a provider.
3. In **Sources**, use **Include publisher collections** to add the 14 publisher DOI-prefix subsets. Enable **J-STAGE** individually after checking its terms. When configured, Article Galaxy and Undermind also have individual enable switches.
4. Use **Read free full text** for a source-identified public copy. Free access may refer to the accepted manuscript or the publisher version. **Publisher page** opens the official landing page for a known published article. For ambiguous repository DOIs or articles without an identified publisher, use the labeled source record. **No free link located** describes the evidence available to the dashboard. A subscription journal may have a free article or a free repository copy.
5. To look for a free copy by DOI, enter your own contact email under **Sources → Find a free copy by DOI**. A check sends that DOI and email to Unpaywall. The dashboard links to articles on the original host.

## Source coverage

The package covers all 35 entries in the first dashboard and adds DataCite and 14 publisher collections. [Source_Catalog.csv](Source_Catalog.csv) lists each of the 50 entries, its search or import route, and scope. There are 41 search integrations. Several use the same underlying Crossref index. The other nine entries support discovery, access checks, imports, automation or rankings.

| Source or route | How it works |
| --- | --- |
| Crossref, OpenAlex, Europe PMC, DOAJ, OpenAIRE | Broad journal searches with source attribution and available publisher or free links. |
| PubMed, Semantic Scholar, USGS Publications Warehouse, DataCite, J-STAGE | Additional journal searches. J-STAGE keyword searches use title words. DataCite can point to repository versions. |
| SciELO and WHO Global Index Medicus | Request pages of citations through their native RIS export. If the provider returns a challenge or disables the export, the source card opens its search portal with your query. |
| BanglaJOL, African Journals Online and ACM Digital Library | Search Crossref journal records for the indicated DOI prefix. Also open the full catalog with the same query. |
| Elsevier, Springer, Nature Portfolio, Wiley, Taylor & Francis, Sage, Oxford, Cambridge, Copernicus, MDPI, Frontiers, PLOS, AMS and AGU | Optional Crossref DOI-prefix searches bring more records from specific publishing collections into a broad search. A publisher can use several prefixes, and a journal can transfer between publishers. |
| NASA SciX/ADS, IEEE Xplore, CORE, BASE, Scopus, GeoRef, GEOBASE, Web of Science, Consensus | Search through the server after configuring the appropriate provider access. Some services also require institutional network access or approval. BASE's machine interface has non-commercial use terms. |
| Zotero, Article Galaxy and Undermind | Search a configured Zotero library or use an optional account connection. Undermind is scoped to the connected workspace. See [MCP.md](MCP.md). |
| FAO AGRIS, Google Scholar and SciSpace | Search in the service, then import selected journal records or paste DOIs for verification. Each card carries the query or provides a copy action. |
| Publisher feeds and OAI-PMH | Import publisher RSS/Atom or OAI Dublin Core XML. Generic headlines, repository records without journal evidence, and preprints can be skipped. The import reports skipped records. For a feed with DOIs and little type information, paste the DOIs into the lookup. |
| Unpaywall, SCImago, Journal Citation Reports and n8n | Resolve article access, import journal ranks, or run the supplied n8n workflow. These tools each have a specific role in the dashboard. |

Public databases overlap, and some journals supply incomplete metadata. In particular, a DOI-prefix search covers a subset of a publishing platform. One result lists all contributing sources that identified it.

## Optional server credentials

Copy **.env.example** to **.env** beside **index.html**, fill in only the settings you use, then restart the server. On Windows you can run **copy .env.example .env** from Command Prompt in the extracted folder. For GitHub Codespaces use account or repository-authorized Codespaces secrets with the same names. The server only displays which integrations are configured. Provider access and search limits still depend on the account.

| Provider | Environment variable or step |
| --- | --- |
| OpenAlex, NCBI, Semantic Scholar | Optional **OPENALEX_API_KEY**, **NCBI_API_KEY**, **SEMANTIC_SCHOLAR_API_KEY** for the corresponding provider |
| NASA SciX / ADS | **ADS_API_TOKEN** |
| IEEE Xplore | **IEEE_API_KEY** |
| CORE and BASE | **CORE_API_KEY**, **BASE_API_KEY**, respectively |
| Scopus | **SCOPUS_API_KEY** and, if issued, **SCOPUS_INST_TOKEN** |
| GeoRef and GEOBASE | **EV_API_KEY** and, if issued, **EV_INST_TOKEN**. Engineering Village checks the entitlement for each database. |
| Web of Science Core Collection | **WOS_API_KEY** for the Web of Science Starter API |
| Consensus | **CONSENSUS_API_KEY** |
| Zotero | **ZOTERO_LIBRARY_TYPE** set to **users** or **groups**, **ZOTERO_LIBRARY_ID** set to the numeric ID, and **ZOTERO_API_KEY** if the library requires it. Use a key with read access. |
| Article Galaxy and Undermind | Optional local OAuth setup and additional packages described in **MCP.md** |

## Bring in citations and rankings

**Sources → Import journal articles** accepts RIS, PubMed NBIB, CSL JSON, Zotero JSON, RSS/Atom and OAI-PMH Dublin Core XML. Select the originating source before importing. Pasted DOIs are normalized and resolved to journal records. A bare PDF link in an imported citation does not establish free access. **Saved** stores records in this browser profile. The local dashboard, Codespaces and Pages use different browser storage. **Export RIS** exports the records matching the current filters, including unique work identifiers where available.

Rankings use journal ISSNs, the selected edition year, ranking system and subject category. Built-in examples cover selected 2024 and 2025 SCImago categories. Use an original SCImago CSV with its edition year or adapt a permitted ranking export to [journal_ranking_template.csv](examples/journal_ranking_template.csv). Missing matches show **Quartile unknown**.

## n8n and editable source

Import [Field_Atlas_n8n.json](examples/Field_Atlas_n8n.json) into your own n8n instance. Run the manual workflow, download the RIS from its final node and import it into Field Atlas. The included workflow searches up to 100 Crossref journal records per run. Use **Download n8n workflow** in Sources to generate a version for your current topic.

The ready-to-run entry point is **index.html**. Editable modules are under **src/**. After changing them run **npm run build**, then **npm test**. The build refreshes the HTML, server launcher, source catalog and example files. Standard builds and tests use Node.js without third-party packages.
