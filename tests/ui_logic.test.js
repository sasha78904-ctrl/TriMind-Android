// Offline regression tests for the embedded TriMind UI, using a fake Puter API.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(x=>x.trim());
assert(scripts.length>0,'UI script missing');
const embedded=scripts.at(-1).replace(/\}\)\(\);\s*$/,'globalThis.__test={normResponse,queryWithFallback,modelList,renderRich,rawOf,createSummary,requestArgs,fileValid,prepareAttachments,cleanupAttachments};\n})();');
assert(embedded.includes('globalThis.__test'),'Test entrypoint not attached');

class Element {
 constructor(){this.dataset={};this.classList={add(){},remove(){},toggle(){}};this.children=[];this.textContent='';this.value='economy';}
 addEventListener(){}
 appendChild(child){this.children.push(child);return child;}
 replaceChildren(){this.children=[];this.textContent='';}
 scrollIntoView(){}
}
const nodes={};
const document={
 getElementById(id){return nodes[id]||(nodes[id]=new Element());},
 querySelectorAll(){return[];},
 createElement(){return new Element();},
 createTextNode(text){return {textContent:text};}
};
nodes.quality=new Element();
nodes.quality.value='economy';
const calls=[];
const fileOperations=[];
const puter={
 fs:{write:async(path,file)=>{fileOperations.push(['upload',path,file.name]);return {path:'~/tmp/'+path}},delete:async(path)=>{fileOperations.push(['delete',path])}},
 auth:{isSignedIn:async()=>false},
 ai:{
   listModels:async()=>[],
   chat:async(prompt,{model})=>{
     calls.push(model);
     if(model==='gemini-3.5-flash-lite')
       return {message:{content:null},finish_reason:'length'};
     if(model==='gemini-3.1-flash-lite')
       return {message:{content:'14'},finish_reason:'stop'};
     throw Error('Unexpected model: '+model);
   }
 }
};
const localStorage={getItem(){return null;},setItem(){}};
const context={document,puter,localStorage,console,setTimeout,clearTimeout,
 window:{puter},alert(){},confirm(){return true;},navigator:{}};
vm.createContext(context);
vm.runInContext(embedded,context);
const t=context.__test;
assert(t,'UI export missing');

async function main(){
 assert.equal(t.normResponse({message:{content:' 14 '}}),'14');
 assert.equal(t.normResponse({message:{content:[{type:'text',text:' так '}]}}),'так');
 assert.equal(t.normResponse({candidates:[{content:{parts:[{text:'test'}]}}],message:{content:'test'}}),'test');
 assert.throws(()=>t.normResponse({message:{content:null},finish_reason:'length'}),/порожній текст/);

 const result=await t.queryWithFallback('google','56/4',
   ['gemini-3.5-flash-lite','gemini-3.1-flash-lite'],()=>{});
 assert.equal(result.text,'14');
 assert.equal(result.model,'gemini-3.1-flash-lite');
 assert.equal(calls.filter(x=>x==='gemini-3.5-flash-lite').length,2);
 assert.equal(calls.filter(x=>x==='gemini-3.1-flash-lite').length,1);

 t.renderRich('answer-google','**14**\n<script>alert("XSS")</script>');
 const el=nodes['answer-google'];
 assert.equal(t.rawOf('answer-google'),'**14**\n<script>alert("XSS")</script>');
 assert.equal(el.children.length,2);
 assert.equal(el.children[0].children[0].textContent,'14');
 // The malicious tag remains a text node; innerHTML is never used.
 assert.equal(el.children[1].children[0].textContent,'<script>alert("XSS")</script>');
 const mockImage={name:'receipt.jpg',type:'image/jpeg',size:123456,lastModified:1};
 const mockPdf={name:'report.pdf',type:'application/pdf',size:334,lastModified:2};
 assert.equal(t.fileValid(mockImage),'');
 assert.equal(t.fileValid(mockPdf),'');
 assert.match(t.fileValid({...mockPdf,name:'malware.exe'}),/не підтримується/);
 assert.match(t.fileValid({...mockPdf,size:16*1024*1024}),/завеликий/);
 const imageCtx=await t.prepareAttachments([mockImage]);
 const imageArgs=t.requestArgs('Analyze photo',imageCtx,{model:'gpt-5.4-nano'});
 assert.equal(imageArgs[0],'Analyze photo');
 assert.equal(imageArgs[1],mockImage);
 assert.equal(imageArgs[2].model,'gpt-5.4-nano');
 assert.equal(fileOperations.length,0,'Single image must not be uploaded to Puter drive');
 const both=await t.prepareAttachments([mockImage,mockPdf]);
 assert.equal(both.paths.length,2);
 const docArgs=t.requestArgs('Analyze files',both,{model:'claude-haiku-4-5'});
 assert.equal(docArgs.length,2);
 assert.equal(docArgs[0][0].role,'user');
 assert.equal(docArgs[0][0].content.length,3);
 assert.equal(docArgs[0][0].content[0].type,'file');
 assert.equal(docArgs[0][0].content[1].type,'file');
 assert.equal(docArgs[0][0].content[2].text,'Analyze files');
 await t.cleanupAttachments(both);
 assert.equal(fileOperations.filter(x=>x[0]==='upload').length,2);
 assert.equal(fileOperations.filter(x=>x[0]==='delete').length,2);
 const one=await t.createSummary('56/4',[{provider:'google',model:'gemini',text:'14'}]);
 assert.match(one.badge,/1 із 3/);
 assert.match(one.summary,/не має|лише одна/i);
 console.log('TriMind offline UI regression tests passed.');
}
main().catch(e=>{console.error(e);process.exit(1);});
