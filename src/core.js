const Atlas = (() => {
  function url(value) {
    try { const u=new URL(value); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  }
  function doi(value) {
    const id=String(value||'').trim().replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i,'').toLowerCase();
    return /^10\.\d{4,9}\/\S+$/.test(id) ? id : '';
  }
  function doiLink(id) { return doi(id) ? 'https://doi.org/'+doi(id).split('/').map(encodeURIComponent).join('/') : ''; }
  function issns(values) {return [...new Set((Array.isArray(values)?values.join(' '):String(values||'')).toUpperCase().match(/\b\d{4}-?\d{3}[\dX]\b/g)||[])].map(v=>v.replace('-','')).map(v=>v.slice(0,4)+'-'+v.slice(4));}
  function txt(value){return String(value||'').trim();}
  function norm(value){return txt(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
  function clean(r) {
    const id=doi(r.doi), ids=issns(r.issns), authors=txt(r.authors);
    return {...r,title:txt(r.title), doi:id, year:Number(r.year)||0, journal:txt(r.journal), authors, issns:ids,
      openUrl:url(r.openUrl), publisherUrl:url(r.publisherUrl)||(r.publisherKnown===false?'':doiLink(id)), recordUrl:url(r.recordUrl)||url(r.evidence),
      sources:[...new Set(r.sources||[r.source||'Imported RIS'])], accessSource:txt(r.accessSource)};
  }
  function fingerprint(r){return [norm(r.title),r.year,norm(r.journal)].join('|');}
  function key(r){return r.doi ? 'doi:'+r.doi : 'meta:'+fingerprint(r);}
  function mergeList(records) {
    const byDoi=new Map(),byMeta=new Map(),merged=[];
    for(const raw of records){
      const r=clean(raw); if(!r.title) continue;
      const fp=fingerprint(r), group=byMeta.get(fp)||[];
      let hit=r.doi?byDoi.get(r.doi):null;
      if(!hit && r.journal && r.year && group.length===1 && (!r.doi || !group[0].doi)) hit=group[0];
      if(!hit){merged.push(r);group.push(r);byMeta.set(fp,group);if(r.doi)byDoi.set(r.doi,r);continue;}
      hit.sources=[...new Set([...hit.sources,...r.sources])];hit.issns=[...new Set([...hit.issns,...r.issns])];
      if(!hit.openUrl && r.openUrl){hit.openUrl=r.openUrl;hit.accessSource=r.accessSource;}
      for(const field of ['doi','journal','year','authors','publisherUrl','recordUrl','topic','evidence']) if(!hit[field])hit[field]=r[field];
      if(!hit.authorList?.length&&r.authorList?.length)hit.authorList=r.authorList;
      if(hit.publisherUrl)hit.publisherKnown=true;
      if(hit.doi)byDoi.set(hit.doi,hit);
    }
    return merged;
  }
  function csvRows(text) {
    const data=text.replace(/^\uFEFF/,'');const head=data.split(/\r?\n/,1)[0], delimiter=head.includes(';')?';':',';
    let row=[],val='',quote=false; const rows=[];
    for(let i=0;i<data.length;i++){const c=data[i];
      if(c==='"'){ if(quote && data[i+1]==='"'){val+='"';i++;}else quote=!quote; }
      else if(c===delimiter&&!quote){row.push(val.trim());val='';}
      else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&data[i+1]==='\n')i++;row.push(val.trim());if(row.some(Boolean))rows.push(row);row=[];val='';}
      else val+=c;
    }
    if(quote) throw Error('The CSV has an unclosed quoted field.');
    row.push(val.trim());if(row.some(Boolean))rows.push(row);
    return rows;
  }
  function readRankCsv(text,edition) {
    const [headers,...rows]=csvRows(text); if(!headers)throw Error('The ranking file is empty.');
    const names=headers.map(h=>h.toLowerCase());const scimago=names.includes('sjr best quartile');
    const required=scimago?['issn','sjr best quartile']:['issn','year','system','category','quartile'];
    if(required.some(h=>!names.includes(h)))throw Error('Missing ranking columns. Use the CSV template or an original SCImago export.');
    if(scimago && !/^(19|20|21)\d{2}$/.test(edition))throw Error('Enter the year of the SCImago edition below the import button, then select the file again.');
    const ranks=[];let skipped=0;
    for(const row of rows){
      const get=k=>row[names.indexOf(k)]||'';const ids=issns(get('issn')), year=Number(scimago?edition:get('year'));
      if(!ids.length||year<1900||year>2199||!Number.isInteger(year)){skipped++;continue;}
      const add=(system,category,q,link)=>{const quartile=q.toUpperCase();if(system&&category&&/^Q[1-4]$/.test(quartile)){ranks.push({issns:ids,year,system,category,quartile,url:url(link)});return true;}return false;};
      const before=ranks.length;
      if(scimago){
        add('SJR','Best quartile (all categories)',get('sjr best quartile'),'');
        for(const cat of get('categories').split(';')){const parts=cat.trim().match(/^(.+)\s+\((Q[1-4])\)$/i);if(parts)add('SJR',parts[1],parts[2],'');}
      }else add(get('system'),get('category'),get('quartile'),get('url'));
      if(ranks.length===before)skipped++;
    }
    if(!ranks.length)throw Error('No usable ISSN, year and quartile combinations were found.');
    return {ranks,skipped};
  }
  function rankIndex(data){
    const idx=new Map();for(const entry of data)for(const id of issns(entry.issns)){
      if(!idx.has(id))idx.set(id,new Map());
      idx.get(id).set([entry.year,entry.system,entry.category].join('|'),entry);
    }
    return idx;
  }
  function rankMatches(r,idx,year,system,category){
    const entries=new Map();for(const id of r.issns)for(const [k,v] of (idx.get(id)||[]))if((!year||v.year===Number(year))&&(!system||v.system===system)&&(!category||v.category===category))entries.set(k,v);
    return [...entries.values()];
  }
  function readRIS(text){
    const records=[];let skipped=0,fields={},last='';
    function flush(){
      if(!fields.TY)return;
      const pick=(...ks)=>ks.map(k=>fields[k]?.[0]).find(Boolean)||'';
      const type=pick('TY'),title=pick('TI','T1'),id=doi(pick('DO'))||doi(pick('UR'));
      if(['JOUR','EJOUR'].includes(type)&&title){
        records.push(clean({title,doi:id,authors:(fields.AU||fields.A1||[]).join('; '),authorList:fields.AU||fields.A1||[],journal:pick('JO','JF','T2','JA'),year:parseInt(pick('PY','Y1','DA'),10),issns:fields.SN||[],source:'Imported RIS',recordUrl:pick('UR')}));
      }else skipped++;
      fields={};last='';
    }
    for(const line of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
      const m=line.match(/^([A-Z0-9]{2})\s{1,3}-\s?(.*)$/);
      if(m){if(m[1]==='ER'){flush();continue;} if(m[1]==='TY'&&fields.TY)flush();last=m[1];(fields[last]??=[]).push(m[2].trim());}
      else if(last&&line.trim())fields[last][fields[last].length-1]+=' '+line.trim();
    }flush();return {records,skipped};
  }
  function ris(records) {
    return records.map(r=>{
      const fields=[['TY','JOUR'],['TI',r.title],['JO',r.journal],['PY',r.year],['DO',r.doi],['UR',r.publisherUrl||r.recordUrl]];
      for(const id of r.issns) fields.push(['SN',id]);
      if(r.authorList?.length)for(const person of r.authorList)fields.push(['AU',person]);
      else if(r.authors)fields.push(['N1','Authors as displayed: '+r.authors]);
      if(r.openUrl)fields.push(['L2',r.openUrl]);
      fields.push(['N1','Sources: '+r.sources.join(', ')]);
      return fields.filter(f=>f[1]).map(([k,v])=>k+'  - '+String(v).replace(/[\r\n]+/g,' ')).join('\r\n')+'\r\nER  - \r\n';
    }).join('\r\n');
  }
  return {url,doi,doiLink,issns,norm,clean,key,mergeList,rankIndex,rankMatches,readRankCsv,readRIS,ris};
})();
