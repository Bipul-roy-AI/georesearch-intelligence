'use strict';
// Optional local OAuth clients. Regular dashboard starts never start this bridge.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const sessions=new Map();
const services={
  'Article Galaxy':{url:'https://mcp.articlegalaxy.com/ag/mcp',tools:['search_literature']},
  'Undermind':{url:'https://mcp.undermind.ai/mcp',tools:['get_orientation','list_workspaces','search_papers','get_paper_info']}
};
const pageSize=12;
function safeUrl(value){
  try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
function publicAccessUrl(access){
  if(!access || access.accessType!=='open')return '';
  const href=safeUrl(access.url);
  if(!href)return '';
  const u=new URL(href);
  if([...u.searchParams.keys()].some(k=>/token|signature|credential|key-pair-id|x-amz-|x-goog-/i.test(k)))return '';
  return href;
}
function resultData(response){
  if(response?.isError)throw Error('The research provider rejected the search. Check your account and connection.');
  if(response?.structuredContent!=null)return response.structuredContent;
  const chunks=(response?.content||[]).filter(c=>c.type==='text').map(c=>c.text);
  const text=chunks.join('\n');
  try{return JSON.parse(text);}catch{return text;}
}
function asText(result){return typeof result==='string'?result:(typeof result?.result==='string'?result.result:JSON.stringify(result));}
function doi(value){
  const id=String(value||'').trim().replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i,'').toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(id)?id:'';
}
function keysInReport(text) {
  return [...new Set([...text.matchAll(/^\[([A-Za-z0-9._-]{1,48})\]\s+\S+/gm)].map(match=>match[1]))];
}
function parseUndermind(report){
  const chunks=report.split(/(?=^\[[a-z0-9._-]+\]\s)/im);
  return chunks.flatMap(chunk=>{
    const heading=chunk.match(/^\[[^\]\r\n]+\]\s+(.+?) \((\d{4})\)\s*\r?\n([^\r\n]+)/);
    if(!heading)return [];
    const id=doi(chunk.match(/^DOI:\s*(\S+)/im)?.[1]);
    if(!id)return [];
    const by=chunk.match(/^By (.+?)(?: - (?:\d[\d,]* citations?\b|[\d,.]+ cit\.\/yr)|\r?$)/im);
    return [{source:'Undermind',title:heading[1],year:Number(heading[2]),journal:heading[3].replace(/,\s*pp?\.\s.*$/i,''),
      doi:id,authors:by?.[1]||'',openUrl:'',publisherUrl:'',publisherKnown:false}];
  });
}
function parseGalaxy(payload){
  if(!Array.isArray(payload?.hits))throw Error('Article Galaxy returned an unfamiliar metadata format.');
  return payload.hits.filter(r=>r.title&&doi(r.doi)).map(r=>{
    const authorList=(r.authors||[]).map(a=>typeof a==='string'?a:a.authorName).filter(Boolean);
    const openUrl=r.contentDenied===true?'':publicAccessUrl(r.access);
    return {source:'Article Galaxy',title:r.title,year:r.year,journal:r.journal,doi:doi(r.doi),authorList,
      authors:authorList.join('; '),issns:r.issns||[],openUrl,accessSource:openUrl?'Article Galaxy · open access location':'',
      publisherUrl:'',publisherKnown:false};
  });
}
async function readTool(session,tool,args,timeout=18000){
  if(!services[session.name].tools.includes(tool))throw Error('Unsupported search operation.');
  const result=await session.client.callTool({name:tool,arguments:args},undefined,{timeout});
  return resultData(result);
}
async function search(name,query,page){
  const session=sessions.get(name);
  if(!session)throw Error('This source needs an active local OAuth session. See MCP.md.');
  const q=String(query||'').trim();
  page=Number(page);
  if(!q||q.length>320||!Number.isSafeInteger(page)||page<1||page>500)throw Error('Invalid query or page.');
  const offset=(page-1)*pageSize;
  if(name==='Article Galaxy'){
    const id=doi(q);
    const argumentsForTool=id?{dois:[id],limit:1,offset:0}:{term:q,limit:pageSize,offset};
    const payload=await readTool(session,'search_literature',argumentsForTool);
    // Only bibliographic fields and explicit public links are returned from this module.
    const items=parseGalaxy(payload);
    const more=!id && (Number.isFinite(Number(payload.total))?offset+pageSize<Number(payload.total):payload.hits.length===pageSize);
    return {items,more};
  }
  if(offset>=100)return {items:[],more:false};
  const limit=Math.min(pageSize,100-offset),workspace_id=session.workspaceId;
  const searchResult=await readTool(session,'search_papers',{workspace_id,search_type:'semantic',sample_abstract:q,detail_level:'standard',offset,limit});
  const report=asText(searchResult),keys=keysInReport(report).slice(0,limit);
  if(!keys.length){
    if(report.match(/no (?:matching |additional |more )?(?:papers|results)|no matches|0 (?:papers|results)|\[\s*\]/i))return {items:[],more:false};
    throw Error('Undermind returned no recognizable paper identifiers. Its response format may have changed.');
  }
  const details=await readTool(session,'get_paper_info',{workspace_id,cite_keys:keys,detail_level:'standard',show_doi:true,show_locations:false});
  return {items:parseUndermind(asText(details)),more:keys.length===limit&&offset+limit<100};
}
function enabledSources(){return [...sessions.keys()];}
// Minimal environment for the optional child: other dashboard providers' keys stay with the main server.
function bridgeEnvironment(directory){
  const env={MCP_REMOTE_CONFIG_DIR:directory};
  const names=new Set(['PATH','HOME','USERPROFILE','SYSTEMROOT','LOCALAPPDATA','APPDATA','TEMP','TMP','TMPDIR','DISPLAY',
    'WAYLAND_DISPLAY','XDG_RUNTIME_DIR','DBUS_SESSION_BUS_ADDRESS','LANG','LC_ALL','COMSPEC','PATHEXT','BROWSER','HTTPS_PROXY','HTTP_PROXY','NO_PROXY']);
  for(const [key,value] of Object.entries(process.env))if(names.has(key.toUpperCase()))env[key]=value;
  return env;
}
function bridgeArguments(name,env){
  const service=services[name];
  const args=[service.url];
  if(name==='Undermind'){
    const clientId=(env.UNDERMIND_CLIENT_ID||'').trim();
    if(!clientId)throw Error('Set UNDERMIND_CLIENT_ID to your publicly hosted client metadata URL or your registered client ID. See MCP.md.');
    args.push('18444','--host','127.0.0.1','--resource',service.url,'--static-oauth-client-metadata',JSON.stringify({scope:'mcp',token_endpoint_auth_method:'none'}));
    if(/^https:\/\//.test(clientId)){
      const u=new URL(clientId);
      if(!u.pathname.slice(1)||u.username||u.password)throw Error('Invalid Undermind client metadata URL.');
      args.push('--client-metadata-url',clientId);
    }else{
      if(!/^[a-zA-Z0-9_.:-]{1,180}$/.test(clientId))throw Error('Invalid registered Undermind client ID.');
      args.push('--static-oauth-client-info',JSON.stringify({client_id:clientId}));
    }
  }
  return [...args,'--auth-timeout','150'];
}
async function connect(name){
  if(!Object.hasOwn(services,name))throw Error('Use “Article Galaxy” or “Undermind”.');
  const args=bridgeArguments(name,process.env);
  let Client,StdioClientTransport,bridge;
  try{
    ({Client}=require('@modelcontextprotocol/sdk/client/index.js'));
    ({StdioClientTransport}=require('@modelcontextprotocol/sdk/client/stdio.js'));
    const metadata=path.join(__dirname,'node_modules','mcp-remote','package.json');
    const manifest=JSON.parse(fs.readFileSync(metadata,'utf8'));
    bridge=path.resolve(path.dirname(metadata),manifest.bin['mcp-remote']);
    if(!fs.statSync(bridge).isFile())throw Error();
  }catch{throw Error('Install the two optional packages listed in MCP.md before connecting.');}
  const cacheDir=path.join(os.homedir(),'.field-atlas','oauth',name==='Undermind'?'undermind':'article-galaxy');
  fs.mkdirSync(cacheDir,{recursive:true,mode:0o700});
  const client=new Client({name:'field-atlas',version:'1.0.0'},{capabilities:{}});
  const transport=new StdioClientTransport({command:process.execPath,args:[bridge,...args],env:bridgeEnvironment(cacheDir),stderr:'inherit'});
  const session={name,client,workspaceId:''};
  try{
    await client.connect(transport,{timeout:180000});
    const discovered=new Set();
    let cursor;
    for(let i=0;i<15;i++){
      const page=await client.listTools(cursor?{cursor}:{}, {timeout:15000});
      for(const tool of page.tools||[])discovered.add(tool.name);
      cursor=page.nextCursor;if(!cursor)break;
    }
    if(services[name].tools.some(t=>!discovered.has(t)))throw Error('This account did not advertise the required metadata search operations.');
    if(name==='Undermind'){
      await readTool(session,'get_orientation',{});
      const spaces=await readTool(session,'list_workspaces',{});
      const available=asText(spaces);
      const ids=[...new Set(available.match(/\b[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\b/ig)||[])];
      let pick=process.env.UNDERMIND_WORKSPACE_ID?.trim();
      if(!pick&&ids.length===1)pick=ids[0];
      if(!ids.length)throw Error('No accessible Undermind workspace was found. Create or select one in Undermind and reconnect.');
      if(!pick){
        if(!process.stdin.isTTY)throw Error('Set UNDERMIND_WORKSPACE_ID to an existing workspace and reconnect.');
        console.log(available);
        const terminal=require('node:readline/promises').createInterface({input:process.stdin,output:process.stdout});
        try{pick=(await terminal.question('Paste a listed workspace UUID: ')).trim();}finally{terminal.close();}
      }
      if(!ids.includes(pick))throw Error('The selected workspace was not listed by this account.');
      session.workspaceId=pick;
    }
  }catch(e){await client.close().catch(()=>{});throw e;}
  sessions.set(name,session);
  client.onclose=()=>sessions.delete(name);
  console.log(name+' is connected.');
}
module.exports={search,enabledSources};
if(require.main===module){
  (async()=>{
    const [, , command,...names]=process.argv;
    if(command!=='connect'||!names.length||names.some(n=>!Object.hasOwn(services,n)))throw Error('Run node mcp-search.cjs connect "Article Galaxy" and/or "Undermind". See MCP.md.');
    const settings=path.join(__dirname,'.env');
    if(fs.existsSync(settings)&&process.loadEnvFile)process.loadEnvFile(settings);
    for(const name of new Set(names))await connect(name);
    await require('./field-atlas-server.cjs').main();
  })().catch(async err=>{
    for(const s of [...sessions.values()])await s.client.close().catch(()=>{});
    console.error('Connection failed. '+String(err?.message||'See MCP.md.').slice(0,300));
    process.exitCode=1;
  });
}
