// Build the standalone HTML, local launcher and downloadable examples.
const fs=require('node:fs'), path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),src=path.join(root,'src'),examples=path.join(root,'examples');
const read=name=>fs.readFileSync(path.join(src,name),'utf8');
const combine=names=>names.map(read).join('\n');
const data='const starterPapers = '+JSON.stringify(JSON.parse(read('seed.json'))).replace(/<\//g,'<\\/')+';\n'+read('ranks.js');
const api=combine(['transport.js','adapters.js','extra-public.js','extra-keyed.js','regional.js','research-apps.js','publishers.js']);
const directory=combine(['directory.js','coverage.js']);
const pieces={STYLE:read('style.css'),DATA:data,CORE:combine(['core.js','source-import.js']),APIS:api,DIRECTORY:directory,EXTRAS:read('workflow.js'),UI:read('ui.js')};
let page=read('page.html');
for(const [key,value] of Object.entries(pieces)){
  const mark='/*ATLAS_'+key+'*/';if(!page.includes(mark))throw Error('Missing page slot '+key);
  page=page.replace(mark,()=>value);
}
if(page.includes('/*ATLAS_'))throw Error('Unfilled HTML slot.');
fs.writeFileSync(path.join(root,'index.html'),page);
fs.copyFileSync(path.join(src,'server.cjs'),path.join(root,'field-atlas-server.cjs'));
fs.mkdirSync(examples,{recursive:true});
const scope=vm.createContext({document:{getElementById:()=>null},URL,URLSearchParams});
vm.runInContext([data,pieces.CORE,api,directory,pieces.EXTRAS].join('\n'),scope);
const flow=vm.runInContext("makeWorkflow('geospatial public health')",scope);
fs.writeFileSync(path.join(examples,'Field_Atlas_n8n.json'),JSON.stringify(flow,null,2)+'\n');
const entries=vm.runInContext("sourceDirectory.map(s=>[s.name,s.group,sourceMode(s),Object.hasOwn(adapters,adaptedName(s.name))?'yes':'no',String(s.prefix||''),sourceRoute(s).url||s.url,viewNotes[s.name]||sourceRoute(s).note||s.detail])",scope);
const csv=rows=>rows.map(row=>row.map(cell=>'"'+String(cell||'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
fs.writeFileSync(path.join(root,'Source_Catalog.csv'),'\uFEFF'+csv([['Source','Group','Default mode without credentials','Search integration','Crossref DOI prefix','Source or query template','Coverage and access'],...entries]));
fs.writeFileSync(path.join(examples,'journal_ranking_template.csv'),'issn,year,system,category,quartile,url\r\n2052-4463,2025,SJR,Information Systems,Q1,https://www.scimagojr.com/journalsearch.php?q=21100451321&tip=sid\r\n');
console.log('Built '+entries.length+' source entries and '+vm.runInContext('Object.keys(adapters).length',scope)+' search integrations.');
