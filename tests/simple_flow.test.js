// TriMind 4.1 simplified UX regression: deterministic 3-provider Puter mock.
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const crypto=require('node:crypto').webcrypto;
const sources=['ecu.js','ecu_core.js','simple.js'].map(n=>fs.readFileSync('app/src/main/assets/'+n,'utf8'));
const elements=new Map();
const element=id=>{
 if(!elements.has(id))elements.set(id,{
  id,files:[],value:'',textContent:'',disabled:false,className:'',
  style:{display:''},children:[],handlers:{},
  addEventListener(type,cb){this.handlers[type]=cb},
  scrollIntoView(){},replaceChildren(){this.children=[]},
  appendChild(child){this.children.push(child);return child}
 });
 return elements.get(id);
};
const document={getElementById:element,addEventListener(){}};
const file=(name,arr)=>{
 const content=Uint8Array.from(arr);
 return {name,size:content.length,
  arrayBuffer:async()=>content.slice().buffer,
  text:async()=>Buffer.from(content).toString('utf8')};
};
const arr=new Uint8Array(1024*1024);arr.fill(255);
arr.set(Buffer.from('Bosch.p_321.Project.EDC16.A000'),4096);
arr.set(Buffer.from('1037376898P467/121'),8192);
const bytesTwo=Uint8Array.from(arr);bytesTwo[40960]=1;bytesTwo[40961]=2;
const f1=file('ecu-one.bin',arr),f2=file('ecu-two.bin',bytesTwo);
let calls=[],voteMode='all',failedProvider=null,signedIn=true;
const providerModel=m=>m.startsWith('gpt-')?'openai':m.startsWith('gemini-')?'google':'anthropic';
const puter={
 auth:{isSignedIn:async()=>signedIn,signIn:async()=>{signedIn=true}},
 ai:{listModels:async()=>['gpt-5.4-nano','gemini-3.1-flash-lite','claude-haiku-4-5'].map(id=>({id})),
 chat:async(prompt,options)=>{
  const provider=providerModel(options.model);
  calls.push({provider,options,prompt});
  if(failedProvider===provider)throw Error('402 quota exhausted');
  if(prompt.includes('Раунд 4.')){
   if(voteMode==='dissent'&&provider==='google')return {message:{content:'VERDICT: RESERVATIONS\nПотрібна перевірка HW.'}};
   if(voteMode==='unknown'&&provider==='google')return {message:{content:'Не визначено'}};
   return {message:{content:'VERDICT: AGREE\nКритичних помилок не знайдено.'}};
  }
  if(prompt.includes('Раунд 3.'))return {message:{content:'Єдиний обґрунтований висновок: Bosch EDC16, 2 змінених байти. Відключення DPF не доведено.'}};
  if(prompt.includes('Раунд 2.'))return {message:{content:'Технічних доказів зміни карт немає.'}};
  return {message:{content:provider+': знайдено Bosch EDC16; підстав для певних висновків про калібрування немає.'}};
 }}
};
const window={puter};
const env={window,document,puter,crypto,Uint8Array,Uint32Array,Math,Date,TextEncoder,
 setTimeout,clearTimeout,navigator:{},URL};
vm.createContext(env);
sources.forEach(src=>vm.runInContext(src,env));
const ui=window.TriMindSimple;
assert(ui,'Simplified workflow must exist');
function clear(){
 element('fileOne').files=[f1];element('fileTwo').files=[f2];
 calls=[];failedProvider=null;signedIn=true;voteMode='all';
}
async function main(){
 assert.equal(ui.parseVerdict('VERDICT: AGREE\nГотово'),'AGREE');
 assert.equal(ui.parseVerdict('Вердикт: AGREE'),'UNKNOWN');
 assert.equal(ui.parseVerdict('VERDICT: AGREE / DISAGREE'),'UNKNOWN');
 assert.equal(ui.providerForModel('claude-sonnet-4-6'),'anthropic');
 assert.equal(ui.providerForModel('gemini-3.8-flash'),'google');
 assert.equal(ui.providerForModel('gpt-5.4-mini'),'openai');
 const diff=ui.compareBounded({bytes:arr,address:0,format:'Raw binary'},{
  bytes:bytesTwo,address:0,format:'Raw binary'});
 assert.equal(diff.changed,2);assert.equal(diff.regions,1);
 ui.init();
 clear();
 await ui.analyze();
 assert.equal(element('verdict').textContent,'3/3 · схвалили');
 assert.match(element('answer').textContent,/Єдиний обґрунтований висновок/);
 assert.match(element('answer').textContent,/2 з 1048576/); // number of compared bytes should be visible
 assert.equal(calls.length,10,'Must call 3+3+1+3 real provider API requests');
 const count=Object.fromEntries(['openai','google','anthropic'].map(p=>[p,calls.filter(x=>x.provider===p).length]));
 assert.deepEqual(count,{openai:4,google:3,anthropic:3});
 assert(calls.every(x=>typeof x.prompt==='string'&&!x.prompt.includes('[object File]')));
 assert(!element('answer').textContent.includes('VERDICT: AGREE'),'Only one synthesized answer is displayed');
 clear();voteMode='dissent';
 await ui.analyze();
 assert.equal(element('verdict').textContent,'3/3 · є зауваження');
 assert.match(element('answer').textContent,/RESERVATIONS/);
 clear();failedProvider='anthropic';
 await ui.analyze();
 assert.match(element('verdict').textContent,/Не готово/);
 assert.doesNotMatch(element('answer').textContent,/Єдиний обґрунтований висновок/);
 assert.match(element('answer').textContent,/Claude/);
 clear();signedIn=false;
 await ui.analyze();
 assert.equal(element('verdict').textContent,'Локальний аналіз');
 assert.match(element('answer').textContent,/Puter/);
 clear();element('fileOne').files=[];
 await ui.analyze();
 assert.equal(element('verdict').textContent,'Немає файла');
 console.log('TriMind 4.1 simple two-file UI, 3+3+1+3 quorum, dissent and failure tests passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1});