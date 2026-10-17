#!/usr/bin/env python3
"""Forensic, read-only scan of ZIP local file headers when central directory is missing.
Candidates are not verified files. Never extracts data or publishes archive bytes.
"""
import csv, json, pathlib, struct, sys
from collections import Counter

def scan(path, output):
    path, output = pathlib.Path(path), pathlib.Path(output)
    output.mkdir(parents=True, exist_ok=True)
    signature=b"PK\x03\x04"
    rows=[]
    # mmap avoids loading 1.5 GB into Python heap.
    import mmap
    with path.open("rb") as f, mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
        pos=0
        while True:
            pos=mm.find(signature,pos)
            if pos<0: break
            if pos+30>len(mm): break
            try:
                sig,ver,flags,method,mtime,mdate,crc,csize,usize,nlen,xlen=struct.unpack_from("<IHHHHHIIIHH",mm,pos)
                end=pos+30+nlen+xlen
                if not (0<nlen<=4096 and end<=len(mm) and method in (0,8,12,14,93,95,98,99)):
                    pos+=4;continue
                name=bytes(mm[pos+30:pos+30+nlen]).decode("utf-8" if flags & 0x800 else "cp437",errors="replace")
                if not name or "\\x00" in name or any(ord(ch)<32 for ch in name):
                    pos+=4;continue
                rows.append({"offset":pos,"path":name,"method":method,"flags":flags,"declared_compressed_size":csize,"declared_size":usize,"descriptor":bool(flags & 8)})
            except (ValueError,struct.error):
                pass
            pos+=4
    with (output/"recovery_candidates.csv").open("w",encoding="utf-8",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=["offset","path","method","flags","declared_compressed_size","declared_size","descriptor"])
        writer.writeheader();writer.writerows(rows)
    suffixes=Counter(pathlib.PurePosixPath(r["path"]).suffix.lower() or "(none)" for r in rows)
    report={"status":"forensic_candidates_unverified","archive_bytes":path.stat().st_size,
            "candidate_count":len(rows),"extensions":dict(suffixes.most_common()),
            "warning":"ZIP central directory absent. Entries found by signatures may be incomplete or false positives; CRC and data extraction not validated."}
    (output/"recovery_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":
    scan(sys.argv[1],sys.argv[2])
