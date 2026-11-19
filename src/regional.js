// Public RIS exports, Crossref prefix subsets and the registered BASE Search API.
// Provider contracts:
// https://github.com/scieloorg/search-journals/blob/master/iahx/views/search.php
// https://github.com/scieloorg/search-journals/blob/master/iahx-sites/scieloorg/templates/custom/export-ris.html
// https://www.globalindexmedicus.net/ and https://guides.lib.uw.edu/hsl/gim/results
// https://www.crossref.org/documentation/retrieve-metadata/rest-api/rest-api-filters/
// https://www.base-search.net/themes/base/data/download/base_interface.pdf (April 2026)
const regionalAdapters = (() => {
  'use strict';
  const pageSize = 20;
  const list = x => Array.isArray(x) ? x : x == null || x === '' ? [] : [x];
  const clean = x => String(x || '').replace(/<\/?[\w:-]+(?:\s[^<>]*)?>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
  function url(value) {
    try { const link = new URL(value); return ['https:','http:'].includes(link.protocol) && !link.username && !link.password ? link.href : ''; }
    catch { return ''; }
  }
  function identifier(value) {
    const text = String(value || '').trim();
    const doi = text.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i,'').toLowerCase();
    const serial = text.match(/^(?:issn\s*:?\s*)?(\d{4})-?(\d{3}[\dX])$/i);
    return {doi:/^10\.\d{4,9}\/\S+$/.test(doi) ? doi : '', issn: serial ? (serial[1]+'-'+serial[2]).toUpperCase() : ''};
  }
  function doiUrl(doi) {return doi ? 'https://doi.org/'+doi.split('/').map(encodeURIComponent).join('/') : '';}
  async function fetchResponse(destination, params, signal) {
    const link = new URL(destination);
    for (const [key, value] of Object.entries(params)) if(value!==undefined) link.searchParams.set(key,value);
    const response = await atlasFetch(link.href,signal);
    if (!response.ok) throw Error(response.status===429 ? 'Rate limit reached. Try again later.' : 'Provider returned HTTP '+response.status+'. You can also open its search portal.');
    return response;
  }
  function currentLicence(entry){
    if(!entry || entry['content-version']!=='vor' || !url(entry.URL)) return false;
    const link=new URL(entry.URL),start=Date.parse(entry.start?.['date-time']);
    return Number.isFinite(start) && start<=Date.now() && link.hostname==='creativecommons.org' &&
      /^\/(?:licenses\/by(?:-(?:sa|nc|nd))*\/\d\.\d|publicdomain\/(?:zero|mark)\/1\.0)\/?$/i.test(link.pathname);
  }
  function prefixSearch(source,prefix) {
    return async (query,page,signal) => {
      const {doi:exact,issn}=identifier(query);
      if(exact && (!exact.startsWith(prefix+'/') || page>1)) return {items:[],more:false};
      const filters=['type:journal-article','prefix:'+prefix];
      if(issn)filters.push('issn:'+issn);
      const params={filter:filters.join(','),'query.bibliographic':(!issn || exact) ? query : undefined,
        rows:pageSize,offset:(page-1)*pageSize,select:'DOI,title,type,author,container-title,ISSN,issued,published,license,resource,URL'};
      if(exact && !exact.includes(',')){params.filter+=',doi:'+exact;delete params['query.bibliographic'];}
      const data=await (await fetchResponse('https://api.crossref.org/works',params,signal)).json();
      if(!Array.isArray(data.message?.items))throw Error('Crossref returned an unrecognized response.');
      const items=[];
      for(const row of data.message.items){
        const doi=identifier(row.DOI).doi,serials=list(row.ISSN).map(id=>identifier(id).issn).filter(Boolean);
        if(row.type!=='journal-article' || !doi.startsWith(prefix+'/') || (exact && exact!==doi) || (issn && !serials.includes(issn))) continue;
        const title=clean(row.title?.[0]),journal=clean(row['container-title']?.[0]);
        if(!title || !journal)continue;
        const authorList=list(row.author).map(a=>a.name || [a.family,a.given].filter(Boolean).join(', ')).filter(Boolean);
        const publisherUrl=url(row.resource?.primary?.URL)||doiUrl(doi);
        const free=list(row.license).some(currentLicence);
        items.push({title,doi,journal,year:(row.published||row.issued)?.['date-parts']?.[0]?.[0],authors:authorList.join('; '),authorList,issns:serials,
          publisherUrl,recordUrl:doiUrl(doi),source:source+' · Crossref '+prefix+' subset',
          openUrl:free?publisherUrl:'',accessSource:free?'Crossref · published-version open licence':''});
      }
      return {items,more:!exact && data.message.items.length===pageSize && page*pageSize<Math.min(10000,data.message['total-results'])};
    };
  }
  function readExport(ris){
    if(/^\s*<(?:!doctype\s+html|html)\b/i.test(ris))throw Error('The provider returned a web page instead of RIS. Open its search portal to export records.');
    if(ris.trim() && !/^TY\s{1,3}-/m.test(ris))throw Error('The provider returned an unrecognized citation export. Open its search portal.');
    const records=[];let current=null,last='';
    for(const line of ris.replace(/^\uFEFF/,'').split(/\r\n?|\n/)) {
      const entry=line.match(/^([A-Z][A-Z0-9])\s{1,3}-\s?(.*)$/);
      if(entry){
        const [,tag,value]=entry;
        if(tag==='TY')current={};
        if(!current)continue;
        if(tag==='ER'){records.push(current);current=null;last='';continue;}
        (current[tag] ||= []).push(value.trim());last=tag;
      } else if(current && last && line.trim()){
        const values=current[last];values[values.length-1]+=' '+line.trim();
      }
    }
    if(current)records.push(current);
    return records;
  }
  function searchExport(source,endpoint,isScielo){
    return async (query,page,signal)=>{
      const {doi:exact,issn}=identifier(query);
      if(exact && page>1)return {items:[],more:false};
      const term=exact ? '"'+exact.replace(/["\\]/g,' ')+'"' : issn || query;
      const response=await fetchResponse(endpoint,{q:term,lang:'en',output:'ris',count:pageSize,from:(page-1)*pageSize,page},signal);
      const records=readExport(await response.text()),items=[];
      for(const r of records){
        if(!['JOUR','EJOUR'].includes(r.TY?.[0]))continue;
        const title=clean((r.TI||r.T1)?.[0]),journal=clean((r.JO||r.JF||r.T2||r.JA)?.[0]);
        const links=list(r.UR).map(v=>url(clean(v))).filter(Boolean);
        const doi=[...list(r.DO),...links].map(v=>identifier(v).doi).find(Boolean)||'';
        const serials=list(r.SN).map(v=>identifier(v).issn).filter(Boolean);
        if(!title || !journal || (exact&&exact!==doi) || (issn&&!serials.includes(issn)))continue;
        const authorList=(r.AU||r.A1||[]).map(clean).filter(Boolean);
        // The official SciELO RIS template sets UR to sci_arttext and L1 to the available article PDFs.
        const full=isScielo ? (links.find(v=>{const u=new URL(v);return u.searchParams.get('script')==='sci_arttext'&&u.searchParams.get('pid');})||list(r.L1).map(v=>url(clean(v))).find(Boolean)||'') : '';
        const recordUrl=isScielo?(links[0]||doiUrl(doi)):(links.find(v=>new URL(v).hostname.endsWith('.bvsalud.org'))||links[0]||doiUrl(doi));
        items.push({title,journal,doi,year:parseInt((r.PY||r.DA||r.Y1)?.[0],10),issns:serials,authorList,authors:authorList.join('; '),
          source,recordUrl,publisherKnown:Boolean(doi||full),publisherUrl:doiUrl(doi)||(isScielo?full:''),
          openUrl:full,accessSource:full?'SciELO · full text identified in article export':''});
      }
      return {items,more:!exact&&records.length===pageSize};
    };
  }
  function escapeSolr(s){return s.replace(/([+\-!(){}\[\]^"~*?:\\/]|&&|\|\|)/g,'\\$1');}
  async function baseSearch(query,page,signal){
    const {doi:exact,issn}=identifier(query);
    if(issn)throw Error('BASE has no documented journal ISSN search field. Use keywords or DOI.');
    if((exact&&page>1)||(page-1)*pageSize>999)return {items:[],more:false};
    const terms=exact?'dcdoi:"'+escapeSolr(exact)+'"':query.split(/\s+/).map(escapeSolr).join(' ');
    const response=await fetchResponse('https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi',{
      func:'PerformSearch',query:'('+terms+') AND dctypenorm:121',format:'json',hits:pageSize,offset:(page-1)*pageSize,
      fields:'dctitle,dctype,dctypenorm,dcyear,dccreator,dcdoi,dcoa,dclink,dcsource'
    },signal);
    const data=await response.json(),body=data.response;
    if(!Array.isArray(body?.docs))throw Error('BASE search requires an approved key for non-commercial use. Check the server configuration or use the portal.');
    const items=[];
    for(const row of body.docs){
      const types=list(row.dctype).map(v=>String(v).toLowerCase()),title=clean(row.dctitle);
      // BASE code 121 includes newspaper contributions. Retain only explicit journal/scholarly article types.
      const journalArticle=types.some(v=>/(journal[\s_-]*article|article[\s_-]*(?:de[\s_-]*revue|in[\s_-]*journal)|zeitschriftenartikel|info:eu-repo\/semantics\/article|purl\.org\/coar\/resource_type\/c_6501)/i.test(v));
      if(!title || !list(row.dctypenorm).map(String).includes('121') || !journalArticle || types.some(v=>/preprint|conference|newspaper/.test(v)))continue;
      const doi=list(row.dcdoi).map(v=>identifier(v).doi).find(s=>s&&(!exact||s===exact))||'';
      if(exact && doi!==exact)continue;
      const recordUrl=url(row.dclink),journal=clean(row.dcsource);
      const open=recordUrl && Number(row.dcoa)===1 && !/arxiv\.org|researchsquare\.com|ssrn\.com/.test(new URL(recordUrl).hostname);
      const authorList=list(row.dccreator).map(clean).filter(Boolean);
      items.push({title,doi,year:row.dcyear,journal:url(journal)?'':journal,source:'BASE',issns:[],authorList,authors:authorList.join('; '),
        recordUrl,publisherKnown:false,publisherUrl:'',openUrl:open?recordUrl:'',accessSource:open?'BASE · repository location marked open (version unspecified)':''});
    }
    return {items,more:!exact && body.docs.length===pageSize && page*pageSize<Math.min(Number(body.numFound),1000)};
  }
  const searches={'ACM Digital Library':prefixSearch('ACM Digital Library','10.1145'),
    'BanglaJOL':prefixSearch('BanglaJOL','10.3329'),
    'African Journals Online':prefixSearch('African Journals Online','10.4314'),
    'SciELO':searchExport('SciELO','https://search.scielo.org/',true),
    'WHO Global Index Medicus':searchExport('WHO Global Index Medicus','https://pesquisa.bvsalud.org/gim/',false),
    'BASE':baseSearch};
  return Object.defineProperty(searches,'forCrossrefPrefix',{value:prefixSearch});
})();

const portalRoutes={
  'WHO Global Index Medicus':{kind:'query',url:'https://pesquisa.bvsalud.org/gim/?lang=en&q={q}',note:'Open the complete GIM search across the regional Indexes Medici. Journal records from its RIS exports can be imported.'},
  'FAO AGRIS':{kind:'query',url:'https://agris.fao.org/search/en?query={q}',note:'Search FAO AGRIS and filter to journal articles. Its documented machine-access route is the AGRIS Open Dataset (AP/RDF downloads, CC BY 3.0 IGO). The download contains records from participating providers; this dashboard uses the web search for the wider catalog.'},
  'SciELO':{kind:'query',url:'https://search.scielo.org/?lang=en&q={q}',note:'Search the SciELO journal network. The dashboard requests its native article RIS export.'},
  'BanglaJOL':{kind:'query',url:'https://www.banglajol.info/index.php/index/search?query={q}',note:'The dashboard searches articles registered under the 10.3329 DOI prefix through Crossref. The portal also covers papers with other prefixes or no DOI.'},
  'African Journals Online':{kind:'query',url:'https://www.ajol.info/index.php/ajol/search?query={q}',note:'The dashboard searches articles registered under the 10.4314 DOI prefix through Crossref. Search AJOL directly for the wider collection.'},
  'ACM Digital Library':{kind:'query',url:'https://dl.acm.org/action/doSearch?AllField={q}',note:'The dashboard searches 10.1145 journal articles through Crossref. Search the ACM Digital Library directly for its full catalog.'},
  'BASE':{kind:'query',url:'https://www.base-search.net/Search/Results?lookfor={q}&l=en',note:'Server search needs a BASE-approved key for non-commercial use and retains records explicitly identified as journal articles. The portal supports wider discovery.'},
  'GeoRef':{kind:'copy',url:'https://information.americangeosciences.org/georef/',note:'Open the GeoRef provider available through your institution, paste the query, and export selected journal citations.'},
  'GEOBASE':{kind:'copy',url:'https://www.engineeringvillage.com/',note:'Sign in to Engineering Village, select GEOBASE and paste the query. Import a permitted citation export.'},
  'Google Scholar':{kind:'query',url:'https://scholar.google.com/scholar?q={q}',note:'Open the search in Google Scholar. Use Cite or Zotero to collect individual journal papers.'},
  'IEEE Xplore':{kind:'query',url:'https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={q}',note:'Search on IEEE Xplore and select journals in Content Type.'},
  'PubMed':{kind:'query',url:'https://pubmed.ncbi.nlm.nih.gov/?term={q}',note:'Search in PubMed and apply the Journal Article publication type.'},
  'Semantic Scholar':{kind:'query',url:'https://www.semanticscholar.org/search?q={q}',note:'Open the paper search and explore linked citations.'},
  'CORE':{kind:'query',url:'https://core.ac.uk/search?q={q}',note:'Open the repository search and check the published article or manuscript version.'},
  'Web of Science Core Collection':{kind:'copy',url:'https://www.webofscience.com/wos/woscc/basic-search',note:'Open an institutional Web of Science session and paste the query into the Core Collection search.'},
  'Scopus':{kind:'copy',url:'https://www.scopus.com/search/form.uri?display=basic',note:'Open the Scopus document search with institutional access and paste your query.'},
  'SciSpace':{kind:'copy',url:'https://scispace.com/',note:'Paste the query into SciSpace literature search. Import citations or resolve the returned publication DOIs.'},
  'Consensus':{kind:'copy',url:'https://consensus.app/search/',note:'Paste a research question into Consensus and export the citations your account supports.'},
  'Undermind':{kind:'copy',url:'https://www.undermind.ai/',note:'Paste your research question into an Undermind search and import the selected citations.'},
  'Article Galaxy':{kind:'copy',url:'https://www.researchsolutions.com/',note:'Open your Article Galaxy account and paste the topic or DOI into literature search. Use the citation or publisher links.'}
};
