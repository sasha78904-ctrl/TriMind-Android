// Read-only ECU analysis regression. Synthetic dumps; no user firmware in repository.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app/src/main/assets/ecu.js','utf8');
const window={};
const fakeElement=()=>({value:'',textContent:'',files:[],children:[],addEventListener(){},
 replaceChildren(){this.children=[]},appendChild(x){this.children.push(x);return x}});
const elements={};
const document={getElementById:id=>elements[id]||(elements[id]=fakeElement()),
 createElement:()=>({ ...fakeElement(),href:'',target:'',rel:''})};
const context={window,document,crypto:webcrypto,console,Math,Date,Uint8Array,Uint32Array,ArrayBuffer,
 navigator:{},URL,encodeURIComponent,globalThis:null};
delete context.globalThis;
vm.createContext(context);vm.runInContext(source,context);
const ecu=window.TriMindECU;
assert(ecu,'ecu extension missing');
const mock=(name,bytes)=>({
 name,size:bytes.length, arrayBuffer:async()=>Uint8Array.from(bytes).buffer,
 text:async()=>Buffer.from(bytes).toString('utf8')
});
async function main(){
 const base=new Uint8Array(1024*1024);base.fill(255);
 base.set(Buffer.from('Bosch.p_321.Project.EDC16.A000','ascii'),0xEA57);
 base.set(Buffer.from('1037376898P467/121','ascii'),0x50);
 // Synthetic nontrivial section, resembling code; not an actual firmware.
 for(let i=0;i<2300;i++)base[0x10000+i]=(i*47)&255;
 const first=await ecu.decode(mock('mers nov',base));
 assert.equal(first.format,'Raw binary');
 assert.equal(first.bytes.length,1024*1024);
 assert(first.strings.some(s=>s.text.includes('EDC16')));
 assert(first.strings.some(s=>s.text.includes('1037376898')));
 assert.equal(first.sha256.length,64);
 assert.equal(first.blocks.length,128);
 assert.equal(ecu.entropy(new Uint8Array(4096)),0);
 assert.match(ecu.concise(first),/Bosch\.p_321\.Project\.EDC16/);
 assert.match(ecu.concise(first),/не доводять оригінальність/);
 const changed=Uint8Array.from(base); changed[0x20010]^=0x7f;changed[0x20011]^=0x31;
 const reference=await ecu.decode(mock('original.bin',changed));
 const comparison=ecu.diff(first,reference);
 assert.equal(comparison.changed,2);
 assert.equal(comparison.regions,1);
 assert.equal(comparison.largest[0].start,0x20010);
 assert(!comparison.identical);
 assert(ecu.diff(first,first).identical);
 const ihex=ecu.intelHex(':0100000001FE\n:00000001FF');
 assert.equal(ihex.bytes[0],1);
 assert.equal(ihex.parseErrors,0);
 const corrupted=ecu.intelHex(':0100000001FD\n:00000001FF');
 assert.equal(corrupted.parseErrors,1);
 const srec=ecu.srec('S104000001FA');
 assert.equal(srec.bytes[0],1);
 assert.equal(srec.parseErrors,0);
 const invalid=mock('unknown.frf',Buffer.alloc(50));
 await assert.rejects(()=>ecu.decode(invalid),/Підтримано аналіз/);
 await assert.rejects(()=>ecu.decode({...mock('huge.bin',[1]),size:34*1024*1024}),/32 МБ/);
 assert(ecu.buildSearchQuery().length<181);
 ecu.init();
 assert(elements.ecuSources.children.length>=10,'Real targeted search links must be exposed');
 assert(elements.ecuSources.children.every(x=>x.href?.startsWith('https://')));
 console.log('ECU parser, checksum, SHA, ID, diff, and search-link tests passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});