const adapters={...baseAdapters,...publicAdapters,...keyedAdapters,...regionalAdapters,...researchAdapters,...publisherAdapters};
const adaptedName=name=>name==='OpenAIRE Graph'?'OpenAIRE':name;
const restrictedNames=new Set([...Object.keys(keyedAdapters),...Object.keys(researchAdapters),'BASE']);
const enabledSource=name=>!restrictedNames.has(name)||(atlasRuntime.configured||[]).includes(name);
sourceDirectory.push({name:'DataCite',group:'Live indexes',mode:'Journal-article metadata',detail:'Search DataCite records identified as journal articles. A repository DOI may identify a deposited version.',url:'https://commons.datacite.org/'});
sourceDirectory.push(...publisherDirectory);
const customRoutes={
  'Google Scholar':{url:'https://scholar.google.com/scholar?q={q}',kind:'query'},
  'PubMed':{url:'https://pubmed.ncbi.nlm.nih.gov/?term={q}',kind:'query'},
  'Crossref':{url:'https://search.crossref.org/?q={q}',kind:'query'},
  'Europe PMC':{url:'https://europepmc.org/search?query={q}',kind:'query'},
  'Semantic Scholar':{url:'https://www.semanticscholar.org/search?q={q}',kind:'query'},
  'DataCite':{url:'https://commons.datacite.org/doi.org?query={q}',kind:'query'},
  'IEEE Xplore':{url:'https://ieeexplore.ieee.org/search/searchresult.jsp?newsearch=true&queryText={q}',kind:'query'},
  'SciSpace':{url:'https://scispace.com/',kind:'copy'},
  'Undermind':{url:'https://www.undermind.ai/',kind:'copy'},
  'Consensus':{url:'https://consensus.app/search/?q={q}',kind:'query'},
  'Article Galaxy':{url:'https://www.researchsolutions.com/article-galaxy-mcp',kind:'copy'}
};
const viewNotes={
  'Zotero':'Search the personal or group library selected on the server, or import a Zotero export.',
  'Unpaywall':'Check the DOI directly from a paper using “Check for a free copy”. Enter your contact email in Sources.',
  'Publisher table-of-contents feeds':'Import a publisher RSS or Atom file. Journal-article evidence is required. For a feed containing titles and DOIs only, paste DOIs into the lookup instead.',
  'OAI-PMH':'Import a page from an OAI-PMH ListRecords response in oai_dc format. Only explicitly identified journal articles are retained. Download further pages using the repository’s resumption token.',
  'n8n':'Download the included Crossref workflow or generate one for the current query. Import the resulting RIS file here.',
  'SCImago Journal & Country Rank':'Import a SCImago journal CSV and specify its edition year in the rankings panel.',
  'Clarivate Journal Citation Reports':'Use your licensed edition and import its permitted ranking rows using the normalized CSV template.',
  'SciSpace':'Open SciSpace or its connected ChatGPT app, copy the research prompt and import the returned journal citations or DOIs.',
  'J-STAGE':'Direct search is opt-in and subject to JST’s API conditions. Keyword searches use title words.',
  'Undermind':'Search the configured workspace with the optional bridge. For wider literature discovery, use your connected app and import its selected citations.',
  'NASA SciX / ADS':'Search refereed journal literature using an ADS/SciX API token.',
  'Consensus':'Search the Consensus API with your key, or take the query into Consensus and import journal citations.',
  'Article Galaxy':'Use metadata search in the optional connected bridge or app. Import citations or paste DOIs to find free copies.'
};
function sourceMode(entry){
  const name=adaptedName(entry.name);
  if(!adapters[name])return entry.mode;
  if(restrictedNames.has(name))return enabledSource(name)?'Configured search':'Setup required';
  if(Object.hasOwn(publisherAdapters,name)||['BanglaJOL','African Journals Online','ACM Digital Library'].includes(name))return 'Indexed subset';
  return 'Direct search';
}
function sourceRoute(entry){return portalRoutes[entry.name]||customRoutes[entry.name]||{url:entry.search||entry.url,kind:entry.search?'query':'copy'};}
function portalURL(entry,q){
  const route=sourceRoute(entry);
  if(!q||!route.url?.includes('{q}'))return Atlas.url(route.url?.includes('{q}')?entry.url:route.url||entry.url);
  return Atlas.url(route.url.replaceAll('{q}',encodeURIComponent(q)));
}
function citationPrompt(name,q){
  return 'Search '+name+' for published journal articles on '+q+'. Include open and subscription articles. Return verified citations as journal-article CSL JSON or one verified DOI per line. Include titles, journals and publication years. Identify freely available publisher or accepted repository copies where documented. For other articles return the publisher link. Use metadata search only; no article orders or purchases.';
}
