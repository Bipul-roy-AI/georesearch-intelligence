// Public journal discovery. Each provider supplies its own document type and access evidence.
const publicAdapters = (() => {
  'use strict';
  const size = 20;
  const empty = () => ({items: [], more: false});
  const arr = value => Array.isArray(value) ? value : [];
  const txt = value => typeof value === 'string' ? value.trim() : '';
  const plain = value => txt(value).replace(/<\/?[\w:-]+(?:\s[^<>]*)?>/g,'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  function queryIds(query) {
    return {
      doi: Atlas.doi(query),
      serial: /^(?:ISSN\s*:?\s*)?\d{4}-?\d{3}[\dX]$/i.test(query.trim()) ? Atlas.issns(query)[0] : ''
    };
  }
  function urlFor(base, params) {
    const url = new URL(base);
    for (const [name,value] of Object.entries(params)) if (value !== undefined && value !== '') url.searchParams.set(name,String(value));
    return url.href;
  }
  async function response(base, params, signal, allow404=false) {
    const res = await atlasFetch(urlFor(base,params),signal);
    if (allow404 && res.status===404) return null;
    if (!res.ok) {
      if (res.status===429) throw Error('Rate limit reached. Try again later.');
      if (res.status===401 || res.status===403) throw Error('Provider refused this request (HTTP '+res.status+'). Check access, optional keys and provider limits.');
      throw Error('Provider returned HTTP '+res.status+'.');
    }
    return res;
  }
  function record(source,data) {
    const authorList = arr(data.authorList).map(plain).filter(Boolean);
    const doi = Atlas.doi(data.doi), openUrl = Atlas.url(data.openUrl);
    return {...data,source,doi,title:plain(data.title),journal:plain(data.journal),year:Number(data.year)||0,
      authorList,authors:authorList.join('; '),issns:Atlas.issns(data.issns),openUrl,
      accessSource:openUrl?data.accessSource:'',publisherUrl:Atlas.url(data.publisherUrl)||(data.publisherKnown===false?'':Atlas.doiLink(doi)),
      recordUrl:Atlas.url(data.recordUrl)};
  }
  function finish(items, ids, more) {
    return {items:items.filter(r=>r.title && (!ids.doi||r.doi===ids.doi) && (!ids.serial||r.issns.includes(ids.serial))),more:!ids.doi && Boolean(more)};
  }
  function demandArray(value,name) {
    if (!Array.isArray(value)) throw Error(name+' returned an unrecognized search response.');
    return value;
  }

  // Entrez allows three anonymous requests/second. Space starts across repeat searches in this tab.
  let ncbiNext = 0;
  async function ncbi(service,params,signal) {
    const delay=Math.max(0,ncbiNext-Date.now());
    ncbiNext=Date.now()+delay+360;
    if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
    if(signal?.aborted) throw signal.reason || Error('Request cancelled.');
    const payload=await (await response('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'+service+'.fcgi',
      {tool:'field_atlas_literature',retmode:'json',...params},signal)).json();
    if(payload.error || payload.esearchresult?.ERROR) throw Error(String(payload.error || payload.esearchresult.ERROR));
    return payload;
  }
  async function pubmed(query,page,signal) {
    const ids=queryIds(query), start=(page-1)*size;
    if(start>=9999) return empty();
    const searchTerm=ids.doi?'"'+ids.doi.replace(/"/g,'')+'"[AID]':ids.serial?ids.serial+'[ISSN]':query;
    const search=await ncbi('esearch',{db:'pubmed',term:'('+searchTerm+') AND ("Journal Article"[pt] OR Review[pt]) NOT Preprint[pt]',
      sort:'relevance',retstart:start,retmax:Math.min(size,9999-start)},signal);
    const idsPage=demandArray(search.esearchresult?.idlist,'PubMed');
    if(!idsPage.length)return empty();
    const result=(await ncbi('esummary',{db:'pubmed',id:idsPage.join(',')},signal)).result;
    if(!result)throw Error('PubMed returned an unrecognized summary.');
    const rows=idsPage.map(id=>result[id]).filter(row=>row && row.fulljournalname &&
      arr(row.pubtype).some(t=>/^(journal article|review)$/i.test(t)) && !arr(row.pubtype).some(t=>/preprint/i.test(t)));
    const getId=(row,type)=>arr(row.articleids).find(id=>id.idtype===type)?.value;
    const pmcIds=[...new Set(rows.map(r=>String(getId(r,'pmc')||'')).filter(v=>/^PMC\d+$/i.test(v)).map(v=>v.slice(3)))];
    let openIds=new Set();
    if(pmcIds.length) {
      // Some PMCID assignments are embargoed. Resolve live open-subset membership in one optional call.
      try {
        const registered=await ncbi('esearch',{db:'pmc',term:'('+pmcIds.map(id=>id+'[UID]').join(' OR ')+') AND open access[filter]',retmax:pmcIds.length},signal);
        openIds=new Set(arr(registered.esearchresult?.idlist));
      } catch(error) { if(signal?.aborted)throw error; }
    }
    const items=rows.map(row=>{
      const pmc=String(getId(row,'pmc')||'');
      return record('PubMed',{title:row.title,doi:getId(row,'doi'),journal:row.fulljournalname,issns:[row.issn,row.essn],
        year:parseInt(row.pubdate||row.epubdate,10),authorList:arr(row.authors).map(a=>a.name),
        openUrl:/^PMC\d+$/i.test(pmc)&&openIds.has(pmc.slice(3))?'https://pmc.ncbi.nlm.nih.gov/articles/'+pmc+'/':'',
        accessSource:'PubMed Central · article confirmed in the open access subset',
        recordUrl:'https://pubmed.ncbi.nlm.nih.gov/'+encodeURIComponent(row.uid)+'/'});
    });
    return finish(items,ids,start+idsPage.length<Math.min(Number(search.esearchresult.count),9999));
  }

  const s2Fields='title,authors,year,publicationTypes,publicationVenue,journal,externalIds,isOpenAccess,openAccessPdf,url';
  async function semanticScholar(query,page,signal) {
    const ids=queryIds(query),offset=(page-1)*size;
    if(ids.serial)throw Error('Semantic Scholar has no supported exact ISSN search here. Use a topic or DOI.');
    if(offset>=1000)return empty();
    const base='https://api.semanticscholar.org/graph/v1/paper/';
    const res=ids.doi?await response(base+'DOI:'+encodeURIComponent(ids.doi),{fields:s2Fields},signal,true):
      await response(base+'search',{fields:s2Fields,query,publicationTypes:'JournalArticle',limit:size,offset},signal);
    if(!res)return empty();
    const data=await res.json(), rows=ids.doi?[data]:demandArray(data.data,'Semantic Scholar');
    const items=rows.filter(r=>(arr(r.publicationTypes).includes('JournalArticle')||r.publicationVenue?.type==='journal') &&
      !arr(r.publicationTypes).some(t=>/Conference|Preprint/i.test(t)) && r.publicationVenue?.type!=='conference').map(row=>{
        const pdf=Atlas.url(row.openAccessPdf?.url);
        const usePdf=row.isOpenAccess===true && pdf && !/(^|\.)(?:arxiv\.org|biorxiv\.org|medrxiv\.org|preprints\.org|ssrn\.com|researchsquare\.com|eartharxiv\.org)$/i.test(new URL(pdf).hostname);
        return record('Semantic Scholar',{title:row.title,doi:row.externalIds?.DOI,year:row.year,journal:row.publicationVenue?.name||row.journal?.name,
          issns:row.publicationVenue?.issn,authorList:arr(row.authors).map(a=>a.name),openUrl:usePdf?pdf:'',
          accessSource:'Semantic Scholar · article-level open-access PDF',recordUrl:row.url});
      });
    return finish(items,ids,Boolean(data.next)&&data.next<1000);
  }

  function label(value) { return typeof value==='string'?value:txt(value?.text)||txt(value?.name)||txt(value?.description); }
  async function usgs(query,page,signal) {
    const ids=queryIds(query);
    if(ids.serial)throw Error('USGS has no supported exact ISSN search here. Use a topic or DOI.');
    const data=await (await response('https://pubs.usgs.gov/pubs-services/publication/',
      {q:ids.doi?undefined:query,doi:ids.doi||undefined,subtypeName:'Journal Article',page_size:size,page_number:page,mimeType:'json'},signal)).json();
    const rows=demandArray(data.records||data.results||data.items,'USGS');
    const items=rows.filter(row=>/^journal article$/i.test(label(row.publicationSubtype)||label(row.publicationType))).map(row=>{
      const rawAuthors=Array.isArray(row.contributors)?row.contributors:arr(row.contributors?.author||row.contributors?.authors);
      const authors=rawAuthors.filter(a=>typeof a==='string'||!a.contributorType||/^authors?$/i.test(label(a.contributorType))).map(a=>{
        if(typeof a==='string')return a;
        const person=a.contributor||a;
        return person.text||person.name||person.organization||[person.family||person.familyName,person.given||person.givenName].filter(Boolean).join(', ');
      });
      const manuscript=arr(row.links).find(l=>/accepted manuscript/i.test([label(l.type),label(l.linkType),l.description,l.text].join(' ')) &&
        /^https:\/\/(?:[a-zA-Z0-9-]+\.)*usgs\.gov\//i.test(l.url));
      return record('USGS Publications Warehouse',{title:row.title,doi:row.doi,journal:label(row.seriesTitle)||label(row.series),
        year:row.publicationYear,authorList:authors,issns:[row.issn,row.seriesTitle?.printIssn,row.seriesTitle?.onlineIssn],openUrl:manuscript?.url,
        accessSource:'USGS Publications Warehouse · agency-hosted accepted manuscript',
        recordUrl:row.indexId?'https://pubs.usgs.gov/publication/'+encodeURIComponent(row.indexId):''});
    });
    const total=Number(data.recordCount??data.totalRecordCount??data.total);
    return finish(items,ids,rows.length===size && (!Number.isFinite(total)||page*size<total));
  }

  const jstageBase='https://api.jstage.jst.go.jp/searchapi/do';
  const stageJournals=new Map();
  const elements=(xml,tag)=>Array.from(xml?.getElementsByTagNameNS('*',tag)||[]);
  const value=(xml,tag)=>txt(elements(xml,tag)[0]?.textContent);
  function languageGroup(entry,tag) {
    const block=elements(entry,tag)[0];
    return elements(block,'en').find(n=>txt(n.textContent))||elements(block,'ja').find(n=>txt(n.textContent));
  }
  async function stageXML(params,signal) {
    const xml=new DOMParser().parseFromString(await (await response(jstageBase,params,signal)).text(),'application/xml');
    if(elements(xml,'parsererror').length)throw Error('J-STAGE returned unreadable XML.');
    const err=value(xml,'errcd')||value(xml,'error_code')||String(xml.documentElement?.textContent||'').match(/\b(?:SYS_)?ERR_\d{3}\b/)?.[0];
    if(err && err!=='ERR_001')throw Error('J-STAGE service message '+err+'.');
    return xml;
  }
  async function jstage(query,page,signal) {
    const ids=queryIds(query), batch=6,start=(page-1)*batch+1;
    if(ids.doi)throw Error('J-STAGE article search has no exact DOI parameter. Use a topic or journal ISSN.');
    const xml=await stageXML({service:3,issn:ids.serial||undefined,article:ids.serial?undefined:query,start,count:batch},signal);
    const rows=elements(xml,'entry'),total=Number(value(xml,'totalResults')),items=[];
    for(const entry of rows){
      const code=value(entry,'cdjournal');
      if(!code)continue;
      if(!stageJournals.has(code)){
        // The article feed also includes proceedings. Service 1 supports an exact journal-code and journal-type restriction.
        const catalog=await stageXML({service:1,cdjournal:code,pubtype:100},signal);
        const journal=elements(catalog,'entry').some(e=>value(e,'cdjournal')===code);
        if(stageJournals.size>=2000)stageJournals.clear();
        stageJournals.set(code,journal);
      }
      if(!stageJournals.get(code))continue;
      const articleURL=txt(languageGroup(entry,'article_link')?.textContent);
      items.push(record('J-STAGE',{title:txt(languageGroup(entry,'article_title')?.textContent),journal:txt(languageGroup(entry,'material_title')?.textContent),
        year:value(entry,'pubyear'),doi:value(entry,'doi'),issns:[value(entry,'issn'),value(entry,'eIssn')],
        authorList:elements(languageGroup(entry,'author'),'name').map(n=>n.textContent),publisherUrl:articleURL,recordUrl:articleURL}));
    }
    return finish(items,ids,start-1+rows.length<total && rows.length>0);
  }

  function dcLiteral(value) { return '"'+String(value).replace(/["\\]/g,'\\$&')+'"'; }
  async function datacite(query,page,signal) {
    const ids=queryIds(query);
    const serial=dcLiteral(ids.serial);
    const term=ids.doi?'doi:'+dcLiteral(ids.doi):ids.serial?'(relatedIdentifiers.relatedIdentifier:'+serial+' OR container.identifier:'+serial+' OR relatedItems.relatedItemIdentifier.relatedItemIdentifier:'+serial+')':
      query.trim().split(/\s+/).map(dcLiteral).join(' AND ');
    const res=await response('https://api.datacite.org/dois',{
      query:'types.resourceTypeGeneral:JournalArticle AND ('+term+')','page[size]':size,'page[number]':page},signal);
    const data=await res.json(),rows=demandArray(data.data,'DataCite');
    const items=rows.map(row=>row.attributes).filter(a=>a?.types?.resourceTypeGeneral==='JournalArticle').map(a=>{
      const parent=arr(a.relatedItems).find(i=>i.relationType==='IsPublishedIn' && i.relatedItemType==='Journal');
      const identifiers=arr(a.relatedIdentifiers).filter(r=>/^(IsPartOf|IsPublishedIn)$/.test(r.relationType)&&r.relatedIdentifierType==='ISSN').map(r=>r.relatedIdentifier);
      const serials=[...identifiers,a.container?.identifierType==='ISSN'?a.container.identifier:'',parent?.relatedItemIdentifier?.relatedItemIdentifierType==='ISSN'?parent.relatedItemIdentifier.relatedItemIdentifier:''];
      const explicitOpen=arr(a.rightsList).some(r=>/^(?:info:eu-repo\/semantics\/openAccess|https?:\/\/purl\.org\/coar\/access_right\/c_abf2)\/?$/i.test(r.rightsUri||r.rights||''));
      const candidate=arr(a.contentUrl).find(u=>Atlas.url(u)&&/\.pdf(?:$|[?#])/i.test(u));
      return record('DataCite',{title:arr(a.titles).find(t=>!t.titleType)?.title||a.titles?.[0]?.title,
        doi:a.doi,year:a.publicationYear,journal:parent?.titles?.[0]?.title||a.container?.title,
        authorList:arr(a.creators).map(c=>c.name||[c.familyName,c.givenName].filter(Boolean).join(', ')),issns:serials,
        openUrl:explicitOpen?candidate:'',accessSource:'DataCite · depositor-reported open access and linked PDF',
        publisherKnown:false,recordUrl:Atlas.url(a.url)||Atlas.doiLink(a.doi)});
    });
    return finish(items,ids,Boolean(data.links?.next) && rows.length>0 && page*size<10000);
  }
  return {PubMed:pubmed,'Semantic Scholar':semanticScholar,'USGS Publications Warehouse':usgs,'J-STAGE':jstage,DataCite:datacite};
})();
