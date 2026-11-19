'use strict';
const atlasRuntime=JSON.parse(document.getElementById('atlas-runtime')?.textContent||'{}');
const atlasNextRequest=new Map();
async function atlasFetch(input,signal){
  const url=new URL(input);
  const spacing={'api.crossref.org':500,'eutils.ncbi.nlm.nih.gov':375,'api.base-search.net':1050,'api.semanticscholar.org':1050};
  const delay=spacing[url.hostname]||0;
  if(delay){
    const now=Date.now(),start=Math.max(now,atlasNextRequest.get(url.hostname)||0);
    atlasNextRequest.set(url.hostname,start+delay);
    if(start>now)await new Promise(resolve=>setTimeout(resolve,start-now));
  }
  if(signal?.aborted)throw signal.reason||new Error('Search cancelled.');
  if(atlasRuntime.server)return fetch('/public-api?url='+encodeURIComponent(url.href),{signal,headers:{'X-Field-Atlas':'1'}});
  return fetch(url,{signal});
}
