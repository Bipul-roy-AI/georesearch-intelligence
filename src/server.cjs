// Field Atlas. Node.js 22 or newer. No npm dependencies.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const directory=__dirname;
const port=18776;
const marker='<script id="atlas-runtime" type="application/json">{}</script>';
const limit=24*1024*1024;
const routes=[
  ['api.crossref.org',/^\/works$/],
  ['api.openalex.org',/^\/works$/,'','OPENALEX_API_KEY','?api_key'],
  ['www.ebi.ac.uk',/^\/europepmc\/webservices\/rest\/search$/],
  ['doaj.org',/^\/api\/search\/articles\/[^/]+$/],
  ['api.openaire.eu',/^\/graph\/v4\/research-products$/],
  ['api.unpaywall.org',/^\/v2\/10\.\d{4,9}\/.+$/],
  ['eutils.ncbi.nlm.nih.gov',/^\/entrez\/eutils\/(?:esearch|esummary)\.fcgi$/,'','NCBI_API_KEY','?api_key'],
  ['api.semanticscholar.org',/^\/graph\/v1\/paper\/(?:search|DOI(?:%3a|:).+)$/i,'','SEMANTIC_SCHOLAR_API_KEY','x-api-key'],
  ['pubs.usgs.gov',/^\/pubs-services\/publication\/?$/],
  ['api.jstage.jst.go.jp',/^\/searchapi\/do$/],
  ['api.datacite.org',/^\/dois$/],
  ['search.scielo.org',/^\/$/],['pesquisa.bvsalud.org',/^\/gim\/$/],
  ['api.adsabs.harvard.edu',/^\/v1\/search\/query$/,'NASA SciX / ADS','ADS_API_TOKEN','Bearer'],
  ['ieeexploreapi.ieee.org',/^\/api\/v1\/search\/articles$/,'IEEE Xplore','IEEE_API_KEY','?apikey'],
  ['api.core.ac.uk',/^\/v3\/search\/works\/?$/,'CORE','CORE_API_KEY','Bearer'],
  ['api.elsevier.com',/^\/content\/search\/scopus$/,'Scopus','SCOPUS_API_KEY','X-ELS-APIKey'],
  ['api.elsevier.com',/^\/content\/ev\/results$/,'GEOBASE','EV_API_KEY','X-ELS-APIKey'],
  ['api.clarivate.com',/^\/apis\/wos-starter\/v1\/documents$/,'Web of Science Core Collection','WOS_API_KEY','X-ApiKey'],
  ['api.base-search.net',/^\/cgi-bin\/BaseHttpSearchInterface\.fcgi$/,'BASE','BASE_API_KEY','?apikey'],
  ['api.consensus.app',/^\/v1\/search$/,'Consensus','CONSENSUS_API_KEY','x-api-key'],
  ['api.zotero.org',/^\/(?:users|groups)\/\d+\/items\/top$/,'','ZOTERO_API_KEY','Zotero-API-Key']
];
function zoteroScope(env){
  return /^(users|groups)$/.test(env.ZOTERO_LIBRARY_TYPE||'')&&/^\d+$/.test(env.ZOTERO_LIBRARY_ID||'')
    ? env.ZOTERO_LIBRARY_TYPE+'/'+env.ZOTERO_LIBRARY_ID:'';
}
function runtimeInfo(env){
  const configured=routes.filter(r=>r[2]&&env[r[3]]).map(r=>r[2]);
  if(env.EV_API_KEY)configured.push('GeoRef');
  const scope=zoteroScope(env);if(scope)configured.push('Zotero');
  return {server:true,configured,zoteroScope:scope};
}
function allowedOrigins(env){
  const local=['http://127.0.0.1:'+port,'http://localhost:'+port];
  const prefix=env.CODESPACE_NAME||'',domain=env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN||'app.github.dev';
  if(env.CODESPACES==='true'&&/^[a-z\d-]+$/i.test(prefix)&&/^[a-z\d.-]+$/i.test(domain))local.push('https://'+prefix+'-'+port+'.'+domain);
  return new Set(local);
}
function prepareRequest(value,env){
  const target=new URL(value);
  if(target.protocol!=='https:'||target.port||target.username||target.password||target.hash)throw Error('Unsupported provider endpoint.');
  const route=routes.find(([host,pattern])=>host===target.hostname&&pattern.test(target.pathname));
  if(!route)throw Error('Unsupported provider endpoint.');
  if(target.hostname==='api.zotero.org'&&target.pathname!=='/'+zoteroScope(env)+'/items/top')throw Error('The Zotero library does not match the configured scope.');
  if(target.hostname==='eutils.ncbi.nlm.nih.gov'&&!['pubmed','pmc'].includes(target.searchParams.get('db')))throw Error('Use PubMed or PMC.');
  if(target.hostname==='api.base-search.net'&&target.searchParams.get('func')!=='PerformSearch')throw Error('BASE requires a search request.');
  if(['search.scielo.org','pesquisa.bvsalud.org'].includes(target.hostname)){
    const count=Number(target.searchParams.get('count'));if(target.searchParams.get('output')!=='ris'||!Number.isInteger(count)||count<1||count>20)throw Error('Use a journal RIS search page of up to 20 records.');
  }
  const [host,,name,variable,auth]=route;
  const secrets=[],headers={Accept:host==='api.jstage.jst.go.jp'?'application/xml':'application/json','User-Agent':'FieldAtlasLiterature/2.0'};
  if(['search.scielo.org','pesquisa.bvsalud.org'].includes(host))headers.Accept='application/x-research-info-systems, text/plain, */*';
  for(const key of [...target.searchParams.keys()])if(/^(?:api_?key|token|key|access_token|callback|jsonp)$/i.test(key))target.searchParams.delete(key);
  if(name&&!env[variable])throw Error(name+' requires server configuration.');
  if(variable&&env[variable]){
    const secret=env[variable];secrets.push(secret);
    if(auth.startsWith('?'))target.searchParams.set(auth.slice(1),secret);
    else if(auth==='Bearer')headers.Authorization='Bearer '+secret;
    else headers[auth]=secret;
  }
  if(host==='api.elsevier.com'){
    headers.Accept='application/json';
    const token=env[name==='Scopus'?'SCOPUS_INST_TOKEN':'EV_INST_TOKEN'];if(token){headers['X-ELS-Insttoken']=token;secrets.push(token);}
  }
  return {target,headers,secrets};
}
async function limitedBody(response){
  if(Number(response.headers.get('content-length'))>limit)throw Error('Response too large.');
  const chunks=[];let bytes=0;
  for await(const chunk of response.body||[]){bytes+=chunk.length;if(bytes>limit)throw Error('Response too large.');chunks.push(chunk);}
  return Buffer.concat(chunks).toString('utf8');
}
function createHandler(html,env=process.env,fetcher=fetch,bridge=null){
  const origins=allowedOrigins(env),hosts=new Set([...origins].map(o=>new URL(o).host));
  return async function serve(req,res){
    const send=(code,type,data)=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.end(data);};
    if(req.method!=='GET'||!hosts.has(req.headers.host)||req.headers.origin&&!origins.has(req.headers.origin))return send(403,'text/plain','Request not permitted.');
    const request=new URL(req.url,'http://127.0.0.1:'+port);
    if(['/', '/index.html','/field-atlas'].includes(request.pathname)){
      const info=runtimeInfo(env);if(bridge)info.configured.push(...bridge.enabledSources());
      const publicInfo=JSON.stringify(info).replace(/</g,'\\u003c');
      const document=html.replace(marker,()=>'<script id="atlas-runtime" type="application/json">'+publicInfo+'</script>');
      return send(200,'text/html; charset=utf-8',document);
    }
    if(!['/public-api','/mcp-search'].includes(request.pathname))return send(404,'text/plain','Unknown route.');
    if(request.search.length>12000||req.headers['x-field-atlas']!=='1'||(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))return send(403,'text/plain','Open the dashboard to search.');
    if(request.pathname==='/mcp-search'){
      const source=request.searchParams.get('source'),q=(request.searchParams.get('q')||'').trim(),page=Number(request.searchParams.get('page'));
      if(!bridge?.enabledSources().includes(source))return send(403,'text/plain','Connect this research app using MCP.md.');
      if(!q||q.length>320||!Number.isInteger(page)||page<1||page>100)return send(400,'text/plain','Invalid search parameters.');
      try{return send(200,'application/json',JSON.stringify(await bridge.search(source,q,page)));}
      catch{return send(502,'text/plain','The research app could not complete this search. Check the account connection and try again.');}
    }
    let call;
    try{call=prepareRequest(request.searchParams.get('url'),env);}catch(err){return send(400,'text/plain',err.message);}
    try{
      const response=await fetcher(call.target,{headers:call.headers,signal:AbortSignal.timeout(25000),redirect:'error'});
      if(!response.ok)return send(response.status,'text/plain','Provider returned HTTP '+response.status+'.');
      let body=await limitedBody(response);
      for(const s of call.secrets)for(const candidate of new Set([s,encodeURIComponent(s)]))body=body.split(candidate).join('[private]');
      const xml=call.target.hostname==='api.jstage.jst.go.jp'||/xml/i.test(response.headers.get('content-type')||'');
      const ris=['search.scielo.org','pesquisa.bvsalud.org'].includes(call.target.hostname);
      return send(200,ris?'text/plain; charset=utf-8':xml?'application/xml; charset=utf-8':'application/json; charset=utf-8',body);
    }catch{return send(502,'text/plain','The provider could not be reached or the response exceeded the limit.');}
  };
}
function main(){
  if(Number(process.versions.node.split('.')[0])<22){console.error('Field Atlas server requires Node.js 22 or newer. You can also open index.html directly.');process.exitCode=1;return;}
  const envPath=path.join(directory,'.env');if(fs.existsSync(envPath))process.loadEnvFile(envPath);
  const page=path.join(directory,'index.html');if(!fs.existsSync(page)){console.error('Keep field-atlas-server.cjs and index.html in the same extracted folder.');process.exitCode=1;return;}
  const server=http.createServer(createHandler(fs.readFileSync(page,'utf8'),process.env,fetch,require('./mcp-search.cjs')));
  server.on('error',e=>{console.error('Server could not start. '+e.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{
    const local='http://127.0.0.1:'+port+'/field-atlas';
    console.log('Field Atlas is ready at '+local+'\nPress Ctrl+C to stop.');
    if(process.argv.includes('--open')&&process.platform==='win32')spawn('rundll32.exe',['url.dll,FileProtocolHandler',local],{detached:true,stdio:'ignore',windowsHide:true}).unref();
  });
}
if(require.main===module)main();
module.exports={createHandler,prepareRequest,runtimeInfo,routes,main};
