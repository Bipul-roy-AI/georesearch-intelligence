const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const file=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=new Map(),nav=[];
class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.events={};this.attributes={};this.value='';this.textContent='';this.dataset={};this.classList={toggle(){}};}
  get options(){return this.children;}
  append(...nodes){this.children.push(...nodes);}
  add(o){this.children.push(o);if(this.children.length===1)this.value=String(o.value);}
  replaceChildren(...nodes){this.children=nodes;if(this.tagName==='select')this.value='';}
  setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}
  addEventListener(k,fn){this.events[k]=fn;}
}
for(const m of file.matchAll(/<(button|div|span|section|input|h[1-3]|canvas|form|select|textarea|p)\b([^>]*)>/g)){
  const el=new Element(m[1]),id=m[2].match(/\bid="([^"]+)"/),tab=m[2].match(/data-tab="([^"]+)"/);
  if(id)ids.set(id[1],el);if(tab){el.dataset.tab=tab[1];nav.push(el);}
}
const doc={getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),createTextNode:text=>text,createDocumentFragment:()=>new Element('fragment'),
  querySelectorAll:()=>nav,querySelector:()=>new Element('a')};
ids.get('terrain').parentElement={getBoundingClientRect:()=>({width:0,height:0})};ids.get('sort').value='relevance';
const win={scrollTo(){},addEventListener(){}};const db=new Map();
const ctx=vm.createContext({console,URL,URLSearchParams,AbortController,AbortSignal,Date,document:doc,location:{hash:'',hostname:'',pathname:''},window:win,history:{replaceState(){}},localStorage:{getItem:k=>db.get(k),setItem:(k,v)=>db.set(k,v)},Option:class{constructor(t,v){this.value=String(v);this.text=t;}},setTimeout,clearTimeout});
for(const [,s] of file.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(s,ctx);
const evaljs=s=>vm.runInContext(s,ctx);
assert.equal(evaljs('PaperSubjects.groups.length'),6);
assert.equal(evaljs('PaperSubjects.topics.size - PaperSubjects.groups.length'),42);
assert.equal(evaljs('PaperSubjects.groups.reduce((n,g)=>n+g.children.length,0)'),43);
assert.equal(evaljs("PaperSubjects.matches(Atlas.clean({title:'Spatial epidemiology of dengue and urban heat islands'}).inferredSubjects,['gis','health','climate','vector','heat'],'all')"),true);
assert.equal(evaljs("PaperSubjects.matches(['lidar'],['sensing','health'],'all')"),false);
assert.equal(evaljs("PaperSubjects.matches(['lidar'],['sensing','health'],'any')"),true);
assert.equal(evaljs("PaperSubjects.infer({title:'Costs of solar arrays in SARS research'}).includes('sar')"),false);
assert.equal(evaljs("Atlas.mergeList([{title:'LiDAR',doi:'10.1234/xyz'},{title:'Deep learning',doi:'10.1234/xyz'}])[0].inferredSubjects.includes('dl')"),true);
assert.equal(evaljs("JSON.stringify(SourceImport.parse(Atlas.ris([Atlas.clean({title:'Temperature',assignedSubjects:['heat','disease-mapping']})]),'example.ris').records[0].assignedSubjects)"),'["heat","disease-mapping"]');
assert.equal(evaljs("PaperSubjects.matches(Atlas.clean({title:'A local survey',keywords:['spatial epidemiology']}).inferredSubjects,['gis','health'],'all')"),true);
assert.equal(ids.get('summary').textContent,'12 unique papers');
assert.equal(ids.get('rankYear').value,'2025');
ids.get('access').value='open';ids.get('access').events.change();assert.equal(ids.get('summary').textContent,'11 of 12 unique papers');
ids.get('access').value='';ids.get('quartile').value='Q1';ids.get('quartile').events.change();assert.equal(ids.get('summary').textContent,'3 of 12 unique papers');
ids.get('reset').onclick();assert.equal(ids.get('summary').textContent,'12 unique papers');
const first=ids.get('papers').children[0].children[0];first.children[0].children[1].events.click();
assert.equal(ids.get('savedCount').textContent,1);nav.find(x=>x.dataset.tab==='saved').events.click();assert.equal(ids.get('resultsTitle').textContent,'Saved papers');
assert.equal(ids.get('summary').textContent,'1 unique paper');nav.find(x=>x.dataset.tab==='sources').events.click();assert.equal(ids.get('sourceView').hidden,false);
nav.find(x=>x.dataset.tab==='dashboards').events.click();
assert.equal(ids.get('dashboardView').hidden,false);assert.equal(ids.get('resultView').hidden,true);assert.equal(ids.get('resultsTitle').textContent,'Saved papers');
nav.find(x=>x.dataset.tab==='explore').events.click();
assert.equal(evaljs('sourceDirectory.length'),50);
assert.equal(evaljs("Dashboards.filterString('geospatial public health')"),'title_and_abstract.search:geospatial public health,type:article|review');
assert.equal(evaljs("Dashboards.filterString('remote sensing','authorships.countries:BD')"),'title_and_abstract.search:remote sensing,type:article|review,authorships.countries:BD');
assert.equal(evaljs("Dashboards.yearFilter(2015,2024)"),'publication_year:2015-2024');
assert.equal(evaljs("Dashboards.yearFilter()"),'');
assert.equal(evaljs("JSON.stringify(Dashboards.yearSeries({group_by:[{key:'2021',count:5},{key:'2019',count:2}]},2019,2021))"),'[{"year":2019,"count":2},{"year":2020,"count":0},{"year":2021,"count":5}]');
assert.equal(evaljs("JSON.stringify(Dashboards.namedGroups({group_by:[{key:'T1',key_display_name:'Flood risk',count:9},{key:'unknown',count:3}]},5))"),'[{"id":"T1","name":"Flood risk","count":9}]');
assert.equal(evaljs("JSON.stringify(Dashboards.countryGroups({group_by:[{key:'https://openalex.org/countries/BD',key_display_name:'Bangladesh',count:7},{key:'https://openalex.org/countries/US',key_display_name:'United States',count:20}]},5))"),'[{"code":"BD","name":"Bangladesh","count":7},{"code":"US","name":"United States","count":20}]');
assert.equal(evaljs("Dashboards.growthTable({group_by:[{key:'T1',key_display_name:'A',count:40}]},{group_by:[{key:'T1',key_display_name:'A',count:10}]},5)[0].ratio"),3);
assert.equal(evaljs("Dashboards.growthTable({group_by:[{key:'T2',key_display_name:'B',count:5}]},{group_by:[]},5)[0].before"),0);
assert.equal(evaljs("JSON.stringify(Dashboards.citedList({results:[{display_name:'Paper',cited_by_count:12,publication_year:2020,primary_location:{source:{display_name:'Journal'}},doi:'https://doi.org/10.1/x'}]},5))"),'[{"title":"Paper","year":2020,"cited":12,"journal":"Journal","url":"https://doi.org/10.1/x"}]');
assert.equal(evaljs('Dashboards.countries.length')>50,true);
assert.equal(evaljs('Object.keys(adapters).length'),41);
assert.equal(evaljs("Atlas.readRankCsv('Rank;Issn;SJR Best Quartile;Categories\\n1;20524463;Q1;\"Health (Q2); Geography (Q1)\"','2025').ranks.length"),3);
assert.equal(evaljs("Atlas.readRankCsv('issn,year,system,category,quartile\\n2052-4463,2024,SJR,Environment,Q2','').ranks[0].year"),2024);
assert.equal(evaljs("Atlas.mergeList([{title:'A',journal:'B',year:2025,doi:'10.1234/abc'},{title:'A',journal:'B',year:2025,doi:'10.1234/def'}]).length"),2);
assert.equal(evaljs("Atlas.mergeList([{title:'A',doi:'10.1234/abc',source:'Crossref'},{title:'A2',doi:'10.1234/abc',openUrl:'https://example.org/one',source:'OpenAlex'}])[0].sources.length"),2);
assert.equal(evaljs('Atlas.readRIS(Atlas.ris(starterPapers.map(Atlas.clean))).records.length'),12);
assert.equal(evaljs('Atlas.url("javascript:alert(1)")'),'');
const flow=evaljs('makeWorkflow("Chattogram urban heat")');
const n=flow.nodes;assert.equal(n.length,4);assert.equal(flow.active,false);assert.equal(new URL(n[1].parameters.url).searchParams.get('query.bibliographic'),'Chattogram urban heat');
const result=Function('$input',n[2].parameters.jsCode)({first:()=>({json:{message:{items:[{DOI:'10.1234/test',type:'journal-article',title:['Paper'],author:[{given:'A',family:'Researcher'}],ISSN:['1234-5678']}]}}})});assert.match(result[0].json.ris,/AU  - Researcher, A/);assert.match(result[0].json.ris,/TY  - JOUR/);

async function checkServer() {
  const {createHandler} = require('../field-atlas-server.cjs');
  const env = {CODESPACES:'true', CODESPACE_NAME:'atlas-test', IEEE_API_KEY:'sample-value-for-test'};
  const host = 'atlas-test-18776.app.github.dev';
  const handler = createHandler(file, env, async target => {
    assert.equal(target.hostname, 'ieeexploreapi.ieee.org');
    assert.equal(target.searchParams.get('apikey'), env.IEEE_API_KEY);
    return new Response(JSON.stringify({echo:env.IEEE_API_KEY}));
  });
  async function call(url, headers = {}) {
    let code, body;
    await handler({method:'GET', url, headers:{host, origin:'https://'+host, ...headers}}, {
      writeHead(status) { code=status; }, end(value) { body=value; }
    });
    return {code, body};
  }
  const page = await call('/');
  assert.equal(page.code, 200);
  assert.match(page.body, /"configured":\["IEEE Xplore"\]/);
  assert.ok(!page.body.includes(env.IEEE_API_KEY));
  assert.equal((await call('/', {origin:'https://example.org'})).code, 403);
  const proxy = '/public-api?url='+encodeURIComponent('https://ieeexploreapi.ieee.org/api/v1/search/articles?apikey=client-supplied');
  assert.equal((await call(proxy)).code, 403);
  const response = await call(proxy, {'x-field-atlas':'1'});
  assert.equal(response.code, 200);
  assert.deepEqual(JSON.parse(response.body), {echo:'[private]'});
  console.log('Passed dashboard, catalog, citation, ranking, workflow and server checks.');
}
checkServer().catch(error => {console.error(error); process.exitCode=1;});
