const sourceDirectory = [
  {
    "name": "OpenAlex",
    "group": "Live indexes",
    "mode": "Live search",
    "detail": "Search journal literature and discover open copies. This dashboard uses public, keyless search; larger harvests can use a verified OpenAlex API key.",
    "url": "https://openalex.org/"
  },
  {
    "name": "Crossref",
    "group": "Live indexes",
    "mode": "Live search",
    "detail": "Search publisher-deposited DOI records, including subscription journals. A DOI links to the registered publication.",
    "url": "https://www.crossref.org/documentation/retrieve-metadata/rest-api/"
  },
  {
    "name": "Europe PMC",
    "group": "Live indexes",
    "mode": "Live search",
    "detail": "Search public health, environmental epidemiology and life sciences. Repository full text is available for a subset.",
    "url": "https://europepmc.org/"
  },
  {
    "name": "DOAJ",
    "group": "Live indexes",
    "mode": "Live search",
    "detail": "Find articles whose metadata publishers deposited for journals listed in the Directory of Open Access Journals.",
    "url": "https://doaj.org/"
  },
  {
    "name": "OpenAIRE Graph",
    "group": "Live indexes",
    "mode": "Live search",
    "detail": "Discover publications linked across repositories, research organizations and projects.",
    "url": "https://graph.openaire.eu/"
  },
  {
    "name": "NASA SciX / ADS",
    "group": "Specialist & regional",
    "mode": "External search",
    "detail": "Search Earth and space science literature on satellite observations, atmospheric processes and instruments. Select journal papers in the results.",
    "url": "https://scixplorer.org/"
  },
  {
    "name": "IEEE Xplore",
    "group": "Specialist & regional",
    "mode": "External search",
    "detail": "Search radar, satellite image processing, geoscience and machine learning. Use the journals filter when screening results.",
    "url": "https://ieeexplore.ieee.org/"
  },
  {
    "name": "ACM Digital Library",
    "group": "Specialist & regional",
    "mode": "External search",
    "detail": "Find computing journals on spatial databases, location data and machine learning. Limit results to journals for this collection.",
    "url": "https://dl.acm.org/"
  },
  {
    "name": "WHO Global Index Medicus",
    "group": "Specialist & regional",
    "mode": "External search",
    "detail": "Search regional health indexes for environmental health and spatial epidemiology studies. Try local place names and languages.",
    "url": "https://www.globalindexmedicus.net/"
  },
  {
    "name": "PubMed",
    "group": "Specialist & regional",
    "mode": "External search",
    "detail": "Combine geographic terms with MeSH headings for disease, exposure or health service access. Selected citations can be transferred through Zotero.",
    "url": "https://pubmed.ncbi.nlm.nih.gov/",
    "search": "https://pubmed.ncbi.nlm.nih.gov/?term={q}"
  },
  {
    "name": "FAO AGRIS",
    "group": "Specialist & regional",
    "mode": "External search",
    "detail": "Search agriculture, soils and land management. Screen for journal articles when working with the wider AGRIS collection.",
    "url": "https://www.fao.org/agris/"
  },
  {
    "name": "SciELO",
    "group": "Specialist & regional",
    "mode": "External search",
    "detail": "Explore multilingual journal collections, including public health and environmental research from Latin America.",
    "url": "https://www.scielo.org/en/search/"
  },
  {
    "name": "BanglaJOL",
    "group": "Specialist & regional",
    "mode": "External search",
    "detail": "Find Bangladesh-published journals on geography, hazards, health and the environment. Search regional and historical place names.",
    "url": "https://www.banglajol.info/"
  },
  {
    "name": "African Journals Online",
    "group": "Specialist & regional",
    "mode": "External search",
    "detail": "Discover African-published research and follow each journal’s access information.",
    "url": "https://www.ajol.info/index.php/ajol/search"
  },
  {
    "name": "J-STAGE",
    "group": "Specialist & regional",
    "mode": "External search",
    "detail": "Search Japanese academic society journals on geography, remote sensing, atmospheric science and public health.",
    "url": "https://www.jstage.jst.go.jp/"
  },
  {
    "name": "USGS Publications Warehouse",
    "group": "Specialist & regional",
    "mode": "External search",
    "detail": "Search USGS-authored journal articles on water, hazards and land change. Filter out government reports when collecting journal papers.",
    "url": "https://pubs.usgs.gov/"
  },
  {
    "name": "CORE",
    "group": "Repositories & citations",
    "mode": "Repository search",
    "detail": "Find copies deposited in repositories. Compare the title and DOI to identify the published work and manuscript version.",
    "url": "https://core.ac.uk/"
  },
  {
    "name": "BASE",
    "group": "Repositories & citations",
    "mode": "Repository search",
    "detail": "Search Bielefeld University’s repository index, including regional and institutional collections. Check each record’s publication type.",
    "url": "https://www.base-search.net/"
  },
  {
    "name": "Semantic Scholar",
    "group": "Repositories & citations",
    "mode": "Citation discovery",
    "detail": "Follow references and citing papers from a known GIS, public health or GeoAI article. Screen the resulting journal records.",
    "url": "https://www.semanticscholar.org/"
  },
  {
    "name": "Unpaywall",
    "group": "Repositories & citations",
    "mode": "DOI lookup",
    "detail": "Look up a DOI to locate open versions at publishers or repositories. Its API accepts an email address and the article DOI.",
    "url": "https://unpaywall.org/api"
  },
  {
    "name": "GeoRef",
    "group": "Licensed indexes",
    "mode": "Institutional search",
    "detail": "Use library access to search the American Geosciences Institute index for earth sciences, geology and geohazards. Transfer selected journal citations via RIS.",
    "url": "https://information.americangeosciences.org/georef/"
  },
  {
    "name": "GEOBASE",
    "group": "Licensed indexes",
    "mode": "Institutional search",
    "detail": "Use Engineering Village access for geography, environmental sciences and human–environment research. Export eligible journal citations within your license.",
    "url": "https://www.elsevier.com/en-gb/products/engineering-village/databases"
  },
  {
    "name": "Scopus",
    "group": "Licensed indexes",
    "mode": "Institutional search",
    "detail": "Search journals and citation links with institutional access. Export permitted journal records as RIS for import.",
    "url": "https://www.elsevier.com/products/scopus"
  },
  {
    "name": "Web of Science Core Collection",
    "group": "Licensed indexes",
    "mode": "Institutional search",
    "detail": "Use institutional access for topic and cited-reference searches. Bring selected journal records into Zotero for RIS export.",
    "url": "https://webofscience.help.clarivate.com/en-us/Content/wos-core-collection/wos-core-collection.htm"
  },
  {
    "name": "Google Scholar",
    "group": "Research tools",
    "mode": "Manual discovery",
    "detail": "Use title searches, cited-by results and article versions to find additional leads. Check publication type and save selected journal citations.",
    "url": "https://scholar.google.com/"
  },
  {
    "name": "SciSpace",
    "group": "Research tools",
    "mode": "Research connector",
    "detail": "Use a separate SciSpace search for natural-language queries. Save selected journal citations to Zotero or look up their DOIs.",
    "url": "https://www.scispace.com/help/en/articles/10706821-how-scispace-search-works"
  },
  {
    "name": "Consensus",
    "group": "Research tools",
    "mode": "Research connector",
    "detail": "Use a separate evidence search for focused research questions. Check suggested papers at the journal and collect selected citations.",
    "url": "https://consensus.app/"
  },
  {
    "name": "Undermind",
    "group": "Research tools",
    "mode": "Research connector",
    "detail": "Use a separate deep literature search for questions that combine methods, geography and outcomes. Retain relevant journal citations.",
    "url": "https://www.undermind.ai/"
  },
  {
    "name": "Article Galaxy",
    "group": "Research tools",
    "mode": "Research connector",
    "detail": "Use the separate literature search and availability tools. Bring citation metadata into your collection and follow the publisher for restricted articles.",
    "url": "https://www.researchsolutions.com/"
  },
  {
    "name": "Publisher table-of-contents feeds",
    "group": "Automation & rankings",
    "mode": "RSS / Atom",
    "detail": "Follow official journal feeds for new articles. Save relevant items with Zotero, check their item type and export journal citations as RIS.",
    "url": "https://www.zotero.org/support/feeds"
  },
  {
    "name": "OAI-PMH",
    "group": "Automation & rankings",
    "mode": "Metadata harvesting",
    "detail": "Harvest metadata from participating repositories by datestamp. Filter for journal articles and reconcile versions against the publisher DOI.",
    "url": "https://www.openarchives.org/OAI/openarchivesprotocol.html"
  },
  {
    "name": "Zotero",
    "group": "Automation & rankings",
    "mode": "RIS transfer",
    "detail": "Collect journal citations from different services, select the items in Zotero and export as RIS for dashboard import.",
    "url": "https://www.zotero.org/support/kb/exporting"
  },
  {
    "name": "n8n",
    "group": "Automation & rankings",
    "mode": "Workflow builder",
    "detail": "An external workflow can poll journal feeds or APIs, retain dates and identifiers, deduplicate records and prepare a citation import.",
    "url": "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.rssfeedread/"
  },
  {
    "name": "SCImago Journal & Country Rank",
    "group": "Automation & rankings",
    "mode": "Quartile reference",
    "detail": "Find SJR quartiles by journal, category and year. Record the category when preparing a journal-ranking import.",
    "url": "https://www.scimagojr.com/help.php"
  },
  {
    "name": "Clarivate Journal Citation Reports",
    "group": "Automation & rankings",
    "mode": "Licensed rankings",
    "detail": "Use licensed JCR data to check JIF quartiles by category and edition. Identify the metric in every imported ranking.",
    "url": "https://supportcenter.clarivate.com/s/article/Journal-Citation-Reports-Quartile-rankings-and-other-metrics?language=en_US"
  }
];

