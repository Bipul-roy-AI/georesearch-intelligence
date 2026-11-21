(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const node=(tag,content,cls)=>{const el=document.createElement(tag);if(content!==undefined)el.textContent=content;if(cls)el.className=cls;return el;};
  const button=(label,fn,cls)=>{const b=node('button',label,cls);b.type='button';b.addEventListener('click',fn);return b;};
  function link(label,target){const a=node('a',label);a.href=Atlas.url(target);a.target='_blank';a.rel='noopener noreferrer';return a;}
  function load(name,fallback){try{const x=JSON.parse(localStorage.getItem('fieldatlas.v1.'+name));return Array.isArray(x)?x:fallback;}catch{return fallback;}}
  function store(name,data){try{localStorage.setItem('fieldatlas.v1.'+name,JSON.stringify(data));return true;}catch{return false;}}
  const seed=Atlas.mergeList(starterPapers),sources=Object.keys(adapters);
  const defaults=sources.filter(s=>enabledSource(s)&&!Object.hasOwn(publisherAdapters,s)&&!['J-STAGE','Undermind','Article Galaxy'].includes(s));
  let selected=load('selectedSourcesV2',defaults).filter(s=>sources.includes(s)&&enabledSource(s)), saved=Atlas.mergeList(load('saved',[]));
  let importedRanks=load('ranks',[]),ranks=[...builtinRanks,...importedRanks],index=Atlas.rankIndex(ranks);
  let view='explore',query='',run=0,controller=null,batchBusy=false,results=seed,states={},statusNote='',visible=[],shown=25;
  let displayedQuery='',sourceRuns=[],knownCopies=new Map(),retryAfter=new Map();
  let filterSubjects=[], editingPaper=null, editedSubjects=null;
  const selections={access:'',quartile:'',journal:'',fromYear:'',toYear:'',sort:'relevance'};
  function note(text){$('settingsMessage').textContent=text;$('settingsMessage').hidden=!text;}
  function dl(name,text,type){const u=URL.createObjectURL(new Blob([text],{type}));const a=node('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000);}
  function opts(id,values,any,preferred){
    const el=$(id), chosen=preferred??el.value;el.replaceChildren();if(any)el.add(new Option(any,''));
    for(const v of values)el.add(new Option(v,v));if([...el.options].some(o=>o.value===String(chosen)))el.value=chosen;
  }
  function rankMenus(chooseYear){
    opts('rankYear',[...new Set(ranks.map(r=>r.year))].sort((a,b)=>b-a),null,chooseYear);
    const edition=ranks.filter(r=>r.year===Number($('rankYear').value));
    opts('rankSystem',[...new Set(edition.map(r=>r.system))].sort(),'All systems');
    opts('category',[...new Set(edition.filter(r=>!$('rankSystem').value||r.system===$('rankSystem').value).map(r=>r.category))].sort(),'All categories');
    $('rankDetail').textContent='Includes selected SCImago category rankings for 2024 and 2025. Import a broader edition to match more journals by ISSN. Journals without a match show Unknown.';
  }
  function ranksFor(record){return Atlas.rankMatches(record,index,$('rankYear').value,$('rankSystem').value,$('category').value);}
  function matchLocal(record,q){
    const id=Atlas.doi(q);if(id)return record.doi===id;
    const serial=Atlas.issns(q);if(serial.length===1&&record.issns.includes(serial[0]))return true;
    const labels=[...PaperSubjects.expanded(PaperSubjects.effective(record))].map(id=>PaperSubjects.topics.get(id).label);
    const terms=Atlas.norm(q).split(' ').filter(Boolean),text=Atlas.norm([record.title,record.journal,record.topic,record.authors,...labels,...record.keywords].join(' '));
    return terms.length>0&&terms.every(t=>text.includes(t));
  }
  function recalc(){
    if(!displayedQuery){results=seed;return;}
    const local=[...seed,...saved].filter(r=>matchLocal(r,displayedQuery)),pool=[],longest=Math.max(0,...sourceRuns.map(s=>states[s]?.items.length||0));
    for(let i=0;i<longest;i++)for(const s of sourceRuns){const item=states[s]?.items[i];if(item)pool.push(item);}
    results=Atlas.mergeList([...pool,...local]);
    for(const r of results){const copy=knownCopies.get(r.doi);if(copy&&!r.openUrl)Object.assign(r,copy);}
  }
  function activeRecords(){return view==='saved'?saved:results;}
  function subjectMenu(id, hint, includeUnknown) {
    const select=$(id);
    select.add(new Option(hint,''));
    for(const group of PaperSubjects.groups){
      const list=node('optgroup');list.label=group.label;
      list.append(new Option('All '+group.label,group.id));
      for(const topic of group.children)list.append(new Option(topic.label,topic.id));
      select.append(list);
    }
    if(includeUnknown)select.add(new Option('Unclassified papers','unclassified'));
  }
  function drawSubjectFilters(){
    const box=$('subjectChips');box.replaceChildren();
    for(const id of filterSubjects){
      const label=PaperSubjects.topics.get(id)?.label||'Unclassified papers';
      const remove=button(label+' ×',()=>{filterSubjects=filterSubjects.filter(x=>x!==id);drawSubjectFilters();shown=25;render();},'subjectChip');
      remove.setAttribute('aria-label','Remove '+label+' filter');box.append(remove);
    }
    $('subjectModeBox').hidden=filterSubjects.length<2;
  }
  function drawEditor(){
    const box=$('editGroups');box.replaceChildren();
    const chosen=new Set(editedSubjects??PaperSubjects.compact(editingPaper.inferredSubjects));
    const checks=[];
    for(const group of PaperSubjects.groups){
      const field=node('fieldset');field.append(node('legend',group.label));
      for(const topic of [group,...group.children]){
        const label=node('label'),check=node('input');check.type='checkbox';check.checked=chosen.has(topic.id);
        checks.push({id:topic.id,check});
        check.onchange=()=>{
          if(check.checked)chosen.add(topic.id);else chosen.delete(topic.id);
          editedSubjects=[...chosen];
          for(const other of checks)if(other.id===topic.id)other.check.checked=check.checked;
        };
        label.append(check,document.createTextNode(topic===group?'General '+group.label:topic.label));field.append(label);
      }
      box.append(field);
    }
  }
  function editSubjects(record){
    editingPaper=record;editedSubjects=record.assignedSubjects===null?null:[...record.assignedSubjects];
    $('editTitle').textContent=record.title;drawEditor();$('subjectDialog').showModal();
  }
  function summary(){const total=activeRecords().length;return visible.length===total?total+' unique '+(total===1?'paper':'papers'):visible.length+' of '+total+' unique papers';}
  function searchState(){
    const e=$('runstate');e.replaceChildren();
    if(view!=='explore'||!displayedQuery)return;
    const done=sourceRuns.filter(s=>states[s].ok).length,errors=sourceRuns.filter(s=>states[s].error).length;
    const info=node('details',undefined,'statusBox');
    const label=batchBusy?'Searching indexes…':done===0?'No live matches retrieved':done+' of '+sourceRuns.length+' indexes returned a response';
    info.append(node('summary',label+(errors?' · '+errors+' source '+(errors===1?'issue':'issues'):'')+' · Source details'));
    const list=node('ul');for(const name of sourceRuns){
      const p=states[name];list.append(node('li',name+' — '+(p.waiting?'searching':p.skip?p.skip:p.error?p.error+(p.items.length?' · '+p.items.length+' retained':''):p.items.length+' article records loaded')));
    } info.append(list);
    const n=Atlas.mergeList([...seed,...saved].filter(r=>matchLocal(r,displayedQuery))).length;
    if(n)info.append(node('p',n+' matching local '+(n===1?'reference is':'references are')+' included. Each record lists its sources.'));
    e.append(info);
  }
  function textRank(r,matched){
    if(!matched.length)return 'Quartile unknown';
    const q=$('quartile').value;
    const subset=q&&q!=='unknown'?matched.filter(a=>a.quartile===q):matched;
    const codes=[...new Set(subset.map(a=>a.quartile))].sort().join(' / '),systems=[...new Set(subset.map(a=>a.system))].join(' / ');
    return codes+' · '+systems+' '+$('rankYear').value;
  }
  function card(r){
    const area=node('article',undefined,'card'),top=node('div',undefined,'cardTop'),header=node('div');
    header.append(node('span',r.journal||'Journal title unavailable','journal'),node('span',r.year?'  ·  '+r.year:'','year'));
    const isSaved=saved.some(v=>Atlas.key(v)===Atlas.key(r));
    const star=button(isSaved?'✓ Saved':'+ Save',()=>{
      saved=isSaved?saved.filter(v=>Atlas.key(v)!==Atlas.key(r)):Atlas.mergeList([...saved,r]);
      if(!store('saved',saved))statusNote='Saved for this tab. Browser storage is unavailable.';
      if(isSaved)recalc();
      render();
    },'save');star.setAttribute('aria-pressed',String(isSaved));star.setAttribute('aria-label',(isSaved?'Remove from saved: ':'Save paper: ')+r.title);
    top.append(header,star);area.append(top,node('h3',r.title));
    if(r.authors)area.append(node('p',r.authors.length>240?r.authors.slice(0,237)+'…':r.authors,'authors'));
    const tags=node('div',undefined,'tags'),matched=ranksFor(r);
    tags.append(node('span',r.openUrl?'Free full text':'No free link located','tag'+(r.openUrl?' open':'')),node('span',textRank(r,matched),'tag'+(matched.length?' rank':'')));
    const subjectIds=PaperSubjects.compact(PaperSubjects.effective(r));
    for(const id of subjectIds)tags.append(node('span',PaperSubjects.topics.get(id).label,'tag subjectTag'));
    if(!subjectIds.length)tags.append(node('span','Unclassified','tag'));
    area.append(tags);
    const bottom=node('div',undefined,'cardBottom'),links=node('div',undefined,'cardLinks');
    if(r.openUrl)links.append(link('Read free full text',r.openUrl));
    if(r.publisherUrl)links.append(link('Publisher page',r.publisherUrl));else if(r.recordUrl)links.append(link('Index record',r.recordUrl));
    if(!r.openUrl&&r.doi)links.append(button('Check for a free copy',async ev=>{
      if(!$('contact').value.trim()||!$('contact').checkValidity()){switchTab('sources');note('Enter your contact email to check Unpaywall. Then return to this paper in Explore or Saved.');$('contact').focus();return;}
      const b=ev.currentTarget;b.disabled=true;b.textContent='Checking…';
      try{
        const url=new URL('https://api.unpaywall.org/v2/'+r.doi.split('/').map(encodeURIComponent).join('/'));url.searchParams.set('email',$('contact').value.trim());
        const res=await atlasFetch(url,AbortSignal.timeout(20000));if(!res.ok&&res.status!==404)throw Error('Service returned '+res.status);
        const data=res.ok?await res.json():null;const loc=[data?.best_oa_location,...(data?.oa_locations||[])].find(l=>l&&data?.is_oa===true&&l.version!=='submittedVersion'&&(l.host_type==='publisher'||['publishedVersion','acceptedVersion'].includes(l.version))&&Atlas.url(l.url_for_landing_page||l.url||l.url_for_pdf));
        if(!loc){b.textContent='No free copy located by Unpaywall';return;}
        const copy={openUrl:Atlas.url(loc.url_for_landing_page||loc.url||loc.url_for_pdf),accessSource:'Unpaywall · '+[loc.host_type,loc.version].filter(Boolean).join(' · ')};
        knownCopies.set(r.doi,copy);for(const row of [...results,...saved,...seed])if(row.doi===r.doi)Object.assign(row,copy);store('saved',saved);render();
      }catch{b.textContent='Check unavailable · retry';b.disabled=false;}
    }));
    const d=node('details');d.append(node('summary','Sources and ranking evidence'));
    d.append(node('p','Indexed or supplied by '+r.sources.join(', ')+'.'+(r.openUrl?' Free-copy evidence: '+(r.accessSource||'reported by source')+'.':' No article-level free location is recorded here.'),'provenance'));
    if(r.doi){const p=node('p','DOI  ','provenance');p.append(link(r.doi,Atlas.doiLink(r.doi)));d.append(p);}
    if(r.issns.length)d.append(node('p','Journal ISSN  '+r.issns.join(', '),'provenance'));
    if(r.recordUrl){const p=node('p',undefined,'provenance');p.append(link('Source record',r.recordUrl));d.append(p);}
    for(const m of matched){const p=node('p',m.system+' '+m.year+' · '+m.category+' · '+m.quartile+'  ','provenance');if(Atlas.url(m.url))p.append(link('Ranking source',m.url));d.append(p);}
    if(!matched.length)d.append(node('p','No matching ranking in the selected edition, system and category.','provenance'));
    links.append(button('Edit subjects',()=>editSubjects(r),'textBtn'));
    d.append(node('p',r.assignedSubjects===null?'Subject labels are suggested from the title and available topic metadata.':'Subject labels were selected manually.','provenance'));
    bottom.append(links,d);area.append(bottom);return area;
  }
  function render(){
    $('savedCount').textContent=saved.length;$('discovery').hidden=view!=='explore';$('sourceView').hidden=view!=='sources';
    $('dashboardView').hidden=view!=='dashboards';$('resultView').hidden=view==='sources'||view==='dashboards';
    $('resultView').classList.toggle('savedHead',view==='saved');
    for(const el of document.querySelectorAll('nav [data-tab]')){if(el.dataset.tab===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');}
    if(view==='sources'||view==='dashboards')return;
    $('resultKicker').textContent=view==='saved'?'YOUR READING LIST':displayedQuery?'INDEX SEARCH':'CURATED REFERENCES';
    $('resultsTitle').textContent=view==='saved'?'Saved papers':displayedQuery?'Results for “'+displayedQuery+'”':'Starter collection';
    const low=Number($('fromYear').value)||0,high=Number($('toYear').value)||Infinity,access=$('access').value,q=$('quartile').value,j=Atlas.norm($('journal').value);
    const savedByKey=new Map(saved.map(r=>[Atlas.key(r),r]));
    visible=activeRecords().map(r=>{
      const same=savedByKey.get(Atlas.key(r));
      return same&&same!==r?{...r,inferredSubjects:PaperSubjects.valid([...r.inferredSubjects,...same.inferredSubjects]),assignedSubjects:same.assignedSubjects}:r;
    }).filter(r=>{
      if(!PaperSubjects.matches(PaperSubjects.effective(r),filterSubjects,$('subjectMode').value))return false;
      if((low||Number.isFinite(high))&&(!r.year||r.year<low||r.year>high))return false;
      if(!Atlas.norm(r.journal).includes(j)||(access==='open'&&!r.openUrl)||(access==='unknown'&&r.openUrl))return false;
      const needsRank=q||$('category').value||$('rankSystem').value;
      if(!needsRank)return true;const matches=ranksFor(r);return q==='unknown'?!matches.length:q?matches.some(a=>a.quartile===q):matches.length>0;
    });
    if($('sort').value!=='relevance'){const sign=$('sort').value==='old'?1:-1;visible.sort((a,b)=>!a.year?1:!b.year?-1:(a.year-b.year)*sign);}
    $('summary').textContent=summary()+(statusNote?' · '+statusNote:'');searchState();
    const target=$('papers');target.replaceChildren();const frag=document.createDocumentFragment();
    for(const r of visible.slice(0,shown))frag.append(card(r));target.append(frag);
    if(!visible.length){
      let msg='Try another query or reset the filters.';
      if(low>high)msg='The starting publication year must be earlier than or equal to the ending year.';
      else if(view==='saved'&&!saved.length)msg='Save papers from Explore or import journal citations from Sources.';
      else if(displayedQuery&&!results.length)msg=batchBusy?'Waiting for the selected indexes.':sourceRuns.every(s=>states[s].error)?'The live indexes did not return usable responses. Open Source details to see the errors or try a specialist database in Sources.':'Try a broader topic, an alternative spelling, or another source.';
      const z=node('div',undefined,'empty');z.append(node('h3',batchBusy?'Searching…':'No papers to display'),node('p',msg));target.append(z);
    }
    if(visible.length>shown)target.append(button('Show more loaded papers',()=>{shown+=25;render();},'outline'));
    $('more').hidden=view!=='explore'||!displayedQuery||!sourceRuns.some(s=>states[s].more||states[s].error);
    $('more').disabled=batchBusy;$('more').textContent=sourceRuns.some(s=>states[s]?.error)?'Load more / retry sources':'Load more from indexes';
    $('starter').hidden=view!=='explore'||!displayedQuery;$('extendSearch').hidden=$('starter').hidden;$('export').disabled=!visible.length;
  }
  function switchTab(t){view=['explore','sources','dashboards','saved'].includes(t)?t:'explore';history.replaceState(null,'','#'+view);shown=25;render();window.scrollTo(0,0);}
  function updateSourceControls(){const root=$('providerToggles');root.replaceChildren();
    $('runtimeNote').textContent=(atlasRuntime.server?'Server mode. ':'Browser mode. ')+sources.filter(enabledSource).length+' of '+sources.length+' search integrations are available with this configuration. Enable the sources to include in your next search. Provider quotas and coverage apply.';
    const saveSelection=names=>{selected=[...new Set(names)].filter(enabledSource);store('selectedSourcesV2',selected);updateSourceControls();note('Index selection applies to your next search.');};
    const all=button('Include publisher collections',()=>saveSelection([...selected,...Object.keys(publisherAdapters)]),'textBtn');
    root.append(all,document.createTextNode(' · '),button('Restore defaults',()=>saveSelection(defaults),'textBtn'));
    for(const [title,names] of [['Available',sources.filter(s=>enabledSource(s)&&!Object.hasOwn(publisherAdapters,s))],['Publisher DOI subsets',Object.keys(publisherAdapters)],['Requires configuration',sources.filter(s=>!enabledSource(s))]]){
      if(!names.length)continue;root.append(node('h3',title,'controlSub'));
      for(const s of names){const l=node('label',undefined,'toggle'),c=node('input');c.type='checkbox';c.checked=selected.includes(s);c.disabled=!enabledSource(s);c.onchange=()=>{selected=sources.filter(name=>name===s?c.checked:selected.includes(name));store('selectedSourcesV2',selected);note('Index selection applies to your next search.');};l.append(c,document.createTextNode(s));root.append(l);}
    }
  }
  function importFrom(name){$('importSource').value=name;$('importPanel').scrollIntoView({block:'center'});$('importSource').focus();}
  async function copy(text){try{await navigator.clipboard.writeText(text);$('sourceInfo').textContent='Copied to clipboard.';}catch{window.prompt('Copy this text',text);}}
  function drawDirectory(){const root=$('directory');root.replaceChildren();for(const group of [...new Set(sourceDirectory.map(s=>s.group))]){
    if($('dirFilter').value&&$('dirFilter').value!==group)continue;root.append(node('h3',group,'groupTitle'));const grid=node('div',undefined,'sourceGrid');
    const q=$('sourceQuery').value.trim();
    for(const s of sourceDirectory.filter(s=>s.group===group)){const c=node('article',undefined,'sourceCard'),route=sourceRoute(s),controls=node('div',undefined,'sourceActions');
      c.append(node('h3',s.name),node('span',sourceMode(s),'tag'),node('p',viewNotes[s.name]||route.note||s.detail,'directoryText'));
      if(viewNotes[s.name]&&route.note)c.append(node('p',route.note,'directoryText'));
      controls.append(link(q&&route.url?.includes('{q}')?'Search this query':'Open source',portalURL(s,q)));
      if(q&&!route.url?.includes('{q}'))controls.append(button('Copy query',()=>copy(q),'textBtn'));
      if(['Research tools'].includes(s.group)&&q)controls.append(button('Copy research prompt',()=>copy(citationPrompt(s.name,q)),'textBtn'));
      if(s.name==='n8n')controls.append(button('Download workflow',()=>dl('Field_Atlas_n8n.json',JSON.stringify(makeWorkflow(q||'geospatial public health'),null,2),'application/json'),'textBtn'));
      else if(['Clarivate Journal Citation Reports','SCImago Journal & Country Rank'].includes(s.name))controls.append(button('Import rankings',()=>$('rankfile').click(),'textBtn'));
      else if(s.name==='Unpaywall')controls.append(button('Set contact email',()=>$('contact').focus(),'textBtn'));
      else controls.append(button('Import from this source',()=>importFrom(s.name),'textBtn'));
      c.append(controls);grid.append(c);
    }root.append(grid);
  }}
  function clearSearch(){controller?.abort();run++;query='';displayedQuery='';batchBusy=false;sourceRuns=[];states={};results=seed;statusNote='';shown=25;$('query').value='';render();}
  async function getBatch(fresh){
    if(fresh){
      const q=$('query').value.trim();if(!q)return;
      if(!selected.length){switchTab('sources');note('Select at least one live index, then return to Explore.');return;}
      controller?.abort();controller=new AbortController();run++;query=q;displayedQuery=q;$('sourceQuery').value=q;drawDirectory();sourceRuns=[...selected];states={};shown=25;statusNote='';
      for(const s of sourceRuns)states[s]={items:[],next:1,more:true,error:'',ok:false};
    }else if(batchBusy)return;
    const generation=run,searchTerm=query, signal=controller.signal;
    const todo=sourceRuns.filter(s=>states[s].more||states[s].error);
    batchBusy=true;
    for(const s of todo){states[s].waiting=true;}
    recalc();render();
    await Promise.all(todo.map(async s=>{
      const sourceState=states[s], cancel=new AbortController(), abort=()=>cancel.abort();
      signal.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(abort,['Article Galaxy','Undermind'].includes(s)?65000:40000);
      try{
        const wait=retryAfter.get(s)||0;if(Date.now()<wait)throw Error('Rate limit. Retry after '+new Date(wait).toLocaleTimeString()+'.');
        const result=await adapters[s](searchTerm,sourceState.next,cancel.signal);if(run!==generation)return;
        const exact=Atlas.doi(searchTerm),items=exact?result.items.filter(r=>Atlas.doi(r.doi)===exact):result.items;
        sourceState.items.push(...items);sourceState.more=!exact&&result.more;sourceState.next++;sourceState.ok=true;sourceState.error='';
      }catch(error){
        if(run!==generation)return;
        const msg=String(error.message||'');
        if(/rate limit/i.test(msg)&&(retryAfter.get(s)||0)<=Date.now())retryAfter.set(s,Date.now()+60000);
        sourceState.error=cancel.signal.aborted?'Request timed out.':/fetch|network|load failed/i.test(msg)?'Provider unreachable from this browser.':msg;
        if(/no documented journal ISSN/i.test(msg)){sourceState.more=false;sourceState.error='';sourceState.ok=false;sourceState.skip=msg;}
      }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);sourceState.waiting=false;if(run===generation){recalc();render();}}
    }));
    if(run===generation){batchBusy=false;render();}
  }
  function terrain(){
    const c=$('terrain'),box=c.parentElement.getBoundingClientRect();if(!box.width||!box.height)return;const scale=Math.min(2,window.devicePixelRatio||1);
    c.width=box.width*scale;c.height=box.height*scale;const g=c.getContext('2d');if(!g)return;g.scale(scale,scale);const w=box.width,h=box.height;
    const wash=g.createLinearGradient(0,0,w,0);wash.addColorStop(0,'#103b3a');wash.addColorStop(.57,'#154641');wash.addColorStop(1,'#275c50');g.fillStyle=wash;g.fillRect(0,0,w,h);
    g.save();g.translate(w*.86,h*.46);g.rotate(-.34);
    for(let i=0;i<64;i++){const rad=14+i*6;g.beginPath();for(let j=0;j<=320;j++){
      const a=Math.PI*2*j/320,wiggle=1+.14*Math.sin(3*a+rad*.006)+.065*Math.sin(5*a-rad*.003)+.045*Math.cos(8*a+.6);
      const x=rad*1.42*wiggle*Math.cos(a)+.10*rad,y=rad*.75*wiggle*Math.sin(a);if(j===0)g.moveTo(x,y);else g.lineTo(x,y);}
      g.closePath();g.strokeStyle=i%5===0?'rgba(173,208,165,.40)':'rgba(169,212,169,.23)';g.lineWidth=i%5===0?1.1:.7;g.stroke();
    }g.restore();const shade=g.createLinearGradient(0,0,w,0);shade.addColorStop(0,'rgba(16,59,58,.98)');shade.addColorStop(.45,'rgba(16,59,58,.77)');shade.addColorStop(.74,'rgba(16,59,58,.05)');shade.addColorStop(1,'rgba(16,59,58,0)');g.fillStyle=shade;g.fillRect(0,0,w,h);
  }
  subjectMenu('browseSubject','Choose a group or topic',false);
  subjectMenu('subjectFilter','Add a group or topic…',true);
  $('findSubject').disabled=true;
  $('browseSubject').onchange=()=>{$('findSubject').disabled=!$('browseSubject').value;};
  $('findSubject').onclick=()=>{
    const subject=PaperSubjects.topics.get($('browseSubject').value);
    if(subject){$('query').value=subject.query;filterSubjects=[];drawSubjectFilters();getBatch(true);}
  };
  $('subjectFilter').onchange=()=>{
    const id=$('subjectFilter').value;
    if(id&&!filterSubjects.includes(id))filterSubjects.push(id);
    $('subjectFilter').value='';drawSubjectFilters();shown=25;render();
  };
  $('subjectMode').onchange=()=>{shown=25;render();};
  $('autoSubjects').onclick=()=>{editedSubjects=null;drawEditor();};
  $('applySubjects').onclick=()=>{
    if(!editingPaper)return;
    const record={...editingPaper,assignedSubjects:editedSubjects};
    const existing=saved.find(r=>Atlas.key(r)===Atlas.key(record));
    if(existing)existing.assignedSubjects=editedSubjects;
    saved=Atlas.mergeList([...saved,record]);
    statusNote=store('saved',saved)?'Paper subjects saved.':'Saved for this tab. Browser storage is unavailable.';
    $('subjectDialog').close();editingPaper=null;recalc();render();
  };
  for(const el of document.querySelectorAll('[data-tab]'))el.addEventListener('click',()=>switchTab(el.dataset.tab));
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();switchTab('explore');});
  $('searchForm').addEventListener('submit',e=>{e.preventDefault();getBatch(true);});$('starter').onclick=clearSearch;$('more').onclick=()=>getBatch(false);
  for(const id of [...Object.keys(selections),'category','rankYear','rankSystem'])$(id).addEventListener(['journal','fromYear','toYear'].includes(id)?'input':'change',()=>{if(['rankYear','rankSystem'].includes(id))rankMenus();shown=25;render();});
  $('reset').onclick=()=>{for(const [k,v] of Object.entries(selections))$(k).value=v;filterSubjects=[];$('subjectMode').value='any';drawSubjectFilters();$('category').value='';$('rankSystem').value='';rankMenus(ranks.reduce((highest,r)=>Math.max(highest,r.year),0));shown=25;render();};
  $('export').onclick=()=>dl('Field_Atlas_journal_articles.ris',Atlas.ris(visible),'application/x-research-info-systems');
  $('csvTemplate').onclick=()=>dl('Field_Atlas_ranking_template.csv','issn,year,system,category,quartile,url\r\n2052-4463,2025,SJR,Information Systems,Q1,https://www.scimagojr.com/journalsearch.php?q=21100451321&tip=sid\r\n','text/csv');
  function saveImport(records){const before=saved.length;saved=Atlas.mergeList([...saved,...records]);const ok=store('saved',saved);recalc();render();return (saved.length-before)+' new journal records saved.'+(ok?'':' Browser storage is unavailable; this import lasts for the tab.');}
  function importText(content,name){
    try{const out=SourceImport.parse(content,name,$('importSource').value);if(!out.records.length)throw Error('No identifiable journal articles. For plain DOIs, use Look up DOIs.');
      $('importStatus').textContent=saveImport(out.records)+' '+out.skipped+' other records skipped.'+(out.hasMore?' The repository reports additional pages.':'');
    }catch(err){$('importStatus').textContent=err.message;}
  }
  $('risfile').onchange=async e=>{const f=e.target.files[0];if(f){try{importText(await f.text(),f.name);}catch(err){$('importStatus').textContent=err.message;}}e.target.value='';};
  $('pasteImport').onclick=()=>importText($('citationPaste').value,'');
  $('doiImport').onclick=async()=>{
    const ids=SourceImport.extractDois($('citationPaste').value),label=$('importSource').value;
    if(!ids.length){$('importStatus').textContent='Paste at least one valid DOI.';return;}
    $('doiImport').disabled=true;let found=0,unresolved=[];
    try{
      for(const [i,id] of ids.entries()){
        $('importStatus').textContent='Looking up DOI '+(i+1)+' of '+ids.length+'…';
        let item;for(const s of ['Crossref','OpenAlex','DataCite']){
          try{const page=await adapters[s](id,1,AbortSignal.timeout(12000));item=page.items.find(r=>Atlas.doi(r.doi)===id);if(item)break;}catch{/* Try the next journal index. */}
        }
        if(!item){unresolved.push(id);continue;}
        const record=Atlas.clean(item);record.sources=[...new Set([...record.sources,label])];saved=Atlas.mergeList([...saved,record]);found++;store('saved',saved);
      }
      const ok=store('saved',saved);recalc();render();$('importStatus').textContent=found+' of '+ids.length+' DOIs matched journal articles.'+(unresolved.length?' Unresolved: '+unresolved.join(', ')+'.':'')+(ok?'':' Browser storage is unavailable; the records last for this tab.');
    }finally{$('doiImport').disabled=false;}
  };
  $('rankfile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const out=Atlas.readRankCsv(await f.text(),$('edition').value);
    importedRanks=importedRanks.concat(out.ranks);ranks=[...builtinRanks,...importedRanks];index=Atlas.rankIndex(ranks);
    const persisted=store('ranks',importedRanks);rankMenus(out.ranks[0].year);note(out.ranks.length+' ranking entries imported. '+out.skipped+' rows skipped.'+(persisted?'':' Browser storage is full or unavailable; this import lasts for the tab.'));
  }catch(err){note(err.message);}e.target.value='';};
    $('flowDownload').onclick=()=>dl('Field_Atlas_n8n.json',JSON.stringify(makeWorkflow($('sourceQuery').value.trim()||$('query').value.trim()||'geospatial public health'),null,2),'application/json');
  $('extendSearch').onclick=()=>{switchTab('sources');$('sourceQuery').focus();};
  $('sourceQuery').oninput=drawDirectory;
  opts('importSource',['Imported citations',...sourceDirectory.map(s=>s.name)],null,'Imported citations');
  opts('dirFilter',[...new Set(sourceDirectory.map(s=>s.group))],'All groups');$('dirFilter').onchange=drawDirectory;
  function dashYearDefaults(){const now=new Date().getFullYear();if(!$('dashFrom').value)$('dashFrom').value=now-9;if(!$('dashTo').value)$('dashTo').value=now;}
  function dashRange(){return {from:Number($('dashFrom').value)||undefined,to:Number($('dashTo').value)||undefined};}
  function dashTopic(){return PaperSubjects.topics.get($('dashSubject').value);}
  function dashMailto(){return $('contact').value.trim()||undefined;}
  function showDashPanel(which){
    $('dashTrendPanel').hidden=which!=='trend';$('dashGeoPanel').hidden=which!=='geo';
    if(which==='trend'){$('dashTrendTab').setAttribute('aria-current','page');$('dashGeoTab').removeAttribute('aria-current');}
    else{$('dashGeoTab').setAttribute('aria-current','page');$('dashTrendTab').removeAttribute('aria-current');}
  }
  function populateCountryPicker(){
    const box=$('dashCountryPicker');box.replaceChildren();const defaults=new Set(['BD','US']);
    for(const [code,name] of Dashboards.countries){
      const label=node('label',undefined,'toggle'),check=node('input');check.type='checkbox';check.value=code;check.checked=defaults.has(code);
      check.onchange=()=>{if(selectedCountries().length>4){check.checked=false;$('dashNote').textContent='Choose up to four countries.';}};
      label.append(check,document.createTextNode(name));box.append(label);
    }
  }
  function selectedCountries(){return [...$('dashCountryPicker').querySelectorAll('input:checked')].map(c=>c.value);}
  function growthRow(g){const label=g.before?('+'+Math.round(g.ratio*100)+'% · '+g.count+' articles'):('New · '+g.count+' articles');return {label:g.name,value:g.count,detail:label};}
  function renderGrowth(rows){
    const box=$('dashGrowth');box.replaceChildren();
    if(!rows.length){box.append(node('p','No topics met the minimum article count for this selection.','dashEmpty'));return;}
    const max=Math.max(...rows.map(g=>g.count),1),list=node('div',undefined,'dashBars');
    for(const g of rows){
      const info=growthRow(g),line=node('div',undefined,'dashBarRow');
      line.append(node('span',info.label,'dashBarLabel'));
      const track=node('div',undefined,'dashBarTrack'),fill=node('div',undefined,'dashBarFill');
      fill.style.width=Math.max(2,(g.count/max)*100)+'%';fill.style.background='#155f55';track.append(fill);line.append(track);
      line.append(node('span',info.detail,'dashBarValue'));list.append(line);
    }
    box.append(list);
  }
  async function runDashboards(){
    const topic=dashTopic();if(!topic){$('dashNote').textContent='Choose a research domain first.';return;}
    if(dashBusy)return;dashBusy=true;$('dashRun').disabled=true;$('dashNote').textContent='Querying OpenAlex…';
    const {from,to}=dashRange(),mailto=dashMailto(),query=topic.query;
    try{
      const [year,cited,journals,topics,growth,countries]=await Promise.all([
        Dashboards.fetchYearCounts(query,from,to,mailto,AbortSignal.timeout(25000)),
        Dashboards.fetchMostCited(query,from,to,mailto,AbortSignal.timeout(25000)),
        Dashboards.fetchTopJournals(query,from,to,mailto,AbortSignal.timeout(25000)),
        Dashboards.fetchTopTopics(query,from,to,mailto,AbortSignal.timeout(25000)),
        Dashboards.fetchGrowth(query,from,to,mailto,AbortSignal.timeout(25000)),
        Dashboards.fetchCountryCounts(query,from,to,mailto,AbortSignal.timeout(25000))
      ]);
      Charts.statTile($('dashYearStat'),{label:'Matching articles and reviews indexed by OpenAlex',value:Charts.compactNumber(year.total),sub:(from||'earliest')+'–'+(to||'latest')+' · '+topic.label});
      Charts.trendChart($('dashYearChart'),{series:[{name:topic.label,points:year.series.map(p=>({year:p.year,count:p.count}))}]});
      Charts.citedList($('dashCited'),cited);
      Charts.barList($('dashJournals'),{rows:journals.map(j=>({label:j.name,value:j.count})),formatValue:Charts.compactNumber});
      Charts.barList($('dashTopTopics'),{rows:topics.map(t=>({label:t.name,value:t.count})),formatValue:Charts.compactNumber});
      $('dashGrowthNote').textContent='Comparing '+growth.recent.from+'–'+growth.recent.to+' against '+growth.prior.from+'–'+growth.prior.to+'. Topics need at least 3 recent articles to be ranked.';
      renderGrowth(growth.rows);
      Charts.barList($('dashCountryChart'),{rows:countries.rows.map(c=>({label:c.name,value:c.count})),formatValue:Charts.compactNumber});
      $('dashNote').textContent=Charts.compactNumber(year.total)+' matching articles and reviews for this domain and year range.';
      await runCompare();
    }catch(err){$('dashNote').textContent='OpenAlex request failed: '+err.message;}
    finally{dashBusy=false;$('dashRun').disabled=false;}
  }
  async function runCompare(){
    const topic=dashTopic();if(!topic)return;
    const codes=selectedCountries();if(!codes.length){Charts.trendChart($('dashCompareChart'),{series:[]});return;}
    const {from,to}=dashRange(),mailto=dashMailto();$('dashCompareRun').disabled=true;
    try{
      const series=await Promise.all(codes.map(async code=>{
        const points=await Dashboards.fetchCountrySeries(topic.query,code,from,to,mailto,AbortSignal.timeout(25000));
        return {name:(Dashboards.countries.find(c=>c[0]===code)||[code,code])[1],points:points.map(p=>({year:p.year,count:p.count}))};
      }));
      Charts.trendChart($('dashCompareChart'),{series});
    }catch(err){$('dashNote').textContent='Country comparison failed: '+err.message;}
    finally{$('dashCompareRun').disabled=false;}
  }
  let dashBusy=false;
  subjectMenu('dashSubject','Choose a research domain or topic',false);dashYearDefaults();populateCountryPicker();
  $('dashRun').onclick=runDashboards;$('dashCompareRun').onclick=runCompare;
  $('dashTrendTab').onclick=()=>showDashPanel('trend');$('dashGeoTab').onclick=()=>showDashPanel('geo');
  updateSourceControls();drawDirectory();rankMenus();view=['sources','dashboards','saved'].includes(location.hash.slice(1))?location.hash.slice(1):'explore';render();terrain();
  if(window.ResizeObserver)new ResizeObserver(terrain).observe($('terrain').parentElement);else window.addEventListener('resize',terrain);
})();
