// TriMind V3 deterministic browser/logic regression, no real provider credentials.
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const moduleSource=fs.readFileSync('app/src/main/assets/v3.js','utf8');
class Element{
 constructor(){this.children=[];this.events={};this.value='';this.checked=false;this.textContent='';this.className='';this.style={};}
 addEventListener(type,fn){this.events[type]=fn}
 replaceChildren(){this.children=[]}
 appendChild(x){this.children.push(x);return x}
 append(...x){for(const y of x)this.children.push(y)}
 prepend(x){this.children.unshift(x)}
 click(){return this.events.click?.({target:this})}
}
const nodes={};
const document={
 getElementById:id=>nodes[id]||(nodes[id]=new Element()),
 createElement:tag=>new Element(),
 createTextNode:text=>({textContent:text})
};
const data=new Map();
const localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v))};
let generation=0;
const queries=[];
const fetch=async(url)=>{
 queries.push(url);
 if(url.includes('w/api.php')){
  return {ok:true,json:async()=>({query:{pages:{
   1:{title:'Transport safety standards',fullurl:'https://en.wikipedia.org/wiki/Transport',
     extract:generation?'Updated general transport encyclopedia snippet.':'Transport encyclopedia snippet.'},
   2:{title:'ADR agreement',fullurl:'https://en.wikipedia.org/wiki/ADR_(treaty)',
     extract:'Background on ADR treaty.'}
  }}})};
 }
 if(url.includes('api.crossref.org')){
  return {ok:true,json:async()=>({message:{items:[{
    title:['A published scientific record'],DOI:generation?'10.1000/new':'10.1000/old',
    published:{'date-parts':[[2025,3,1]]},
    'container-title':['Transport studies']
  }]}})};
 }
 throw Error('Unexpected source '+url);
};
const puter={ai:{
 speech2txt:async file=>({text:'Водій повідомляє про помилку терміналу'}),
 img2txt:async file=>'Текст на фото документа'
}};
const window={};
const sandbox={document,localStorage,window,puter,fetch,
 URL,AbortController,setTimeout,clearTimeout,console,Math,Date,
 confirm:()=>true,navigator:{}};
vm.createContext(sandbox);
vm.runInContext(moduleSource,sandbox);
const v3=window.TriMindV3;
assert(v3,'The research extension is not loaded');
v3.init();
assert.equal(document.getElementById('projectSelect').children.length,1);
async function main(){
 assert.equal(v3.__test.allowUrl('javascript:alert(1)'),'');
 assert.equal(v3.__test.trimSearch('hello '.repeat(60)).length,135);
 const sources=await v3.research('ADR transport rules');
 assert(sources.length>=2);
 assert(sources.every(x=>x.url.startsWith('https://')));
 assert(sources.every(x=>x.title));
 assert(queries.some(x=>x.includes('en.wikipedia.org')));
 assert(queries.some(x=>x.includes('api.crossref.org')));
 const ctx=v3.__test.sourceContext(sources);
 assert(ctx.includes('[S1]'));
 assert(ctx.includes('не перевірка всіх фактів'));
 v3.addNote('note','ADR правила','Литовський водій питає про правила ADR для цистерн');
 assert.equal(v3.__test.relevantNotes('цистерн ADR').length,1);
 document.getElementById('ocrToggle').checked=true;
 const photo={name:'receipt.jpg',size:240, type:'image/jpeg'};
 const prepared=await v3.beforeAsk('Проаналізуй ADR', [photo]);
 assert.equal(prepared.uploadFiles.length,1);
 assert(prepared.prompt.includes('Текст на фото документа'));
 assert(prepared.prompt.includes('ВИТЯГ ІЗ БАЗИ ПРОЄКТУ'));
 assert.equal(prepared.projectId,'general');
 assert.equal(v3.rolePrefix('anthropic').includes('критик'),true);
 assert.equal(v3.rolePrefix('google').includes('дослідник'),true);
 const audio={name:'voice.m4a',size:300,type:'audio/mp4'};
 const audioData=await v3.__test.extractMedia([audio]);
 assert.equal(audioData.uploadFiles.length,0);
 assert(audioData.textPieces.some(x=>x.includes('Водій повідомляє')));
 const audioPrepared=await v3.beforeAsk('Що сказано?', [audio]);
 assert(audioPrepared.prompt.includes('ТРАНСКРИПТ'));
 assert.equal(audioPrepared.uploadFiles.length,0);
 document.getElementById('watchQuery').value='ADR changes';
 document.getElementById('watchInterval').value='1';
 document.getElementById('addWatch').click();
 const watchEl=document.getElementById('watchList');
 assert.equal(watchEl.children.length,1);
 await watchEl.children[0].children.at(-2).click();
 const saved=JSON.parse(localStorage.getItem('trimind_v3_watchers'));
 assert(saved[0].lastRun,'Watch should create baseline');
 generation=1;
 await document.getElementById('watchList').children[0].children.at(-2).click();
 const updates=document.getElementById('watchUpdates');
 assert.equal(updates.children.length,1,'New Crossref URL should surface a change');
 document.getElementById('newProjectName').value='Європейське законодавство';
 document.getElementById('createProject').click();
 assert.equal(document.getElementById('projectSelect').children.length,2);
 assert.equal(v3.getProjectId()==='general',false);
 console.log('V3 sources, OCR, audio, project memory and monitoring tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});