function makeWorkflow(topic) {
  // This function body becomes the n8n Code node for a manual export.
  function convert(rows) {
    const lines=[];
    const field=(tag,v)=>{if(v)lines.push(tag+'  - '+String(v).replace(/[\r\n]+/g,' ').trim());};
    const seen=new Set();
    for(const row of rows){
      if(!row.title?.[0]||row.type!=='journal-article'||seen.has(row.DOI))continue;
      seen.add(row.DOI);field('TY','JOUR');field('TI',row.title[0]);field('JO',row['container-title']?.[0]);
      for(const person of row.author||[])field('AU',person.name||[person.family,person.given].filter(Boolean).join(', '));
      field('PY',(row.published||row.issued)?.['date-parts']?.[0]?.[0]);field('DO',row.DOI);field('UR',row.URL);
      for(const serial of row.ISSN||[])field('SN',serial);
      lines.push('ER  - ','');
    }
    return lines.join('\r\n');
  }
  const api=new URL('https://api.crossref.org/works');
  api.search=new URLSearchParams({'query.bibliographic':topic,'filter':'type:journal-article','rows':'100','select':'DOI,title,author,container-title,published,issued,ISSN,URL,type'});
  const nodes=[
    {id:'field-atlas-start',name:'Manual search',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,0],parameters:{}},
    {id:'field-atlas-search',name:'Search Crossref',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[220,0],parameters:{url:api.href,options:{}}},
    {id:'field-atlas-format',name:'Format journal records',type:'n8n-nodes-base.code',typeVersion:2,position:[440,0],parameters:{jsCode:convert.toString()+'\nreturn [{json:{ris:convert($input.first().json.message.items)}}];'}},
    {id:'field-atlas-export',name:'Download RIS',type:'n8n-nodes-base.convertToFile',typeVersion:1.1,position:[660,0],parameters:{operation:'toText',sourceProperty:'ris',options:{fileName:'Field_Atlas_Crossref.ris'}}}
  ];
  const connections={};
  for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:'main',index:0}]]};
  return {name:'Field Atlas · Crossref journal search',nodes,connections,active:false,settings:{executionOrder:'v1'}};
}
