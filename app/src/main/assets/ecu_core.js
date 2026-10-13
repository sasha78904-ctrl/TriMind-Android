/*
 TriMind ECU Pro 4.0 — static analysis, provenance-aware references, calibration
 descriptors, diagnostic file triage. No ECU writes, no OEM checksum claims.
*/
(function(){
'use strict';
const ECU=()=>window.TriMindECU;
const el=id=>document.getElementById(id);
const LIMIT_BYTES=32*1024*1024;
const families=[
 {name:'Bosch EDC15',rx:/\bEDC[\s._-]?15(?:[A-Z0-9]*)\b/i,manufacturer:'Bosch',architecture:'Залежить від ревізії — не встановлено'},
 {name:'Bosch EDC16',rx:/\bEDC[\s._-]?16(?:[A-Z0-9]*)\b/i,manufacturer:'Bosch',architecture:'Часто PowerPC/MPC5xx; саме цей дамп не ідентифіковано'},
 {name:'Bosch EDC17',rx:/\bEDC[\s._-]?17(?:[A-Z0-9]*)\b/i,manufacturer:'Bosch',architecture:'Часто TriCore; перевірити HW'},
 {name:'Bosch MD1',rx:/\bMD1[A-Z0-9_-]*\b/i,manufacturer:'Bosch',architecture:'Залежить від HW'},
 {name:'Bosch MG1',rx:/\bMG1[A-Z0-9_-]*\b/i,manufacturer:'Bosch',architecture:'Залежить від HW'},
 {name:'Bosch MED',rx:/\bMED[\s._-]?\d+[A-Z0-9.]*\b/i,manufacturer:'Bosch',architecture:'Залежить від HW'},
 {name:'Siemens/Continental SID',rx:/\bSID[\s._-]?\d{2,4}[A-Z]?\b/i,manufacturer:'Siemens/Continental',architecture:'Невідомо'},
 {name:'Delphi DCM',rx:/\bDCM[\s._-]?\d[A-Z0-9.]*\b/i,manufacturer:'Delphi',architecture:'Невідомо'},
 {name:'Bosch ME',rx:/\bME[\s._-]?[79](?:[.\dA-Z]+)?\b/i,manufacturer:'Bosch',architecture:'Залежить від HW'}
];
function identify(report){
 if(!report)return {status:'no-file',candidates:[],evidence:[]};
 const strings=(report.strings||[]).map(x=>x.text).join('\n');
 const name=report.name||'';
 const corpus=strings+'\n'+name;
 const candidates=[];
 for(const fam of families){
  const m=corpus.match(fam.rx);
  if(m){
   candidates.push({family:fam.name,manufacturer:fam.manufacturer,
    architecture:fam.architecture,marker:m[0],
    confidence:strings.match(fam.rx)?'підтверджено рядком у дампі — сімейство імовірне':
     'лише ім’я файла — низька достовірність'});
  }
 }
 const idStrings=(report.strings||[]).filter(x=>
   /\b(?:1037\d{6}[A-Za-z0-9/.-]*|0\s?281\s?\d{3}\s?\d{3}|0281\d{6}|SW[:\s]|HW[:\s]|A\s?\d{10})\b/i.test(x.text))
    .slice(0,20).map(x=>({offset:x.offset,value:x.text.slice(0,130)}));
 return {status:candidates.length?'heuristic-family':'unknown',candidates,
  evidence:idStrings,checksumStatus:'OEM checksum НЕ перевірено',
  originality:'Статус OEM/modified не визначено без довіреного точного еталона.'};
}
function crc32(bytes){
 let crc=0xFFFFFFFF;
 for(const b of bytes){
  crc^=b;
  for(let i=0;i<8;i++)crc=(crc&1)?((crc>>>1)^0xEDB88320):(crc>>>1);
 }
 return (crc^0xFFFFFFFF)>>>0;
}
const crcHex=bytes=>crc32(bytes).toString(16).toUpperCase().padStart(8,'0');
function inspectHex(bytes,offset=0,length=192){
 if(!(bytes instanceof Uint8Array))throw Error('Немає даних прошивки.');
 offset=Math.max(0,Math.min(bytes.length,Number(offset)||0));
 length=Math.max(16,Math.min(1024,Number(length)||192));
 let lines=[];
 for(let p=offset;p<Math.min(bytes.length,offset+length);p+=16){
  const cells=bytes.slice(p,p+16);
  lines.push(p.toString(16).toUpperCase().padStart(8,'0')+'  '+
    [...cells].map(x=>x.toString(16).toUpperCase().padStart(2,'0')).join(' ').padEnd(47)+
    '  '+[...cells].map(x=>x>=32&&x<127?String.fromCharCode(x):'.').join(''));
 }
 return lines.join('\n');
}
function alignedDiff(a,b){
 const A=a?.bytes,B=b?.bytes;
 if(!A||!B)return null;
 const aStart=Number(a.address)||0,bStart=Number(b.address)||0;
 const lo=Math.max(aStart,bStart),hi=Math.min(aStart+A.length,bStart+B.length);
 if(lo>=hi)return {overlap:0,changed:0,ranges:[],warning:'Адресні простори не перетинаються. Невідомий base offset.'};
 let changed=0,run=-1,ranges=[];
 for(let abs=lo;abs<hi;abs++){
  if(A[abs-aStart]!==B[abs-bStart]){
   changed++;if(run===-1)run=abs;
  }else if(run!==-1){
   ranges.push({start:run,end:abs,length:abs-run});run=-1;
  }
 }
 if(run!==-1)ranges.push({start:run,end:hi,length:hi-run});
 return {overlap:hi-lo,changed,ranges:ranges.sort((x,y)=>y.length-x.length).slice(0,60),
  aStart,bStart,identical:changed===0&&A.length===B.length&&aStart===bStart,
  warning:(aStart!==bStart?'Вирівняно за адресами з форматів файлів; перевір відповідність сегментів.':
   'Для сирих BIN базова адреса 0 за припущенням. Різні розкладки пам’яті можуть зіпсувати порівняння.')};
}
function numberField(s){
 const x=String(s||'').trim();
 if(/^0x[0-9a-f]+$/i.test(x))return parseInt(x,16);
 if(/^[0-9]+$/i.test(x))return Number(x);
 return NaN;
}
function finiteRange(offset,bitCount,rows,cols,size){
 const n=Math.ceil(bitCount/8)*rows*cols;
 return Number.isSafeInteger(offset)&&offset>=0&&[8,16,32].includes(bitCount)&&
   Number.isInteger(rows)&&Number.isInteger(cols)&&rows>0&&cols>0&&
   rows*cols<=4096&&Number.isSafeInteger(n)&&offset+n<=size;
}
function physicalExpr(expression){
 const eq=String(expression||'X').trim().replace(/\s+/g,'').toUpperCase();
 if(eq==='X')return {factor:1,shift:0,supported:true};
 // Deliberately accept only a small set of mathematically unambiguous linear equations.
 const num='([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:E[+-]?\\d+)?)';
 let m=eq.match(new RegExp('^X\\*'+num+'(?:\\+'+num+')?$'));
 if(m)return {factor:Number(m[1]),shift:Number(m[2]||0),supported:true};
 m=eq.match(new RegExp('^'+num+'\\*X(?:\\+'+num+')?$'));
 if(m)return {factor:Number(m[1]),shift:Number(m[2]||0),supported:true};
 m=eq.match(new RegExp('^X/'+num+'$'));
 if(m&&Number(m[1])!==0)return {factor:1/Number(m[1]),shift:0,supported:true};
 m=eq.match(new RegExp('^X\\+'+num+'$'));
 if(m)return {factor:1,shift:Number(m[1]),supported:true};
 m=eq.match(new RegExp('^X-'+num.replace('[+-]?','')+'$'));
 if(m)return {factor:1,shift:-Number(m[1]),supported:true};
 return {factor:1,shift:0,supported:false};
}
function readCell(bytes,offset,bits=8,little=false,signed=false){
 const size=bits/8;
 if(!finiteRange(offset,bits,1,1,bytes.length))throw Error('Комірка поза адресним діапазоном.');
 let val=0;
 for(let i=0;i<size;i++){
  const index=little?offset+i:offset+size-i-1;
  val+=bytes[index]*(2**(8*i));
 }
 if(signed&&val>=2**(bits-1))val-=2**bits;
 return val;
}
function parseXdf(xml,bytes){
 if(typeof DOMParser==='undefined')throw Error('XML-парсер Android WebView недоступний.');
 if(xml.length>4*1024*1024)throw Error('XDF більше 4 МБ.');
 const dom=new DOMParser().parseFromString(xml,'application/xml');
 if(dom.querySelector('parsererror'))throw Error('XDF містить некоректний XML.');
 if(!dom.querySelector('XDFFORMAT,XDFHEADER'))throw Error('Це не TunerPro XDF.');
 const entries=[],notes=[];
 const nodes=dom.querySelectorAll('XDFTABLE,XDFCONSTANT');
 for(const table of [...nodes].slice(0,250)){
  const type=table.tagName==='XDFTABLE'?'table':'constant';
  const axis=type==='table'?table.querySelector('XDFAXIS[id="z"]'):table;
  const embedded=axis?.querySelector('EMBEDDEDDATA');
  const title=table.querySelector('title')?.textContent?.trim()||'Без назви';
  const info={name:title.slice(0,120),kind:type,address:null,valid:false,values:[],rows:0,cols:0,
    formula:'',unit:axis?.querySelector('units')?.textContent?.trim()||'',warning:''};
  if(!embedded){info.warning='Відсутній EMBEDDEDDATA';entries.push(info);continue;}
  const addr=numberField(embedded.getAttribute('mmedaddress'));
  const bits=numberField(embedded.getAttribute('mmedelementsizebits')||'8');
  const rows=type==='table'?numberField(embedded.getAttribute('mmedrowcount')||'1'):1;
  const cols=type==='table'?numberField(embedded.getAttribute('mmedcolcount')||'1'):1;
  const flags=numberField(embedded.getAttribute('mmedtypeflags')||'0');
  const equation=axis.querySelector('MATH')?.getAttribute('equation')||'X';
  const linear=physicalExpr(equation);
  info.address=addr;info.rows=rows;info.cols=cols;info.formula=equation;
  const isComplex=embedded.hasAttribute('mmedmajorstridebits') &&
    numberField(embedded.getAttribute('mmedmajorstridebits'))!==0 ||
    embedded.hasAttribute('mmedminorstridebits')&&
    numberField(embedded.getAttribute('mmedminorstridebits'))!==0;
  const hasBaseOffset=!!dom.querySelector('BASEOFFSET');
  if(isComplex||hasBaseOffset){
   info.warning='XDF має нестандартні страйди або BASEOFFSET — автоматичне читання вимкнене.';
  }else if(!finiteRange(addr,bits,rows,cols,bytes.length)){
   info.warning='Невірна адреса/розміри або невідома розкладка бінарного файлу.';
  }else if(!linear.supported){
   info.warning='Нелінійна формула XDF не підтримана; показано лише метадані.';
  }else{
   // mmedtypeflags differs by XDF versions. Do not infer sign/endian from flags.
   info.warning='Значення прочитані як unsigned big-endian за припущенням. Перевір тип і порядок байтів у XDF.';
   info.valid=true;
   const values=[];
   for(let i=0;i<rows*cols;i++){
    const raw=readCell(bytes,addr+i*bits/8,bits,false,false);
    values.push(Number((raw*linear.factor+linear.shift).toFixed(4)));
   }
   info.values=values.slice(0,1024);
   info.minimum=Math.min(...values);info.maximum=Math.max(...values);
   info.average=Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(3));
  }
  entries.push(info);
 }
 notes.push('XDF у різних редакціях використовує BASEOFFSET, stride, datatype, bit flags. '+
  'Тут реалізована лише обмежена підмножина послідовних значень, без гарантій сумісності.');
 return {type:'XDF',count:nodes.length,entries,notes};
}
function parseA2l(text){
 if(text.length>4*1024*1024)throw Error('A2L більше 4 МБ.');
 if(!/ASAP2_VERSION|\/begin\s+PROJECT/i.test(text))throw Error('Не розпізнано ASAM A2L.');
 const rx=/\/begin\s+CHARACTERISTIC\s+([A-Za-z0-9_]+)\s+"([^"]*)"\s+(VALUE|CURVE|MAP|CUBOID|VAL_BLK|ASCII)\s+(0x[0-9a-fA-F]+|\d+)\s+([A-Za-z0-9_]+)/g;
 const entries=[];let m;
 while((m=rx.exec(text))&&entries.length<450){
  entries.push({name:m[1],description:m[2].slice(0,180),kind:m[3],
    address:numberField(m[4]),recordLayout:m[5],valid:false,
    warning:'Адреса ECU не дорівнює офсету BIN без memory mapping, RECORD_LAYOUT та COMPU_METHOD.'});
 }
 return {type:'A2L',entries,count:entries.length,
  notes:['Це попередній індекс CHARACTERISTIC. Без RECORD_LAYOUT, COMPU_METHOD, адресної мапи та осей фізичні значення НЕ декодуються.',
   'Офіційний формат: ASAM MCD-2 MC. Повна валідація A2L у цьому випуску недоступна.']};
}
function parseDiagnostic(text){
 const lines=String(text||'').slice(0,800000).split(/\r?\n/);
 const dtc=[...new Set((text.match(/\b[PCBU][0-3][0-9A-F]{3}\b/gi)||[]).map(x=>x.toUpperCase()))].slice(0,80);
 const delimiter=lines[0]?.includes(';')?';':',';
 const names=(lines[0]||'').split(delimiter).map(x=>x.replace(/^"|"$/g,'').trim()).slice(0,35);
 const stats=[];
 if(lines.length>=3&&names.length>=2){
  for(let col=0;col<names.length;col++){
   const sample=[];
   for(let i=1;i<Math.min(2001,lines.length);i++){
    const cells=lines[i].split(delimiter);
    const v=Number((cells[col]||'').trim().replace(/^"|"$/g,'').replace(',','.'));
    if((cells[col]||'').trim()!==''&&Number.isFinite(v))sample.push(v);
   }
   if(sample.length>=3&&sample.length>=Math.min(10,lines.length-1)*0.5){
    stats.push({column:names[col],count:sample.length,min:Math.min(...sample),
      max:Math.max(...sample),mean:Number((sample.reduce((a,b)=>a+b,0)/sample.length).toFixed(4))});
   }
  }
 }
 return {rows:lines.length,dtc,statistics:stats.slice(0,25),
  warning:'CSV-парсер базовий, без підтримки лапок із вкладеними розділювачами; OBD/UDS не підключено. DTC не означає доведену причину поломки.'};
}
function calibrationReport(parsed){
 if(!parsed)return '';
 return parsed.type+' — індекс '+parsed.count+' визначень\n'+
 parsed.entries.slice(0,45).map(x=>x.name+' · '+x.kind+
  (x.address!=null?' · 0x'+x.address.toString(16).toUpperCase():'')+
  (x.valid?' · діапазон: '+x.minimum+'..'+x.maximum:'')+
  (x.warning?' · '+x.warning:'')).join('\n')+
 '\nОБМЕЖЕННЯ:\n'+parsed.notes.join('\n');
}
window.TriMindECUCore={families,identify,crc32,crcHex,inspectHex,alignedDiff,
 numberField,readCell,physicalExpr,parseXdf,parseA2l,parseDiagnostic,calibrationReport};
})();
