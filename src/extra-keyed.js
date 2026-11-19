// The local service adds credentials on the provider request. This file contains no keys.
const keyedAdapters = (() => {
  'use strict';
  const size = 20;
  const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
  const str = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  const quoted = value => '"' + value.replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"';
  function identify(q) {
    const term = String(q).trim();
    return {term, doi:Atlas.doi(term), issn:/^(?:issn\s*:?\s*)?\d{4}-?\d{3}[\dx]$/i.test(term) ? Atlas.issns(term)[0] : ''};
  }
  async function get(url,params,signal) {
    const target = new URL(url);
    for (const [k,v] of Object.entries(params)) target.searchParams.set(k,String(v));
    const response = await atlasFetch(target.href,signal);
    if (!response.ok) {
      if ([401,403].includes(response.status)) throw Error('Provider denied access. Check the server credential and subscription permissions.');
      if (response.status===429) throw Error('Provider rate limit reached. Retry later.');
      throw Error('Provider returned HTTP '+response.status+'.');
    }
    return response.json();
  }
  function hits(rows,total,page,id,source,convert,limit=size) {
    if (!Array.isArray(rows)) throw Error('Unexpected '+source+' response format.');
    const items=[];
    for (const row of rows) {
      const r=convert(row);
      if (!r || !r.title || !r.journal) continue;
      r.doi=Atlas.doi(r.doi); r.issns=Atlas.issns(r.issns);
      if ((id.doi && id.doi!==r.doi) || (id.issn && !r.issns.includes(id.issn))) continue;
      r.source=r.source||source;
      r.authorList=list(r.authorList).map(str).filter(Boolean);
      r.authors=r.authors||r.authorList.join('; ');
      items.push(r);
    }
    return {items,more:!id.doi && rows.length===limit && (Number.isFinite(Number(total)) ? page*limit<Number(total) : true)};
  }
  async function ads(q,page,signal) {
    const id=identify(q);
    const query=id.doi?'doi:'+quoted(id.doi):id.issn?'issn:'+quoted(id.issn):id.term;
    const data=await get('https://api.adsabs.harvard.edu/v1/search/query',{
      q:query,fq:'doctype:article',fl:'bibcode,title,author,pub,year,doi,issn,doctype,property',
      rows:size,start:(page-1)*size
    },signal);
    return hits(data.response?.docs,data.response?.numFound,page,id,'NASA SciX / ADS',row=>{
      if (row.doctype!=='article') return;
      const doi=list(row.doi).map(Atlas.doi).find(d=>id.doi?d===id.doi:!!d);
      const publisher=Atlas.doiLink(doi);
      const publisherOpen=list(row.property).some(p=>/^pub_?openaccess$/i.test(p));
      return {title:str(list(row.title)[0]),journal:str(row.pub),year:row.year,doi,issns:row.issn,
        authorList:row.author,publisherUrl:publisher,
        recordUrl:row.bibcode?'https://scixplorer.org/abs/'+encodeURIComponent(row.bibcode)+'/abstract':'',
        openUrl:publisherOpen?publisher:'',accessSource:publisherOpen?'NASA SciX · publisher marks article open':''};
    });
  }
  async function ieee(q,page,signal) {
    const id=identify(q);
    const params=id.doi?{doi:id.doi}:id.issn?{issn:id.issn}:{querytext:id.term};
    const data=await get('https://ieeexploreapi.ieee.org/api/v1/search/articles',{
      ...params,content_type:'Journals',format:'json',max_records:size,start_record:(page-1)*size+1
    },signal);
    const rows=data.articles ?? (Number(data.total_records ?? data.totalfound)===0?[]:undefined);
    return hits(rows,data.total_records??data.totalfound,page,id,'IEEE Xplore',row=>{
      if (!/^journals?$/i.test(str(row.content_type))) return;
      const pageUrl=Atlas.url(row.abstract_url)||(/^\d+$/.test(str(row.article_number))?'https://ieeexplore.ieee.org/document/'+row.article_number:'')||Atlas.doiLink(row.doi);
      const free=/^(open[ _]access|ephemera)$/i.test(str(row.accessType));
      return {title:str(row.title),journal:str(row.publication_title),year:row.publication_year,doi:row.doi,
        issns:[row.issn,row.eissn],authorList:list(row.authors?.authors ?? row.authors).map(a=>a.full_name||a.name),
        publisherUrl:pageUrl,recordUrl:pageUrl,openUrl:free?(Atlas.url(row.html_url)||pageUrl):'',
        accessSource:free?'IEEE Xplore · '+row.accessType:''};
    });
  }
  async function scopus(q,page,signal) {
    const id=identify(q);
    const terms=id.doi?'DOI('+quoted(id.doi)+')':id.issn?'ISSN('+id.issn.replace('-','')+')':'TITLE-ABS-KEY('+id.term+')';
    const data=await get('https://api.elsevier.com/content/search/scopus',{
      query:terms+' AND SRCTYPE(j) AND (DOCTYPE(ar) OR DOCTYPE(re))',
      view:'STANDARD',count:size,start:(page-1)*size
    },signal);
    const res=data['search-results'];
    return hits(res?.entry ?? (Number(res?.['opensearch:totalResults'])===0?[]:undefined),res?.['opensearch:totalResults'],page,id,'Scopus',row=>{
      if (!/^journal$/i.test(str(row['prism:aggregationType'])) || !['ar','re'].includes(str(row.subtype))) return;
      const providerRecord=list(row.link).find(l=>l['@ref']==='scopus')?.['@href'];
      return {title:str(row['dc:title']),journal:str(row['prism:publicationName']),year:str(row['prism:coverDate']).slice(0,4),
        doi:row['prism:doi'],issns:[row['prism:issn'],row['prism:eIssn']],authors:row['dc:creator'] ? str(row['dc:creator'])+' (first listed)' : '',
        recordUrl:providerRecord};
    });
  }
  async function wos(q,page,signal) {
    const id=identify(q);
    const terms=id.doi?'DO='+quoted(id.doi):id.issn?'IS='+id.issn:'TS=('+id.term+')';
    const data=await get('https://api.clarivate.com/apis/wos-starter/v1/documents',{
      db:'WOS',q:'('+terms+') AND (DT=Article OR DT=Review)',limit:size,page
    },signal);
    return hits(data.hits ?? (Number(data.metadata?.total)===0?[]:undefined),data.metadata?.total,page,id,'Web of Science Core Collection',row=>{
      const types=[...list(row.sourceTypes),...list(row.types)];
      if (!types.some(t=>/^(article|review)$/i.test(t)) || types.some(t=>/book|proceedings|conference/i.test(t))) return;
      return {title:str(row.title),journal:str(row.source?.sourceTitle),year:row.source?.publishYear,
        doi:row.identifiers?.doi,issns:[row.identifiers?.issn,row.identifiers?.eissn,row.identifiers?.eIssn],
        authorList:list(row.names?.authors).map(a=>a.displayName||a.wosStandard),recordUrl:row.links?.record};
    });
  }
  async function core(q,page,signal) {
    const id=identify(q);
    if (id.issn) throw Error('CORE journal-ISSN filtering is unavailable. Use a topic or DOI.');
    const data=await get('https://api.core.ac.uk/v3/search/works/',{
      q:id.doi?'doi:'+quoted(id.doi):id.term,limit:size,offset:(page-1)*size
    },signal);
    return hits(data.results,data.totalHits,page,id,'CORE',row=>{
      const journal=list(row.journals).find(j=>str(j?.title)||str(j?.name));
      if (!journal) return;
      const kind=list(row.documentType?.type ?? row.documentType).map(str).join(' ');
      if (/conference|thesis|dissertation|book|preprint|working paper|dataset|software/i.test(kind)) return;
      const doi=Atlas.doi(row.doi);
      const title=str(row.title);
      // CORE merges repositories and versions. A CORE download may be a submitted manuscript;
      // use a marked published/accepted copy only. DOI resolution by the merged indexes can find more.
      const version=str(row.version);
      const candidate=Atlas.url(row.downloadUrl);
      const trusted=/^(?:publishedVersion|acceptedVersion|version of record|accepted manuscript|published version|accepted version)$/i.test(version);
      const recordUrl=/^\d+$/.test(str(row.id))?'https://core.ac.uk/works/'+row.id:'';
      return {title,doi,journal:str(journal.title||journal.name),year:row.yearPublished,
        issns:list(journal.identifiers).map(i=>str(i)||str(i?.identifier)||str(i?.id)),authorList:list(row.authors).map(a=>a?.name||str(a)),
        publisherKnown:false,recordUrl,openUrl:trusted?candidate:'',accessSource:trusted&&candidate?'CORE · '+version:''};
    });
  }
  async function engineering(db,name,q,page,signal) {
    const id=identify(q);
    const term=id.doi?'('+id.doi+' WN DOI)':id.issn?'('+id.issn+' WN SN)':'('+id.term+')';
    const data=await get('https://api.elsevier.com/content/ev/results',{
      database:db,query:term+' AND ({ja} WN DT)',pageSize:size,offset:(page-1)*size
    },signal);
    const result=data.PAGE;
    if (!result || !Number.isFinite(Number(result['RESULTS-COUNT']))) throw Error('Unexpected Engineering Village response format.');
    const rows=list(result['PAGE-RESULTS']?.['PAGE-ENTRY']);
    return hits(rows,result['RESULTS-COUNT'],page,id,name,row=>{
      const doc=row['EI-DOCUMENT'];
      const props=doc?.DOCUMENTPROPERTIES;
      if (!props || !/\bjournal article\b|\(JA\)|^JA$/i.test(str(props.DT))) return;
      const authors=list(doc.AUS?.AU).map(a=>a?.NAME||str(a));
      return {title:str(props.TI),journal:str(props.SO),year:props.YR,doi:props.DO,
        issns:[props.SN,props.E_ISSN],authorList:authors,source:name+' (Engineering Village)'};
    });
  }
  return {'NASA SciX / ADS':ads,'IEEE Xplore':ieee,'CORE':core,'Scopus':scopus,'Web of Science Core Collection':wos,
    'GEOBASE':(q,p,s)=>engineering('g','GEOBASE',q,p,s),'GeoRef':(q,p,s)=>engineering('f','GeoRef',q,p,s)};
})();
