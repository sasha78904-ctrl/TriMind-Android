#!/usr/bin/env python3
"""Read-only quality audit of structurally decoded A2L maps; NOT ECU identity verification."""
import argparse, json, math, collections
from pathlib import Path

def audit(report):
    rows=[]; counts=collections.Counter()
    for m in report.get("examples",[]):
        issues=[]
        for i,axis in enumerate(m.get("axes",[])):
            v=axis.get("raw",[])
            if len(v)!=axis.get("count"): issues.append(f"axis_{i}_length_mismatch")
            if len(set(v))<2: issues.append(f"axis_{i}_constant")
            if any(v[j]>v[j+1] for j in range(len(v)-1)): issues.append(f"axis_{i}_decreasing")
            if len(v)>1 and len(set(v))<=len(v)//4: issues.append(f"axis_{i}_low_diversity")
            if axis.get("physical") and any(t is not None and not math.isfinite(t) for t in axis["physical"]): issues.append(f"axis_{i}_nonfinite")
        z=m.get("z_raw",[])
        n=math.prod(m.get("dimensions",[]))
        if len(z)!=n: issues.append("z_length_mismatch")
        if len(set(z))==1: issues.append("z_constant")
        if m.get("z_physical") and any(t is not None and not math.isfinite(t) for t in m["z_physical"]): issues.append("z_nonfinite")
        for issue in issues: counts[issue]+=1
        rows.append({"name":m.get("name"),"address":m.get("address"),"dimensions":m.get("dimensions"),"issues":issues,"structural_quality":"review_required" if issues else "no_simple_anomaly_detected"})
    return {"maps_audited":len(rows),"maps_flagged":sum(bool(x["issues"]) for x in rows),"issue_counts":dict(counts),"rows":rows,
    "warning":"No anomalies does NOT validate A2L/BIN identity, map address translation, physical values, orientation, or tuning safety."}
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("report");p.add_argument("--out",required=True);a=p.parse_args()
    r=audit(json.loads(Path(a.report).read_text()))
    Path(a.out).write_text(json.dumps(r,ensure_ascii=False,indent=2))
    print(json.dumps({k:r[k] for k in ("maps_audited","maps_flagged","issue_counts")}))
