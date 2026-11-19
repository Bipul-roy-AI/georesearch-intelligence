// Consensus and the two OAuth research tools search mixed scholarly indexes.
// Check their identifiers against the published journal record before display.
const researchAdapters = (() => {
  const pageSize=20;

  async function fetchJson(url, signal, name) {
    const response=await atlasFetch(url,signal);
    if(!response.ok) {
      if(response.status===429)throw Error(name+' rate limit reached. Try again later.');
      if(response.status===403 && name==='Consensus')throw Error('Consensus access or pagination is restricted by this API plan.');
      throw Error(name+' returned HTTP '+response.status+'.');
    }
    return response;
  }
  function serialQuery(q){return /^(?:ISSN\s*:?\s*)?\d{4}-?\d{3}[\dX]$/i.test(q.trim());}
  async function confirmedJournals(candidates, signal) {
    const verified=new Map(), titles=new Map(candidates.map(r=>[Atlas.doi(r.doi),r.title]).filter(([id])=>id));
    const identifiers=[...titles.keys()].filter(id=>!id.includes(','));
    async function find(params) {
      const endpoint=new URL('https://api.crossref.org/works');
      endpoint.search=new URLSearchParams({...params,select:'DOI,type,title,container-title,published,ISSN,author'});
      const res=await fetchJson(endpoint,signal,'Crossref journal verification');
      const payload=await res.json();
      for(const row of payload.message?.items||[])if(row.type==='journal-article')verified.set(Atlas.doi(row.DOI),row);
    }
    if(identifiers.length)await find({filter:['type:journal-article',...identifiers.map(d=>'doi:'+d)].join(','),rows:String(identifiers.length)});
    // A comma inside a DOI would split a Crossref filter. Look up the title, then require the same DOI below.
    for(const [id,title] of titles)if(id.includes(',')&&title)await find({filter:'type:journal-article','query.bibliographic':title,rows:'5'});
    return candidates.filter(r=>verified.has(Atlas.doi(r.doi))).map(candidate=>{
      const doi=Atlas.doi(candidate.doi), publication=verified.get(doi);
      const authorList=(publication.author||[]).map(a=>a.name||[a.family,a.given].filter(Boolean).join(', ')).filter(Boolean);
      return {...candidate,doi,title:publication.title?.[0]?.replace(/<[^>]*>/g,'')||candidate.title,
        journal:publication['container-title']?.[0]||candidate.journal,
        year:publication.published?.['date-parts']?.[0]?.[0]||candidate.year,issns:publication.ISSN||candidate.issns||[],
        authorList:authorList.length?authorList:(candidate.authorList||[]),
        authors:authorList.length?authorList.join('; '):(candidate.authors||''),publisherUrl:Atlas.doiLink(doi),
        sources:[candidate.source,'Crossref (journal verification)']};
    });
  }
  async function consensus(q,page,signal) {
    if(serialQuery(q))throw Error('Consensus has no documented journal ISSN filter. Use a title or topic.');
    const exact=Atlas.doi(q),url=new URL('https://api.consensus.app/v1/search');
    url.search=new URLSearchParams({query:exact||q,page:String(page-1),page_size:String(pageSize),
      exclude_preprints:'true',include_full_text_chunks:'false'});
    const response=await fetchJson(url,signal,'Consensus');
    const data=await response.json();
    if(!Array.isArray(data.results))throw Error('Consensus returned an unexpected result format.');
    const candidates=data.results.filter(r=>!r.is_preprint&&r.title&&r.doi&&(!exact||Atlas.doi(r.doi)===exact)).map(r=>({
      source:'Consensus',title:r.title,journal:r.journal_name,doi:r.doi,year:r.publish_year,
      authorList:r.authors||[],authors:(r.authors||[]).join('; '),recordUrl:Atlas.url(r.url),openUrl:''
    }));
    return {items:await confirmedJournals(candidates,signal),more:!exact&&page<50&&!data.is_end&&data.next_page===page};
  }
  async function zotero(q,page,signal) {
    if(serialQuery(q))throw Error('Zotero has no documented journal ISSN filter. Use a title or author.');
    const scope=atlasRuntime.zoteroScope;
    if(!/^(?:users|groups)\/[1-9]\d*$/.test(scope||''))throw Error('Configure a Zotero user or group library on the server.');
    const exact=Atlas.doi(q),url=new URL('https://api.zotero.org/'+scope+'/items/top');
    url.search=new URLSearchParams({q:exact||q,qmode:'everything',itemType:'journalArticle',format:'json',
      v:'3',limit:String(pageSize),start:String((page-1)*pageSize)});
    const response=await fetchJson(url,signal,'Zotero');
    const rows=await response.json();
    if(!Array.isArray(rows))throw Error('Zotero returned an unexpected result format.');
    const items=rows.filter(r=>r.data?.itemType==='journalArticle'&&r.data.title&&(!exact||Atlas.doi(r.data.DOI)===exact)).map(r=>{
      const d=r.data,doi=Atlas.doi(d.DOI);
      const authorList=(d.creators||[]).filter(a=>a.creatorType==='author').map(a=>a.name||[a.lastName,a.firstName].filter(Boolean).join(', '));
      return {title:d.title,journal:d.publicationTitle,year:Number(String(r.meta?.parsedDate||d.date||'').match(/\b(?:1[4-9]\d{2}|20\d{2})\b/)?.[0])||0,
        doi,authorList,authors:authorList.join('; '),issns:Atlas.issns(d.ISSN),source:'Zotero',openUrl:'',
        recordUrl:Atlas.url(r.links?.alternate?.href),publisherUrl:doi?Atlas.doiLink(doi):''};
    });
    const total=response.headers.get('Total-Results');const more=total!==null&&/^\d+$/.test(total)?page*pageSize<Number(total):rows.length===pageSize;
    return {items,more:!exact&&more};
  }
  async function mcpSearch(source,q,page,signal) {
    if(serialQuery(q))throw Error(source+' has no documented journal ISSN filter. Use a title or topic.');
    const params=new URLSearchParams({source,q,page:String(page)});
    const response=await fetch('/mcp-search?'+params,{signal,credentials:'same-origin',headers:{'X-Field-Atlas':'1'}});
    if(!response.ok)throw Error(source+' search is unavailable. '+(await response.text()).slice(0,180));
    const data=await response.json();
    if(!Array.isArray(data.items))throw Error(source+' returned an unexpected result format.');
    const exact=Atlas.doi(q);
    const items=await confirmedJournals(data.items.filter(r=>!exact||exact===Atlas.doi(r.doi)),signal);
    return {items,more:!exact&&data.more===true};
  }
  return {Consensus:consensus,Zotero:zotero,Undermind:(q,p,s)=>mcpSearch('Undermind',q,p,s),
    'Article Galaxy':(q,p,s)=>mcpSearch('Article Galaxy',q,p,s)};
})();
