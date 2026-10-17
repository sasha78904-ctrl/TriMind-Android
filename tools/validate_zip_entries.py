#!/usr/bin/env python3
"""Read-only validation of ZIP local entries without a central directory.
Streams DEFLATE; validates CRC against data descriptors; never exports ECU payloads.
"""
import csv, json, mmap, pathlib, struct, sys, zlib
from collections import Counter

SIG=b"PK\x03\x04"
def main(source, out):
    source=pathlib.Path(source);out=pathlib.Path(out);out.mkdir(parents=True,exist_ok=True)
    rows=[]; verified=0; broken=0
    with source.open("rb") as f, mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as mm:
        pos=0
        while (pos:=mm.find(SIG,pos))>=0:
            if pos+30>len(mm): break
            try:
                _,_,flags,method,_,_,expected_crc,compressed,uncompressed,nlen,xlen=struct.unpack_from("<IHHHHHIIIHH",mm,pos)
                start=pos+30+nlen+xlen
                if nlen<1 or nlen>4096 or start>=len(mm) or method not in (0,8):
                    pos+=4;continue
                name=bytes(mm[pos+30:pos+30+nlen]).decode("utf-8" if flags&0x800 else "cp437","replace")
                if not name or any(ord(c)<32 for c in name):pos+=4;continue
                row={"path":name,"offset":pos,"method":method,"status":"unsupported","uncompressed_bytes":0,"crc32":""}
                if method==8 and not(flags&1):
                    decoder=zlib.decompressobj(-15)
                    offset=start;crc=0;size=0
                    try:
                        while offset<len(mm):
                            chunk=mm[offset:min(offset+1024*1024,len(mm))]
                            if not chunk:break
                            data=decoder.decompress(chunk)
                            consumed=len(chunk)-len(decoder.unused_data)
                            offset+=consumed
                            size+=len(data);crc=zlib.crc32(data,crc)
                            if size>8*1024**3:raise ValueError("size safety limit")
                            if decoder.eof:break
                            if consumed==0:raise ValueError("decoder stalled")
                        if not decoder.eof:raise ValueError("incomplete DEFLATE stream")
                        row.update(uncompressed_bytes=size,crc32=f"{crc:08x}",status="stream_complete_unverified")
                        if flags&8:
                            d=offset+4 if mm[offset:offset+4]==b"PK\x07\x08" else offset
                            if d+12<=len(mm):
                                dcrc,dcsize,dusize=struct.unpack_from("<III",mm,d)
                                if dcrc==crc and dusize==size and dcsize==offset-start:
                                    row["status"]="crc_verified"
                        elif crc==expected_crc and size==uncompressed:
                            row["status"]="crc_verified"
                    except Exception as exc:
                        row["status"]="damaged: "+str(exc)[:100]
                rows.append(row)
                if row["status"]=="crc_verified":verified+=1
                elif row["status"].startswith("damaged"):broken+=1
            except (ValueError,struct.error):
                pass
            pos+=4
    with (out/"validated_entries.csv").open("w",encoding="utf-8",newline="") as f:
        w=csv.DictWriter(f,fieldnames=["path","offset","method","status","uncompressed_bytes","crc32"])
        w.writeheader();w.writerows(rows)
    result={"candidate_count":len(rows),"crc_verified":verified,"damaged":broken,
            "statuses":dict(Counter(r["status"] for r in rows)),
            "note":"CRC verification checks ZIP entry integrity, not nested ZIP contents. No data files exported."}
    (out/"validation_report.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(result,ensure_ascii=False))
if __name__=="__main__":main(sys.argv[1],sys.argv[2])
