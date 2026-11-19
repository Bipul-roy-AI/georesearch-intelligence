// Citation files contain descriptive metadata. An imported URL can identify a
// record without proving that it is the publisher's page or a free full text.
const SourceImport = (() => {
  'use strict';
  const str = value => typeof value === 'string' ? value.trim() : '';
  const list = v => Array.isArray(v) ? v : v == null ? [] : [v];
  const first = v => list(v).map(str).find(Boolean) || '';
  const year = v => Number(String(v ?? '').match(/(?:^|\D)((?:1[0-9]|20|21)\d{2})(?:\D|$)/)?.[1]) || 0;
  const uniq = values => [...new Set(values.filter(Boolean))];
  const safe = value => Atlas.url(str(value));

  function doiValue(value) {
    let v = str(value).replace(/^urn:doi:/i, '').replace(/^info:doi\//i, '');
    if (/^https?:\/\/(?:dx\.)?doi\.org\//i.test(v)) {
      try { v = decodeURIComponent(new URL(v).pathname.slice(1)); } catch { return ''; }
    }
    return Atlas.doi(v);
  }
  function extractDois(input) {
    // Lists may use whitespace or commas between identifiers. Preserve commas,
    // semicolons and balanced parentheses within DOI suffixes.
    const text = String(input || '')
      .replace(/(https?:\/\/(?:dx\.)?doi\.org\/10\.\d{4,9})%2f/gi,'$1/')
      .replace(/[,;](?=(?:\s*)(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*|10\.\d{4,9}\/))/gi,' ');
    const matches = text.match(/(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\/[^\s<>"\u201c\u201d]+/gi) || [];
    return uniq(matches.map(match => {
      let s = match.replace(/[.,;:\u2019]+$/g, '');
      for (const [open, close] of [['(',')'],['[',']'],['{','}']]) {
        let balance = [...s].reduce((v,c)=>v+(c===open?1:c===close?-1:0),0);
        while(balance<0 && s.endsWith(close)){s=s.slice(0,-1);balance++;}
      }
      return doiValue(s);
    }));
  }
  function namedPerson(person) {
    if (!person || typeof person !== 'object') return '';
    return str(person.literal) || str(person.name) ||
      [str(person.family || person.lastName),str(person.given || person.firstName)].filter(Boolean).join(', ');
  }
  function citation(raw, format, source) {
    const names = uniq(list(raw.authorList).map(str)), label=str(source), id=doiValue(raw.doi);
    return {
      title:str(raw.title), journal:str(raw.journal), year:year(raw.year), doi:id, issns:Atlas.issns(raw.issns),
      keywords:uniq(list(raw.keywords).map(str)),assignedSubjects:raw.assignedSubjects,
      authors:names.join('; '), authorList:names, sources:uniq([label,...list(raw.catalogues).map(str),'Imported '+format]),
      source:label || 'Imported '+format, publisherKnown:false, publisherUrl:'', openUrl:'', accessSource:'',
      recordUrl:safe(raw.recordUrl) || Atlas.doiLink(id)
    };
  }
  function collect(items, mapper) {
    const records=[]; let skipped=0;
    for(const item of items){const r=mapper(item); if(r?.title)records.push(r);else skipped++;}
    return {records,skipped};
  }
  function jsonRecords(text, source) {
    let root;
    try {root=JSON.parse(text);}catch{throw Error('Invalid citation JSON. Export journal articles as CSL JSON or Zotero JSON.');}
    const items=Array.isArray(root)?root:Array.isArray(root?.items)?root.items:root && (root.type||root.itemType||root.data?.itemType)?[root]:null;
    if(!items)throw Error('This JSON does not contain a CSL or Zotero citation list.');
    return collect(items, item=>{
      const r=item?.data?.itemType?item.data:item;
      if(r?.type==='article-journal')return citation({
        title:first(r.title),journal:first(r['container-title']) || first(r['container-title-short']),
        year:r.issued?.['date-parts']?.[0]?.[0] || r.issued?.literal || r.issued?.raw,
        keywords:list(r.keyword).flatMap(v=>str(v).split(/[;,]/)),authorList:list(r.author).map(namedPerson),doi:r.DOI,issns:r.ISSN,recordUrl:r.URL
      },'CSL JSON',source);
      if(r?.itemType==='journalArticle')return citation({
        title:r.title,journal:r.publicationTitle || r.journalAbbreviation,year:r.date,
        authorList:list(r.creators).filter(c=>c?.creatorType==='author').map(namedPerson),
        keywords:list(r.tags).map(v=>typeof v==='string'?v:v?.tag),doi:r.DOI,issns:r.ISSN,recordUrl:r.url,catalogues:r.libraryCatalog
      },'Zotero JSON',source);
      return null;
    });
  }
  function nbibRecords(text,source) {
    const blocks=[];let fields={},key='';
    function flush(){if(Object.keys(fields).length)blocks.push(fields);fields={};key='';}
    for(const line of text.split(/\r?\n/)){
      const m=line.match(/^([A-Z0-9]{2,4})\s*-\s?(.*)$/);
      if(m){if(m[1]==='PMID'&&fields.PMID)flush();key=m[1];(fields[key]??=[]).push(m[2].trim());}
      else if(/^\s{2,}\S/.test(line)&&key)fields[key][fields[key].length-1]+=' '+line.trim();
    }
    flush();
    return collect(blocks,r=>{
      const types=r.PT||[], journal=first(r.JT)||first(r.TA);
      if(!journal||types.some(t=>/preprint|book chapter|conference abstract/i.test(t))||
          !types.some(t=>/^(?:journal article|review|systematic review|meta-analysis|clinical trial(?:,.*)?|randomized controlled trial|case reports|comparative study|observational study|multicenter study|evaluation study)$/i.test(t)))return null;
      const ids=[...(r.AID||[]),...(r.LID||[])];
      const doi=ids.filter(v=>/\[doi\]$/i.test(v)).map(v=>doiValue(v.replace(/\s*\[doi\]$/i,''))).find(Boolean);
      const pmid=first(r.PMID);
      return citation({title:first(r.TI),journal,year:first(r.DP)||first(r.DEP),
        keywords:[...(r.OT||[]),...(r.MH||[])],authorList:[...(r.FAU||r.AU||[]),...(r.CN||[])],doi,issns:r.IS,
        recordUrl:/^\d+$/.test(pmid)?'https://pubmed.ncbi.nlm.nih.gov/'+pmid+'/':''
      },'PubMed NBIB',source);
    });
  }
  const children=(el,tag)=>Array.from(el?.children||[]).filter(child=>child.localName.toLowerCase()===tag.toLowerCase());
  const words=(el,tag)=>children(el,tag).map(n=>str(n.textContent)).filter(Boolean);
  const word=(el,tag)=>first(words(el,tag));
  function journalArticleType(t) {
    return /^(?:journal[- ]article|article[- ]journal|scholarly[- ]article|zeitschriftenaufsatz|info:eu-repo\/semantics\/article|https?:\/\/purl\.org\/coar\/resource_type\/c_6501\/?|https?:\/\/(?:www\.)?schema\.org\/scholarlyarticle\/?)$/i.test(t);
  }
  function excludedType(t) {return /preprint|working paper|conference|dataset|book chapter|dissertation|posted[- ]content|news[- ]item|^news$|^blog post$/i.test(t);}
  function oaiRecords(root,source) {
    const xmlError=children(root,'error')[0];
    if(xmlError)throw Error('OAI-PMH response: '+str(xmlError.textContent).slice(0,180));
    const container=children(root,'ListRecords')[0]||children(root,'GetRecord')[0];
    if(!container)throw Error('Use an OAI-PMH ListRecords or GetRecord XML response with oai_dc metadata.');
    const result=collect(children(container,'record'), record=>{
      const header=children(record,'header')[0];
      const metadata=children(record,'metadata')[0],dc=children(metadata,'dc')[0];
      if(header?.getAttribute('status')==='deleted'||!dc)return null;
      const types=words(dc,'type'),src=[...words(dc,'source'),...words(dc,'isPartOf')];
      if(types.some(excludedType))return null;
      const identifiers=words(dc,'identifier');
      const isoRelations=words(dc,'relation').filter(s=>/reference\/issn\/|^issn\s*:/i.test(s));
      const issns=Atlas.issns([...src,...isoRelations]);
      const outlet=src.find(s=>!safe(s)&&!/^urn:|^info:|^issn\b|\brepository\b|\barchive\b|^\d{4}-?\d{3}[\dX]\b/i.test(s));
      const typed=types.some(journalArticleType);
      // Generic "article" without a serial citation may be a deposited web item.
      if(!outlet||(!typed&&!(types.some(t=>/^article$/i.test(t))&&(issns.length||/\bvol(?:ume)?\.?\s*\d|\bissue\s*\d/i.test(outlet))))) return null;
      const doi=identifiers.map(doiValue).find(Boolean);
      return citation({title:word(dc,'title'),journal:outlet.split(/\s*;\s*|\s+\bvol(?:ume)?\.?\s+(?=\d)/i)[0],year:word(dc,'issued')||word(dc,'date'),
        keywords:words(dc,'subject'),authorList:words(dc,'creator'),issns,doi,recordUrl:identifiers.map(safe).find(Boolean)},'OAI-PMH',source);
    });
    if(word(container,'resumptionToken'))result.hasMore=true;
    return result;
  }
  function feedRecords(root,source) {
    const channel=children(root,'channel')[0]||root;
    const records=[...children(channel,'item'),...children(root,'entry'),...(root.localName.toLowerCase()==='rdf'?children(root,'item'):[])];
    return collect(records,entry=>{
      const atomLink=children(entry,'link').find(l=>!l.getAttribute('rel')||l.getAttribute('rel')==='alternate');
      const link=safe(atomLink?.getAttribute('href'))||safe(word(entry,'link'))||safe(word(entry,'url'));
      const types=[...words(entry,'type'),...words(entry,'genre'),...words(entry,'category'),
        ...children(entry,'category').map(e=>str(e.getAttribute('term')))];
      if(types.some(excludedType))return null;
      const doi=[...words(entry,'doi'),...words(entry,'identifier'),...words(entry,'guid'),...words(entry,'id'),link].map(doiValue).find(Boolean);
      const issns=Atlas.issns([...words(entry,'issn'),...words(entry,'eIssn'),...words(channel,'issn'),...words(channel,'eIssn')]);
      const serial=[...words(entry,'aggregationType'),...words(channel,'aggregationType')].some(s=>/^journal$/i.test(s));
      const type=types.some(journalArticleType)||(serial&&types.some(t=>/^(?:article|research(?: article)?|review(?: article)?)$/i.test(t)));
      const basedOn=children(entry,'source')[0];
      const sourceTitle=word(basedOn,'title') || (basedOn && !basedOn.children.length ? str(basedOn.textContent) : '');
      const journal=word(entry,'publicationName')||word(channel,'publicationName')||word(entry,'journalTitle')||
        (type && sourceTitle && !safe(sourceTitle) ? sourceTitle : '')||
        (type && (serial||issns.length) ? word(channel,'title') : '');
      // DOI + journal container provides a second path for PRISM feeds that
      // omit entry genre. An untyped DOI-less headline remains excluded.
      if(!journal||(!type&&!(doi&&(serial||issns.length||word(entry,'publicationName')))))return null;
      const authors=uniq([...words(entry,'creator'),...children(entry,'author').map(a=>word(a,'name')||str(a.textContent))]);
      return citation({title:word(entry,'title'),journal,issns,doi,keywords:[...words(entry,'subject'),...types],recordUrl:link,authorList:authors,
        year:word(entry,'publicationDate')||word(entry,'pubDate')||word(entry,'published')||word(entry,'date')
      },'publisher feed',source);
    });
  }
  function xmlRecords(text,source){
    if(/<!DOCTYPE\b|<!ENTITY\b/i.test(text))throw Error('Use an XML export without a document type or entity declaration.');
    const doc=new DOMParser().parseFromString(text,'application/xml');
    if(doc.getElementsByTagName('parsererror').length)throw Error('Invalid XML. Save the original feed or OAI-PMH XML response.');
    const root=doc.documentElement,tag=root.localName.toLowerCase();
    if(tag==='oai-pmh')return oaiRecords(root,source);
    if(['rss','rdf','feed'].includes(tag))return feedRecords(root,source);
    throw Error('Expected a publisher RSS/Atom feed or a Dublin Core OAI-PMH response.');
  }
  function parse(input,filename='',sourceLabel=''){
    const text=String(input||'').replace(/^\uFEFF/,'').trim(), name=String(filename||'').toLowerCase();
    if(!text)throw Error('The selected file is empty.');
    if(name.endsWith('.json')||/^[\[{]/.test(text))return jsonRecords(text,sourceLabel);
    if(text.startsWith('<')||/\.(xml|rss|atom)$/.test(name))return xmlRecords(text,sourceLabel);
    if(name.endsWith('.nbib')||/^PMID\s*-/m.test(text))return nbibRecords(text,sourceLabel);
    if(name.endsWith('.ris')||/^TY\s*-\s*\S/m.test(text)){
      const parsed=Atlas.readRIS(text);
      return {records:parsed.records.map(r=>citation(r,'RIS',sourceLabel)),skipped:parsed.skipped};
    }
    throw Error('Use RIS, CSL/Zotero JSON, PubMed NBIB, RSS/Atom XML, or OAI-PMH Dublin Core XML.');
  }
  return {parse,extractDois};
})();
