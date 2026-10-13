/*
 TriMind ECU Pro 4.0. Local IndexedDB reference library, sourced research,
 safe calibration viewer, CSV triage and audit export. No ECU writes.
*/
(function(){
'use strict';
const $=id=>document.getElementById(id);
const S=()=>window.TriMindECU.getState();
const C=()=>window.TriMindECUCore;
const MAX_ENTRIES=8;
let parsed=null,diagnostics=null,recordList=[],sources=[],lastResearch='',uiReady=false;
let queryUsed='', active=false;
const esc=t=>String(t??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function message(s){$('proStatus').textContent=String(s).slice(0,700)}
function short(t,n=300){return String(t||'').slice(0,n)}
function fileInfo(){
 const a=S().primary;
 if(!a)throw Error('Спочатку відкрий основний дамп у ECU Firmware Lab.');
 return a;
}
function openDB(){
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined')return reject(Error('IndexedDB недоступна у WebView.'));
  const req=indexedDB.open('trimind_ecu_references_v1',1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('metadata')){
    const m=db.createObjectStore('metadata',{keyPath:'id'});
    m.createIndex('sha256','sha256',{unique:false});
   }
   if(!db.objectStoreNames.contains('firmware'))db.createObjectStore('firmware',{keyPath:'id'});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Помилка бази IndexedDB.'));
 });
}
async function dbAll(){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('metadata','readonly');
  const req=tx.objectStore('metadata').getAll();
  req.onsuccess=()=>{const rows=req.result||[];db.close();resolve(rows);};
  req.onerror=()=>{db.close();reject(req.error||Error('Помилка читання бази.'));};
 });
}
async function dbSave(report,fields){
 const list=await dbAll();
 if(list.length>=MAX_ENTRIES)throw Error('База містить 8 збережених дампів. Видали один або експортуй його.');
 const fingerprint=report.sha256;
 if(!fingerprint||fingerprint==='Недоступно у WebView')throw Error('Для збереження потрібен SHA-256. Перевір WebView.');
 if(list.some(x=>x.sha256===fingerprint))throw Error('Такий SHA-256 вже є у базі.');
 const meta={
  id:'ecu_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),
  name:report.name,size:report.bytes.length,sha256:fingerprint,
  hw:short(fields.hw,100),sw:short(fields.sw,100),
  ecu:short(fields.ecu,100),origin:short(fields.origin,180),
  created:new Date().toISOString(),
  status:'USER_SUPPLIED_UNVERIFIED',
  explanation:'Користувач додав файл. Справжність OEM не підтверджено.'};
 const db=await openDB();
 try{
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(['metadata','firmware'],'readwrite');
   tx.objectStore('metadata').put(meta);
   tx.objectStore('firmware').put({id:meta.id,bytes:report.bytes.slice().buffer});
   tx.oncomplete=resolve;
   tx.onerror=()=>reject(tx.error||Error('Не вдалося зберегти дамп.'));
   tx.onabort=()=>reject(tx.error||Error('Перевищено квоту сховища.'));
  });
 }finally{db.close();}
 return meta;
}
async function dbGet(id){
 const db=await openDB();
 try{return await new Promise((resolve,reject)=>{
  const t=db.transaction(['metadata','firmware'],'readonly');
  const m=t.objectStore('metadata').get(id),b=t.objectStore('firmware').get(id);
  t.oncomplete=()=>resolve({meta:m.result,blob:b.result});
  t.onerror=()=>reject(t.error||Error('Не вдалося прочитати дамп.'));
 });}finally{db.close();}
}
async function dbDelete(id){
 const db=await openDB();
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction(['metadata','firmware'],'readwrite');
  tx.objectStore('metadata').delete(id);
  tx.objectStore('firmware').delete(id);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('Помилка видалення.'));
 });}finally{db.close();}
}
async function refreshDB(){
 const select=$('proStoredFiles'),rows=await dbAll();
 recordList=rows;
 select.replaceChildren();
 const blank=document.createElement('option');blank.value='';blank.textContent='Оберіть користувацький еталон';select.appendChild(blank);
 for(const m of rows){
  const option=document.createElement('option');
  option.value=m.id;option.textContent=short(m.name,60)+' · '+short(m.hw||m.sw||m.ecu||'',35);
  select.appendChild(option);
 }
 $('proDbCount').textContent=rows.length+' / '+MAX_ENTRIES+' локальних дампів; НЕЗАСВІДЧЕНІ користувацькі еталони';
}
async function addCurrentToDB(){
 try{
  const a=fileInfo();
  const meta=await dbSave(a,{hw:$('proHw').value,sw:$('proSw').value,
   ecu:$('proEcu').value,origin:$('proOrigin').value});
  message('Збережено у приватній базі Android: '+meta.name+
   '. Це користувацький еталон, не посвідчена OEM-прошивка.');
  await refreshDB();
 }catch(e){message('Не вдалося зберегти: '+e.message);}
}
async function useReference(){
 const id=$('proStoredFiles').value;
 if(!id)return message('Оберіть еталон у локальній базі.');
 try{
  const record=await dbGet(id);
  if(!record.meta||!record.blob)throw Error('Запис неповний.');
  const bin=new Uint8Array(record.blob.bytes);
  const f=new File([bin],record.meta.name.endsWith('.bin')?record.meta.name:'reference.bin',
    {type:'application/octet-stream'});
  const reference=await window.TriMindECU.decode(f);
  if(reference.sha256!==record.meta.sha256)throw Error('Хеш збережених байтів не збігається.');
  S().reference=reference;
  refreshCurrent();
  $('proReference').textContent='Застосовано еталон: '+record.meta.name+
    ' · SHA-256 '+record.meta.sha256+'\n'+record.meta.explanation;
  message('Еталон зіставлено локально. Перевір узгодженість версій HW/SW.');
 }catch(e){message('Помилка еталона: '+e.message);}
}
async function removeReference(){
 const id=$('proStoredFiles').value;
 if(!id)return message('Оберіть запис.');
 if(!confirm('Видалити дамп і його метадані з бази телефону?'))return;
 try{await dbDelete(id);await refreshDB();message('Дамп вилучено.');}
 catch(e){message('Помилка видалення: '+e.message);}
}
function clearNode(id){const n=$(id);if(n)n.replaceChildren();}
function el(tag,text){const n=document.createElement(tag);if(text!=null)n.textContent=String(text);return n;}
function renderProfile(report){
 const root=$('proIdentity');
 if(!report){root.textContent='Дамп не обрано.';return;}
 const id=C().identify(report);
 const candidates=id.candidates.map(x=>'• '+x.family+' · '+x.confidence+
  ' · спостереження: '+x.marker+'\n  CPU: '+x.architecture).join('\n');
 const ids=id.evidence.map(x=>'0x'+x.offset.toString(16).toUpperCase()+' · '+x.value).join('\n');
 const crc=C().crcHex(report.bytes);
 const hexdump=C().inspectHex(report.bytes,Number($('proOffset').value)||0,256);
 root.textContent='Виробник/сімейство (ознаки, не повна ідентифікація):\n'+
   (candidates||'Не визначено за відомими сигнатурами')+
   '\n\nІдентифікатори у прошивці:\n'+(ids||'Окремих номерів не знайдено')+
   '\n\nCRC32 усього файлу: '+crc+
   ' (інформаційний, НЕ OEM ECU checksum)\nSHA-256: '+report.sha256+
   '\n\nHEX-переглядач:\n'+hexdump;
 if(S().reference){
  const d=C().alignedDiff(report,S().reference);
  $('proAligned').textContent=d?.warning+'\n'+
   (d?.overlap?'Адресно зіставлено '+d.overlap+' байтів, відмінностей '+d.changed+
     '. Найбільші області:\n'+d.ranges.slice(0,30).map(x=>'0x'+x.start.toString(16).toUpperCase()+
     ' — '+x.length+' байтів').join('\n'): 'Діапазони не перетинаються.');
 }else $('proAligned').textContent='Для адресного порівняння потрібен еталон.';
}
function calibrationDraw(data){
 const canvas=$('proGraph');if(!canvas||!canvas.getContext)return;
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);
 if(!data?.values?.length)return;
 const vals=data.values.slice(0,80);
 const min=Math.min(...vals),max=Math.max(...vals),span=Math.max(1e-9,max-min);
 ctx.strokeStyle='#2554ba';ctx.lineWidth=2;ctx.beginPath();
 vals.forEach((v,i)=>{
  const x=32+i*(w-52)/Math.max(1,vals.length-1);
  const y=h-24-(v-min)/span*(h-50);
  if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
 });
 ctx.stroke();ctx.fillStyle='#52617a';ctx.font='12px sans-serif';
 ctx.fillText('max '+max,4,12);ctx.fillText('min '+min,4,h-8);
}
function showCalibration(){
 const n=$('proCalibration');n.replaceChildren();
 if(!parsed){n.textContent='Завантажте A2L або XDF. Опис повинен відповідати саме цьому HW/SW.';return;}
 const heading=el('p',parsed.type+' · '+parsed.count+' описів. Не перевірено сумісність файлу з прошивкою.');
 n.appendChild(heading);
 const select=$('proMapSelect');select.replaceChildren();
 parsed.entries.slice(0,180).forEach((x,i)=>{
  const opt=el('option',x.name+(x.valid?' · значення доступні':' · метадані'));
  opt.value=String(i);select.appendChild(opt);
 });
 $('proMapNotes').textContent=parsed.notes.join(' ')+' Повний файл не передається в ШІ без твоєї дії.';
 inspectMap();
}
function inspectMap(){
 if(!parsed)return;
 const obj=parsed.entries[Number($('proMapSelect').value)||0];
 if(!obj)return;
 $('proMapDetail').textContent=
   'Об’єкт: '+obj.name+'\nТип: '+obj.kind+
   '\nОфсет/адреса: '+(Number.isInteger(obj.address)?'0x'+obj.address.toString(16).toUpperCase():'не задано')+
   '\nРозміри: '+(obj.rows||'?')+' × '+(obj.cols||'?')+
   '\nФормула: '+(obj.formula||'в A2L не розібрано')+
   '\nОдиниці: '+(obj.unit||'не визначено')+
   '\n'+(obj.warning||'')+
   (obj.valid?'\nМін: '+obj.minimum+' Макс: '+obj.maximum+' Середнє: '+obj.average+
    '\nЗначення (не більше 128):\n'+obj.values.slice(0,128).join(', '):'');
 calibrationDraw(obj.valid?obj:null);
}
async function readDescriptor(){
 const f=$('proDescriptor').files?.[0];
 if(!f)return message('Оберіть опис XDF або A2L.');
 try{
  if(f.size>4*1024*1024)throw Error('Опис понад 4 МБ.');
  const fileText=await f.text(),a=fileInfo();
  if(/\.xdf$/i.test(f.name))parsed=C().parseXdf(fileText,a.bytes);
  else if(/\.a2l$/i.test(f.name))parsed=C().parseA2l(fileText);
  else throw Error('Потрібен .xdf або .a2l');
  showCalibration();
  message('Опис завантажено: '+f.name+
   '. Калібрувальні дані показуються тільки в тих випадках, які підтримує читач.');
 }catch(e){parsed=null;showCalibration();message('Помилка калібрувань: '+e.message);}
}
async function readDiagnostics(){
 const f=$('proDiagnostic').files?.[0];if(!f)return;
 try{
  if(f.size>2*1024*1024)throw Error('Діагностичний файл більший за 2 МБ.');
  diagnostics=C().parseDiagnostic(await f.text());
  $('proDiagnosticResult').textContent=
   'DTC: '+(diagnostics.dtc.join(', ')||'не знайдено')+
   '\nСтатистика CSV (до 2 000 рядків):\n'+
   diagnostics.statistics.map(x=>x.column+' · '+x.count+' значень · min '+x.min+
     ' · max '+x.max+' · середнє '+x.mean).join('\n')+
   '\n'+diagnostics.warning;
  message('Діагностичний звіт прочитано; коди DTC не означають підтверджений діагноз.');
 }catch(e){diagnostics=null;message('Помилка діагностики: '+e.message);}
}
function fullReport(){
 const a=S().primary;
 const p=a?C().identify(a):null;
 const lines=[
  'TriMind ECU Pro 4.0 — ДОСЛІДНИЦЬКИЙ ЗВІТ, НЕ OEM-СЕРТИФІКАТ',
  'Дата: '+new Date().toISOString(),'Поточний файл: '+(a?.name||'не обрано'),
  'Заявлені автомобіль/блок/HW/SW: '+[$('proEcu').value,$('proHw').value,$('proSw').value].join(' · '),
  a?'SHA-256: '+a.sha256+'; CRC32: '+C().crcHex(a.bytes):'',
  a?'Сімейства за евристикою: '+p.candidates.map(x=>x.family).join(', '):'',
  a?'Помітні рядки:\n'+p.evidence.map(x=>x.value).join('\n'):'',
  a&&S().reference?'Адресно зіставлені відмінності: '+JSON.stringify(C().alignedDiff(a,S().reference)):'',
  parsed?C().calibrationReport(parsed):'Файл A2L/XDF не завантажено.',
  diagnostics?'Діагностика:\n'+JSON.stringify(diagnostics,null,2):'',
  'Доступні джерела: '+sources.length+
   '\n'+sources.map(x=>x.title+' | '+x.url+' | '+(x.date||'')).join('\n'),
  lastResearch?'ШІ-пошук (неперевірений текст моделі):\n'+lastResearch.slice(0,6500):'',
  'Висновок: невідомі карти/контрольні суми/потужність або заводський статус НЕ можна визначити за статистикою байтів.',
  'Прошивання/запис ЕБУ відсутній. Заборонено робити висновок про безпеку перепрошивання з цього звіту.'
 ];
 return lines.filter(Boolean).join('\n\n').slice(0,175000);
}
async function saveReport(){
 const content=fullReport();
 const stem=(S().primary?.name||'ecu').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,55);
 if(!window.TriMindAndroid?.saveReport){
  if(window.TriMindAndroid?.copy)window.TriMindAndroid.copy(content);
  message('На цьому пристрої експорт файла недоступний. Звіт скопійовано.');
  return;
 }
 const encoder=new TextEncoder();
 const data=encoder.encode(content);
 let binary='';for(let i=0;i<data.length;i++)binary+=String.fromCharCode(data[i]);
 window.TriMindAndroid.saveReport('TriMind-'+stem+'-ECU.txt','text/plain',btoa(binary));
 message('Вибери місце збереження TXT-звіту в Android.');
}
function exportEvidenceJSON(){
 const a=S().primary, r=S().reference;
 const evidence={
  schema:'trimind-ecu-pro-4-evidence',created:new Date().toISOString(),
  input:a?{name:a.name,sha256:a.sha256,crc32:C().crcHex(a.bytes),
   size:a.bytes.length,format:a.format,baseAddress:a.address}:null,
  reference:r?{name:r.name,sha256:r.sha256,size:r.bytes.length}:null,
  declaredMetadata:{
   ecu:$('proEcu').value,hw:$('proHw').value,sw:$('proSw').value,
   claimedOrigin:$('proOrigin').value
  },
  familyCandidates:a?C().identify(a).candidates:[],
  diff:a&&r?C().alignedDiff(a,r):null,
  calibration:parsed?{type:parsed.type,count:parsed.count,
   entries:parsed.entries.map(x=>({name:x.name,kind:x.kind,address:x.address,
    rows:x.rows,cols:x.cols,valid:x.valid,unit:x.unit,
    minimum:x.minimum,maximum:x.maximum,warning:x.warning})).slice(0,250),
   limitations:parsed.notes}:null,
  diagnostic:diagnostics,
  sources:sources.map(x=>({title:x.title,url:x.url,source:x.source,checkedAt:x.checkedAt})),
  limitations:['User reference is not authenticated OEM','CRC32 is NOT OEM ECU checksum',
   'No safety to flash is established','No immobilizer/emissions-related patching']
 };
 const raw=JSON.stringify(evidence,null,2);
 if(!window.TriMindAndroid?.saveReport){
  if(window.TriMindAndroid?.copy)window.TriMindAndroid.copy(raw);
  message('JSON-докази скопійовано.');return;
 }
 const bytes=new TextEncoder().encode(raw);
 let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
 window.TriMindAndroid.saveReport('TriMind-ECU-Evidence.json','application/json',btoa(binary));
 message('Вибери місце збереження JSON у файловому менеджері Android.');
}
function shareWithCouncil(){
 const info=fullReport();
 const field=$('prompt');
 field.value='Професійне технічне дослідження ECU: оціни лише підтверджені дані, '+
  'визнач потрібні первинні джерела, суперечності й наступні діагностичні перевірки. '+
  'Не стверджуй конкретних калібрувальних значень або коректності checksum без підстав.\n\n'+
  info.slice(0,16000);
 field.scrollIntoView({behavior:'smooth'});
 message('Технічний звіт додано до чату трьох ШІ. Сирий дамп не надсилався.');
}
function refreshCurrent(){
 renderProfile(S().primary);
 if(S().primary){
  const id=C().identify(S().primary);
  $('proSearchTerm').value=([$('proSw').value,$('proHw').value,
    id.evidence[0]?.value?.match(/\b1037\d{6}\b/)?.[0]||'',id.candidates[0]?.family||''])
    .filter(Boolean).join(' ').slice(0,130);
 }
}

