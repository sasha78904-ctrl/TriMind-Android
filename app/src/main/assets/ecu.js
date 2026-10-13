/*
 TriMind ECU Firmware Lab 3.1.
 READ-ONLY static byte analysis. Never flashes, patches, bypasses immobilizers,
 validates proprietary checksums, or infers emissions modifications as fact.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const MAX=32*1024*1024, BLOCK=8192;
const STATE={primary:null,reference:null,report:null,search:''};
const DOMAINS=[
 ['ECU Connections','ecuconnections.com'],['MHH AUTO','mhhauto.com'],
 ['ECU Edit','ecuedit.com'],['NefMoto','nefariousmotorsports.com'],
 ['CarTechnology','cartechnology.co.uk'],['Digital Kaos','digital-kaos.co.uk'],
 ['GitHub','github.com'],['TunerPro','tunerpro.net'],
 ['OpenECU','openecu.com'],['Bosch Mobility','bosch-mobility.com']
];
const HEX=n=>'0x'+Number(n).toString(16).toUpperCase().padStart(6,'0');
const clampText=t=>String(t||'').slice(0,10000);
const basename=s=>String(s||'unnamed').replace(/[\r\n]/g,' ').slice(0,130);
function entropy(bytes,start=0,end=bytes.length){
 const len=end-start;
 if(len<=0)return 0;
 const counts=new Uint32Array(256);
 for(let i=start;i<end;i++)counts[bytes[i]]++;
 let h=0;
 for(let i=0;i<256;i++)if(counts[i]){
  const p=counts[i]/len;
  h-=p*Math.log2(p);
 }
 return Math.round(h*1000)/1000;
}
function hash(bytes){
 if(!(globalThis.crypto&&globalThis.crypto.subtle))return Promise.resolve('Недоступно у WebView');
 return globalThis.crypto.subtle.digest('SHA-256',bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))
 .then(result=>[...new Uint8Array(result)].map(x=>x.toString(16).padStart(2,'0')).join(''))
 .catch(()=> 'Недоступно у WebView');
}
function bytePreview(bytes,start,n=32){
 return [...bytes.slice(start,start+n)].map(v=>v.toString(16).toUpperCase().padStart(2,'0')).join(' ');
}
function stringsIn(bytes,max=55,min=6){
 const found=[];
 let start=0,buffer='';
 function flush(){
  if(buffer.length>=min){
   // Only material likely useful for ECU/firmware metadata; no fake matches.
   if(/bosch|siemens|continental|delphi|denso|edc\s?1[567]|med\d|me\d|sid\d|sw|hw|software|mercedes|bmw|vw|porsche|calibration|checksum|ecu|a0+\d|\d{8,}/i.test(buffer)){
    found.push({offset:start,text:buffer.slice(0,180)});
   }
  }
  buffer='';
 }
 for(let i=0;i<bytes.length&&found.length<max;i++){
  const b=bytes[i];
  if(b>=32&&b<=126){
   if(buffer.length===0)start=i;
   if(buffer.length<180)buffer+=String.fromCharCode(b);
  }else flush();
 }
 flush();
 return found;
}
function intelHex(text){
 let seen=0,base=0,entry=null,errors=0,min=Infinity,max=-1;
 const sections=[];
 for(const line of text.split(/\r?\n/)){
  const val=line.trim();
  if(!val)continue;
  if(!/^:[0-9a-fA-F]+$/.test(val)||val.length<11||(val.length%2)!==1)
   throw Error('Некоректний Intel HEX запис: '+val.slice(0,42));
  const raw=new Uint8Array((val.length-1)/2);
  for(let i=0;i<raw.length;i++)raw[i]=parseInt(val.slice(i*2+1,i*2+3),16);
  const length=raw[0],addr=(raw[1]<<8)|raw[2],type=raw[3];
  if(raw.length!==length+5)throw Error('Довжина Intel HEX запису не збігається.');
  const sum=raw.reduce((a,b)=>a+b,0);
  if((sum&255)!==0)errors++;
  if(type===0){
   const off=base+addr;
   sections.push([off,raw.slice(4,4+length)]);min=Math.min(min,off);max=Math.max(max,off+length-1);seen+=length;
  } else if(type===1){break;}
  else if(type===2){base=((raw[4]<<8)|raw[5])<<4;}
  else if(type===4){base=(((raw[4]<<8)|raw[5])*65536);}
  else if(type===3||type===5){entry=raw.slice(4,4+length);}
 }
 if(!sections.length)throw Error('Intel HEX не містить байтів даних.');
 if(max-min+1>MAX)throw Error('Адресний діапазон понад 32 МБ. Потрібен спеціалізований аналізатор.');
 const bytes=new Uint8Array(max-min+1);bytes.fill(255);
 for(const [offset,data] of sections)bytes.set(data,offset-min);
 return {bytes,format:'Intel HEX',baseAddress:min,parseErrors:errors,payloadBytes:seen};
}
function srec(text){
 let errors=0,min=Infinity,max=-1,payload=0;
 const sections=[];
 for(const line of text.split(/\r?\n/)){
  const val=line.trim();if(!val)continue;
  if(!/^S[0-9][0-9a-fA-F]+$/.test(val))throw Error('Некоректний Motorola S-record');
  const t=val[1],size=parseInt(val.slice(2,4),16);
  const raw=new Uint8Array((val.length-4)/2);
  for(let i=0;i<raw.length;i++)raw[i]=parseInt(val.slice(4+i*2,6+i*2),16);
  if(raw.length!==size)throw Error('Довжина S-record не збігається.');
  const total=raw.reduce((s,v)=>s+v,size);
  if((total&255)!==255)errors++;
  const addrBytes=t==='1'?2:t==='2'?3:t==='3'?4:0;
  if(!addrBytes)continue;
  if(raw.length<=addrBytes)continue;
  let addr=0;for(let i=0;i<addrBytes;i++)addr=addr*256+raw[i];
  const data=raw.slice(addrBytes,raw.length-1);
  if(!data.length)continue;
  sections.push([addr,data]);min=Math.min(min,addr);max=Math.max(max,addr+data.length-1);payload+=data.length;
 }
 if(!sections.length)throw Error('Motorola S-record не містить даних.');
 if(max-min+1>MAX)throw Error('Адресний діапазон S-record понад 32 МБ.');
 const bytes=new Uint8Array(max-min+1);bytes.fill(255);
 for(const [offset,part] of sections)bytes.set(part,offset-min);
 return {bytes,format:'Motorola S-record',baseAddress:min,parseErrors:errors,payloadBytes:payload};
}
async function decode(file){
 if(!file||!Number.isFinite(file.size)||file.size<=0||file.size>MAX)throw Error('Файл має бути 1 байт – 32 МБ.');
 const name=basename(file.name),ext=name.split('.').pop().toLowerCase();
 let payload;
 if(['hex','ihex'].includes(ext)){
  const content=await file.text();
  payload=intelHex(content);
 }else if(['s19','s28','s37','srec','mot'].includes(ext)){
  payload=srec(await file.text());
 }else if(['bin','ori','mod','eep','flash','rom','dump'].includes(ext)||name.toLowerCase()==='mers nov'){
  payload={bytes:new Uint8Array(await file.arrayBuffer()),format:'Raw binary',baseAddress:0,parseErrors:null,payloadBytes:file.size};
 }else{
  throw Error('Підтримано аналіз бінарних дампів BIN/ORI/MOD/EEP/FLASH/ROM/DUMP, Intel HEX та S19/S28/S37/MOT. FRF/ODX/A2L/XDF не розпаковуються автоматично.');
 }
 const bytes=payload.bytes;
 if(!bytes.length)throw Error('Порожній дамп.');
 const count0=bytes.reduce((n,v)=>n+(v===0),0);
 const countF=bytes.reduce((n,v)=>n+(v===255),0);
 const blocks=[];
 for(let i=0;i<bytes.length;i+=BLOCK){
  const end=Math.min(i+BLOCK,bytes.length);
  let zero=0,ff=0;
  for(let j=i;j<end;j++){if(bytes[j]===0)zero++;if(bytes[j]===255)ff++;}
  blocks.push({start:i,end,entropy:entropy(bytes,i,end),
   fill:(zero===end-i)?'00':(ff===end-i)?'FF':'data'});
 }
 const strings=stringsIn(bytes);
 let markers=[];
 for(const s of strings){
  if(/bosch|siemens|continental|delphi|denso|edc1[567]|edc 1[567]|sid\d|med\d|mercedes/i.test(s.text))
   markers.push(s.text);
 }
 let metadata=markers.slice(0,14);
 const result={
  name,size:file.size,bytes,format:payload.format,address:payload.baseAddress,
  payloadBytes:payload.payloadBytes,parseErrors:payload.parseErrors,
  sha256:await hash(bytes),zero:count0,ff:countF,entropy:entropy(bytes),
  blocks,strings,metadata,preview:bytePreview(bytes,0,96)
 };
 return result;
}
function diff(a,b){
 if(!a||!b)return null;
 const x=a.bytes,y=b.bytes,length=Math.min(x.length,y.length);
 let changed=0,runs=[],active=-1;
 for(let i=0;i<length;i++){
  if(x[i]!==y[i]){
   changed++;
   if(active<0)active=i;
  }else if(active>=0){
   runs.push({start:active,end:i,length:i-active});active=-1;
  }
 }
 if(active>=0)runs.push({start:active,end:length,length:length-active});
 const ranked=[...runs].sort((p,q)=>q.length-p.length).slice(0,35);
 return {changed,compared:length,changedFraction:length?changed/length:0,
  extraBytes:Math.abs(x.length-y.length),sizeA:x.length,sizeB:y.length,
  regions:runs.length,largest:ranked,identical:changed===0&&x.length===y.length};
}
function concise(result){
 if(!result)return '';
 const bytes=result.bytes;
 const high=result.blocks.filter(x=>x.entropy>=7.5).length;
 const low=result.blocks.filter(x=>x.entropy<=1).length;
 return 'ФАЙЛ: '+result.name+
  '\nФормат: '+result.format+'; розмір '+result.size+' байтів; розпаковано '+bytes.length+
  '; базова адреса '+HEX(result.address)+
  '\nSHA-256: '+result.sha256+
  '\nСтатистична ентропія: '+result.entropy+' біт/байт; 0x00: '+result.zero+
  '; 0xFF: '+result.ff+
  '\nБлоків 8 КіБ: '+result.blocks.length+'; ентропія >=7.5: '+high+
  '; <=1.0: '+low+
  '\nПомилки контрольних сум HEX/S-record (форматні): '+(result.parseErrors==null?'не застосовується':result.parseErrors)+
  '\nASCII-ознаки (байтові зміщення):\n'+
  (result.strings.slice(0,35).map(x=>HEX(x.offset)+' '+x.text).join('\n')||'Не знайдено')+
  '\nПерші байти: '+result.preview+
  '\nВАЖЛИВО: розмір/ентропія/рядки не доводять оригінальність, тюнінг або відключення екологічних систем. '+
  'Фірмові алгоритми контрольних сум і адреси карт не підтверджено.';
}
function compareText(d){
 if(!d)return '';
 return 'ПОРІВНЯННЯ З ЕТАЛОНОМ:\n'+
  (d.identical?'Дампи повністю збігаються за байтами.':
  'Змінено '+d.changed+' байтів у спільному діапазоні '+d.compared+
   ' ('+(d.changedFraction*100).toFixed(3)+'%); відмінність довжини '+d.extraBytes+
   ' байтів; окремих ділянок '+d.regions+'.')+
  '\nНайбільші безперервні відмінності (зміщення у файлі):\n'+
  d.largest.slice(0,24).map(x=>HEX(x.start)+'–'+HEX(x.end-1)+
   ' ('+x.length+' байтів)').join('\n')+
  '\nУВАГА: адреси не доводять розташування калібрувань без ECU-specific DAMOS/A2L/XDF і точної ідентифікації.';
}
function fullReport(){
 return (STATE.primary?concise(STATE.primary):'Дамп не завантажено.')+
  (STATE.reference?'\n\nЕТАЛОН:\n'+concise(STATE.reference):'')+
  (STATE.primary&&STATE.reference?'\n\n'+compareText(diff(STATE.primary,STATE.reference)):'');
}
function render(){
 const result=$('ecuResult'),comp=$('ecuComparison');
 if(!result)return;
 const a=STATE.primary,b=STATE.reference;
 result.textContent=a?concise(a):'Оберіть прошивку для локального аналізу.';
 comp.textContent=a&&b?compareText(diff(a,b)):'Додайте другу прошивку для побайтового порівняння.';
 $('ecuProject').textContent=a?'Файл оброблено локально. Для аналізу ШІ використовується звіт, а не сам бінарний файл.':'Дамп не обрано.';
}
function buildSearchQuery(){
 const base=$('ecuQuery').value.trim();
 const a=STATE.primary;
 const met=a?a.metadata.slice(0,3).map(x=>x.replace(/[^\w ._-]/g,' ').slice(0,60)).join(' '):'';
 return (base||met||'ECU firmware checksum calibration technical analysis').slice(0,180);
}
function searchLinks(){
 const query=buildSearchQuery(),holder=$('ecuSources');
 holder.replaceChildren();
 const general=document.createElement('a');
 general.textContent='Пошук у Google: технічна документація та форуми ↗';
 general.href='https://www.google.com/search?q='+encodeURIComponent(query+' ECU firmware original maps');
 general.target='_blank';general.rel='noopener noreferrer';holder.appendChild(general);
 for(const [name,domain] of DOMAINS){
  const a=document.createElement('a');
  a.href='https://www.google.com/search?q='+encodeURIComponent(query+' site:'+domain);
  a.textContent=name+' ↗';a.target='_blank';a.rel='noopener noreferrer';
  holder.appendChild(a);
 }
 $('ecuSearchNote').textContent='Це посилання на реальні пошукові запити за тематичними ресурсами. '+
  'Закриті розділи форумів не обходяться автоматично; наявність посилання не означає, що джерело вже прочитано.';
}
function parseResponse(data){
 if(typeof data==='string')return data;
 const c=data?.message?.content||data?.text||data?.output_text||'';
 if(typeof c==='string')return c;
 if(Array.isArray(c))return c.map(x=>x.text||'').join('\n');
 return '';
}
async function deepSearch(){
 if(!$('ecuPrimary').files?.length&& !STATE.primary){
  $('ecuSearchNote').textContent='Для точнішого пошуку спочатку завантажте дамп або введіть код ЕБУ/авто.';
 }
 searchLinks();
 if(!window.puter?.ai?.chat){
  $('ecuResearch').textContent='Puter не підключено. Використовуйте посилання на форуми.';
  return;
 }
 const question=buildSearchQuery();
 const output=$('ecuResearch');
 output.textContent='Виконується реальний вебпошук через Puter (OpenAI) з обмеженням 1 дослідницького запиту. Це може витрачати ліміт.';
 const excerpt=STATE.primary?concise(STATE.primary).slice(0,5200):'Прошивку не завантажено';
 const prompt='Зроби фаховий пошук джерел щодо ЕБУ та його програмного забезпечення. Потрібні '+
 'офіційні технічні матеріали, TunerPro/XDF або визначення сімейства ЕБУ, дискусії на '+
 'ECU Connections, MHH Auto, ECUedit, NefMoto, CarTechnology, Digital Kaos, GitHub. '+
 'Користуйся вебпошуком; не вигадуй результати, URL, версії ПЗ, електросхеми чи визначення калібрувань. '+
 'Для кожного твердження наведи реальне джерело URL, якщо воно є. '+
 'Розділи на: перевірені дані; форумні припущення; те, що треба підтвердити для саме цього дампу. '+
 'Не пропонуй процедури вимкнення екологічних чи протиугінних систем. '+
 'Відповідай українською. Ключовий запит: '+question+'\nЛокальний байтовий звіт:\n'+excerpt;
 try{
  const response=await puter.ai.chat(prompt,{
   model:'openai/gpt-5.6-luna',tools:[{type:'web_search'}],max_tokens:2600
  });
  const answer=parseResponse(response);
  if(!answer.trim())throw Error('Пошуковий провайдер не повернув текст.');
  STATE.search=answer;output.textContent=answer+'\n\nПосилання і твердження перевіряйте вручну: це підсумок моделі, а не автоматично засвідчений аудит джерел.';
 }catch(e){
  output.textContent='Вебпошук через Puter недоступний: '+String(e?.message||e).slice(0,270)+
   '\nВикористовуйте підготовлені посилання на форуми та документацію вище.';
 }
}
async function analyze(file,which){
 const label=which==='primary'?'Основна':'Еталонна';
 $('ecuProject').textContent=label+': аналізую байти локально…';
 try{
  const result=await decode(file);
  STATE[which]=result;
  render();searchLinks();
 }catch(e){
  STATE[which]=null;render();
  $('ecuProject').textContent='Помилка '+label.toLowerCase()+' прошивки: '+String(e?.message||e);
 }
}
function insertIntoAsk(){
 if(!STATE.primary){$('ecuProject').textContent='Спочатку завантажте дамп.';return;}
 const report=fullReport().slice(0,13500);
 const question=($('ecuUserTask').value||'').trim()||
  'Проведи експертний технічний аналіз прошивки та висунь перевірні гіпотези про ECU. '+
  'Що підтверджено байтами, а що вимагає оригінального файла, A2L/DAMOS/XDF або стендової перевірки?';
 const context='ТЕХНІЧНА ЕКСПЕРТИЗА ECU (звіт сформовано локально; повні BIN-байти не надіслані):\n'+
 report+'\n\n'+(STATE.search?'ПОШУКОВИЙ ЗВІТ (перевір усі посилання):\n'+STATE.search.slice(0,6000):'');
 const field=$('prompt');field.value=question+'\n\n'+context;
 field.scrollIntoView({behavior:'smooth'});
 $('ecuProject').textContent='Локальний звіт додано до основного запиту. Тепер натисни «Почати дискусію трьох ШІ».';
}
function saveProject(){
 if(!STATE.primary)return;
 const api=window.TriMindV3;
 if(!api||!api.addNote){$('ecuProject').textContent='Модуль проєктів недоступний.';return;}
 api.addNote('result','ECU: '+STATE.primary.name,fullReport()+'\n\n'+STATE.search.slice(0,2500));
 $('ecuProject').textContent='ECU-звіт додано до активного проєкту.';
}
function copyReport(){
 const report=fullReport()+(STATE.search?'\n\nПОШУК:\n'+STATE.search:'');
 if(window.TriMindAndroid?.copy)TriMindAndroid.copy(report);
 else if(navigator.clipboard?.writeText)navigator.clipboard.writeText(report);
 $('ecuProject').textContent='Звіт скопійовано.';
}
function init(){
 $('ecuPrimary').addEventListener('change',e=>{if(e.target.files?.[0])analyze(e.target.files[0],'primary');});
 $('ecuReference').addEventListener('change',e=>{if(e.target.files?.[0])analyze(e.target.files[0],'reference');});
 $('ecuFind').addEventListener('click',searchLinks);
 $('ecuDeepFind').addEventListener('click',deepSearch);
 $('ecuToAI').addEventListener('click',insertIntoAsk);
 $('ecuSave').addEventListener('click',saveProject);
 $('ecuCopy').addEventListener('click',copyReport);
 $('ecuQuery').addEventListener('change',searchLinks);
 render();searchLinks();
}
window.TriMindECU={init,decode,entropy,stringsIn,intelHex,srec,diff,concise,buildSearchQuery,
 getState:()=>STATE};
})();
