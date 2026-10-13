// ECU Pro 4.0 deterministic test suite: no internet, OEM materials or credentials.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const coreSrc=fs.readFileSync('app/src/main/assets/ecu_core.js','utf8');
const proSrc=fs.readFileSync('app/src/main/assets/ecu_pro.js','utf8');
const nodeMap=new Map();
const node=id=>{
 if(!nodeMap.has(id))nodeMap.set(id,{
  id,children:[],value:'',textContent:'',files:[],disabled:false,
  addEventListener(){},replaceChildren(){this.children=[]},
  appendChild(child){this.children.push(child);return child},
  append(...arr){this.children.push(...arr)},
  scrollIntoView(){},getContext(){return {clearRect(){},beginPath(){},moveTo(){},
   lineTo(){},stroke(){},fillText(){}};},width:480,height:190
 });
 return nodeMap.get(id);
};
const document={getElementById:node,createElement:tag=>({
 tagName:tag,children:[],textContent:'',value:'',className:'',setAttribute(){},
 appendChild(child){this.children.push(child);return child},append(...c){this.children.push(...c)}
})};
const b=Uint8Array.from({length:65536},()=>255);
b.set(Buffer.from('Bosch.p_321.Project.EDC16.A000','ascii'),0x500);
b.set(Buffer.from('1037376898P467/121','ascii'),0x600);
const report={name:'mercedes_2006.bin',bytes:b,size:b.length,sha256:'a'.repeat(64),
 entropy:1.5,address:0,format:'Raw binary',strings:[
 {offset:0x500,text:'Bosch.p_321.Project.EDC16.A000'},
 {offset:0x600,text:'1037376898P467/121'}]};
const win={TriMindECU:{getState:()=>({primary:report,reference:null})},TriMindV3:{}};
let fetches=0;
const fetch=async(url)=>{fetches++;
 if(url.includes('search/repositories')){
  return {ok:true,json:async()=>({items:[{
   full_name:'example/ecu-tools',
   html_url:'https://github.com/example/ecu-tools',description:'Sample repo',updated_at:'2026-01-01'
  }]})};
 }
 if(url.includes('search/issues')){
  return {ok:true,json:async()=>({items:[{title:'EDC16 discussion',html_url:
   'https://github.com/example/ecu-tools/issues/4',body:'Tech detail'}]})};
 }
 return {ok:true,json:async()=>({items:[{title:'Engine diagnostics',
   link:'https://mechanics.stackexchange.com/questions/1234',creation_date:123456}]})};
};
const memory=new Map();
const stores={metadata:new Map(),firmware:new Map()};
const indexedDB={open(){
 const req={};
 const db={
 objectStoreNames:{contains:name=>name in stores},
 createObjectStore(name){stores[name]=new Map();return {createIndex(){}}},
 close(){},
 transaction(names,mode){
  let tx={};
  tx.objectStore=name=>({
   getAll(){const r={};setTimeout(()=>{r.result=[...stores[name].values()];r.onsuccess?.()},2);return r;},
   get(id){const r={};setTimeout(()=>{r.result=stores[name].get(id);r.onsuccess?.()},2);return r;},
   put(value){stores[name].set(value.id,value);},
   delete(id){stores[name].delete(id);}
  });
  setTimeout(()=>tx.oncomplete?.(),10);
  return tx;
 }
 };
 setTimeout(()=>{req.result=db;req.onsuccess?.()},1);
 return req;
}};
const localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const context={window:win,document,crypto:webcrypto,Uint8Array,Uint32Array,Math,Date,TextEncoder,
 URL,URLSearchParams,AbortController,fetch,indexedDB,localStorage,setTimeout,clearTimeout,console,
 confirm:()=>true,File:class{constructor(p,name){this.bytes=p[0];this.name=name;}},btoa,
 DOMParser:class{
  parseFromString(){
   const embedded={getAttribute(name){return ({
    mmedaddress:'0x0040',mmedelementsizebits:'8',
    mmedrowcount:'2',mmedcolcount:'2'
   })[name]||null;},hasAttribute(){return false;}};
   const axis={querySelector(s){
    if(s==='EMBEDDEDDATA')return embedded;
    if(s==='MATH')return {getAttribute:()=> 'X*0.5+2'};
    if(s==='units')return {textContent:'bar'};
    return null;
   }};
   const table={tagName:'XDFTABLE',querySelector(s){
    if(s==='XDFAXIS[id="z"]')return axis;
    if(s==='title')return {textContent:'Test pressure'};
    return null;
   }};
   return {querySelector(s){
    if(s==='parsererror')return null;
    if(s==='XDFFORMAT,XDFHEADER')return {};
    if(s==='BASEOFFSET')return null;
    return null;
   },querySelectorAll(){return [table]}};
  }
 }};