async function fetchJson(url){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch(url,{credentials:'omit',headers:{'Accept':'application/json'},signal:controller.signal});
  if(!res.ok)throw Error('HTTP '+res.status);
  return await res.json();
 }finally{clearTimeout(timer);}
}
function validSource(url){
 try{const u=new URL(url);return u.protocol==='https:'?u.href:'';}catch(e){return '';}
}
function prepareSearch(q){
 // Avoid leaking whole user-provided firmware/dumps or huge confidential notes to external searches.
 return String(q||'').trim().replace(/\s+/g,' ').slice(0,100);
}
async function searchPublic(query){
 const q=prepareSearch(query);
 if(q.length<3)throw Error('Для пошуку потрібно ввести HW/SW, марку або назву ЕБУ.');
 const request=[
  {name:'GitHub repositories',url:'https://api.github.com/search/repositories?q='+
    encodeURIComponent(q+' firmware')+'&per_page=6'},
  {name:'GitHub issues',url:'https://api.github.com/search/issues?q='+
    encodeURIComponent(q+' ecu')+'&per_page=6'},
  {name:'Motor Vehicle Maintenance (Stack Exchange)',url:
    'https://api.stackexchange.com/2.3/search/advanced?site=mechanics&pagesize=6&q='+encodeURIComponent(q)}
 ];
 const answer=await Promise.allSettled(request.map(x=>fetchJson(x.url)));
 const all=[],problems=[];
 for(let i=0;i<answer.length;i++){
  const val=answer[i],name=request[i].name;
  if(val.status==='rejected'){problems.push(name+': '+short(val.reason?.message,80));continue;}
  const items=val.value.items||[];
  for(const item of items){
   const url=validSource(item.html_url||item.link);
   if(!url)continue;
   all.push({source:name,title:short(item.full_name||item.title||'Запис',160),
    url,date:short(item.updated_at||item.creation_date||'',40),
    snippet:short(item.description||item.body||'',340).replace(/<[^>]+>/g,''),
    checkedAt:new Date().toISOString(),kind:'LIVE_SEARCH_RECORD'});
  }
 }
 const seen=new Set(),unique=all.filter(x=>!seen.has(x.url)&&seen.add(x.url)).slice(0,18);
 if(!unique.length&&problems.length)throw Error('Пошук недоступний: '+problems.join('; '));
 return {sources:unique,problems,providers:request.map(x=>x.name)};
}
function renderSearch(){
 const list=$('proSources');list.replaceChildren();
 const hint=el('div','Джерела нижче — реальні результати API, але не автоматично перевірені докази.');
 hint.className='muted small';list.appendChild(hint);
 for(const src of sources){
  const card=el('div');card.className='discussionEntry';
  const a=el('a',src.title+' ↗');a.href=src.url;a.target='_blank';a.rel='noopener noreferrer';
  const meta=el('div',src.source+' · '+src.date);meta.className='muted small';
  const snip=el('div',src.snippet);snip.className='small';
  card.append(a,meta,snip);list.appendChild(card);
 }
 if(!sources.length)list.appendChild(el('p','За цим запитом підтверджених результатів API немає.'));
}
async function searchLive(){
 if(active)return;
 active=true;
 const q=prepareSearch($('proSearchTerm').value||$('ecuQuery').value);
 const button=$('proSearchButton');
 button.disabled=true;message('Збираю доступні записи з GitHub та Stack Exchange…');
 try{
  const result=await searchPublic(q);
  sources=result.sources;queryUsed=q;renderSearch();
  message('Знайдено '+sources.length+' записів. '+
   (result.problems.length?'Частина API недоступна: '+result.problems.join('; '):''));
 }catch(e){sources=[];renderSearch();message('Помилка публічних API: '+e.message);}
 finally{button.disabled=false;active=false;}
}
async function retrieveAIBrowser(){
 if(active)return;
 if(!window.puter?.ai?.chat){message('Puter не підключено: AI web search недоступний.');return;}
 const q=prepareSearch($('proSearchTerm').value||$('ecuQuery').value);
 if(q.length<3)return message('Введи номер HW/SW або назву ЕБУ.');
 active=true;const button=$('proAIResearch');button.disabled=true;
 message('Puter виконує окремий вебпошук. Використання AI може бути платним.');
 try{
  const current=S().primary;
  const info=current?C().identify(current):null;
  const prompt='Технічне дослідження прошивки ECU (НЕ визначай карту лише за розміром BIN). '+
   'Проведи пошук у відкритих документах Bosch, ASAM, TunerPro, GitHub, а також '+
   'публічно доступних темах MHH AUTO, ECU Connections, ECUedit, NefMoto, CarTechnology. '+
   'Дотримуйся авторських прав і не обминай логіни. Звіт українською. '+
   'Для КОЖНОГО важливого твердження наводь реальне URL та познач, чи це документація, '+
   'офіційне джерело, чи непідтверджена порада з форуму. Не вигадуй прочитані сторінки. '+
   'Розділи на відомості про HW/SW, A2L/XDF, checksum, можливі оригінальні версії, '+
   'які дані залишаються невідомими. Не додавай процедури вимкнення DPF/EGR, '+
   'обходу імобілайзера та інші небезпечні дії. Запит: '+q+
   (current?'\nМаркери дампа: '+short(info?.evidence.map(x=>x.value).join('; '),1500):'');
  const res=await puter.ai.chat(prompt,{model:'openai/gpt-5.6-luna',
    tools:[{type:'web_search'}],max_tokens:3300});
  let content=res?.message?.content||res?.text||res?.output_text||'';
  if(Array.isArray(content))content=content.map(x=>x.text||'').join('\n');
  if(!String(content).trim())throw Error('Пошукова модель не повернула текст.');
  lastResearch=short(content,17000);
  $('proAIResearchText').textContent=lastResearch+'\n\nЗастереження: модель могла помилитися. '+
   'Перевір URL вручну; URL лише в тексті не вважаються незалежно підтвердженим джерелом.';
  message('Пошуковий звіт отримано. Перевір адреси та факти.');
 }catch(e){message('AI web search недоступний: '+short(e.message,210));}
 finally{active=false;button.disabled=false;}
}
function init(){
 if(uiReady)return;uiReady=true;
 $('proScan').addEventListener('click',refreshCurrent);
 $('proHexOffset').addEventListener('change',()=>{
  $('proOffset').value=$('proHexOffset').value;
  refreshCurrent();
 });
 $('proSaveReference').addEventListener('click',addCurrentToDB);
 $('proLoadReference').addEventListener('click',useReference);
 $('proDeleteReference').addEventListener('click',removeReference);
 $('proDescriptor').addEventListener('change',readDescriptor);
 $('proMapSelect').addEventListener('change',inspectMap);
 $('proDiagnostic').addEventListener('change',readDiagnostics);
 $('proSearchButton').addEventListener('click',searchLive);
 $('proAIResearch').addEventListener('click',retrieveAIBrowser);
 $('proExport').addEventListener('click',saveReport);
 $('proExportJson').addEventListener('click',exportEvidenceJSON);
 $('proToCouncil').addEventListener('click',shareWithCouncil);
 $('proSearchTerm').addEventListener('keydown',e=>{if(e.key==='Enter')searchLive();});
 refreshDB().catch(e=>message('Локальна база недоступна: '+e.message));
 refreshCurrent();renderSearch();
}
function rolePrefix(provider){
 return ({
  openai:'Роль: реверс-інженер ЕБУ. Перевіряй розкладку пам’яті, байтові докази, ідентифікатори та надійність XDF/A2L. ',
  google:'Роль: технічний дослідник. Порівнюй лише перевірювані джерела SW/HW, документи ASAM/Bosch і профільні дискусії. ',
  anthropic:'Роль: незалежний аудитор помилок. Шукай непідтверджені твердження, небезпечні припущення й відсутні еталони. '
 })[provider]||'Роль: незалежний технічний експерт. ';
}
window.TriMindECUPro={init,rolePrefix,identify:()=>C().identify(S().primary),
 openDB,dbSave,dbAll,dbGet,dbDelete,searchPublic,validSource,fullReport,
 getReview:()=>({sources,parsed,diagnostics,queryUsed})};
})();