vm.createContext(context);
vm.runInContext(coreSrc,context);
const core=win.TriMindECUCore;assert(core);
vm.runInContext(proSrc,context);
const pro=win.TriMindECUPro;assert(pro);
async function main(){
 assert.equal(core.crcHex(Uint8Array.from(Buffer.from('123456789'))),'CBF43926');
 assert.equal(core.readCell(Uint8Array.from([0x12,0x34]),0,16,false,false),0x1234);
 assert.equal(core.readCell(Uint8Array.from([0x12,0x34]),0,16,true,false),0x3412);
 assert.equal(core.readCell(Uint8Array.from([255]),0,8,false,true),-1);
 assert.match(core.inspectHex(Uint8Array.from([0x41,0x00]),0,32),/41 00/);
 const id=core.identify(report);
 assert.equal(id.candidates[0].family,'Bosch EDC16');
 assert.equal(id.evidence[0].value,'1037376898P467/121');
 assert.match(id.checksumStatus,/НЕ перевірено/);
 const shifted={bytes:Uint8Array.from([10,20,30]),address:10};
 const other={bytes:Uint8Array.from([20,35,40]),address:11};
 const diff=core.alignedDiff(shifted,other);
 assert.equal(diff.overlap,2);assert.equal(diff.changed,1);
 assert.equal(diff.ranges[0].start,12);
 const a2l=core.parseA2l('ASAP2_VERSION 1 7 /begin PROJECT ABC "" '+
 '/begin CHARACTERISTIC MAP_ONE "Test map" MAP 0x0020 RL_8 /end CHARACTERISTIC');
 assert.equal(a2l.entries.length,1);
 assert.equal(a2l.entries[0].valid,false);
 b.set([0,2,4,6],0x40);
 const xdf=core.parseXdf('<XDFFORMAT><XDFTABLE>dummy</XDFTABLE></XDFFORMAT>',b);
 assert.equal(xdf.entries[0].valid,true);
 assert.deepEqual([...xdf.entries[0].values],[2,3,4,5]);
 assert.match(xdf.entries[0].warning,/припущенням/);
 const diag=core.parseDiagnostic('DTC,P0234\nvalue,1\nvalue,2\nvalue,3\n');
 assert(diag.dtc.includes('P0234'));
 assert.equal(core.physicalExpr('X*0.5+2').supported,true);
 assert.equal(core.physicalExpr('X^2').supported,false);
 const md={hw:'HW123',sw:'SW999',ecu:'Mercedes',origin:'User file'};
 const saved=await pro.dbSave(report,md);
 assert.equal(saved.status,'USER_SUPPLIED_UNVERIFIED');
 assert.equal((await pro.dbAll()).length,1);
 assert.equal((await pro.dbGet(saved.id)).meta.sha256,report.sha256);
 await assert.rejects(()=>pro.dbSave(report,md),/вже є/);
 await pro.dbDelete(saved.id);
 assert.equal((await pro.dbAll()).length,0);
 const found=await pro.searchPublic('EDC16');
 assert.equal(found.sources.length,3);
 assert(found.sources.every(x=>x.url.startsWith('https://')));
 assert(fetches===3,'Must query real provider API endpoints, mocked in tests');
 assert.equal(pro.validSource('javascript:alert(1)'),'');
 pro.init();
 assert.match(node('proIdentity').textContent,/CRC32/);
 assert.match(node('proIdentity').textContent,/HEX-переглядач/);
 assert.match(pro.fullReport(),/НЕ OEM-СЕРТИФІКАТ/);
 console.log('ECU Pro 4.0: signatures, CRC32, address diff, XDF/A2L, DTC, IndexedDB, and source search tests passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});