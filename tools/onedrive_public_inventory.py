#!/usr/bin/env python3
"""Probe anonymous OneDrive shared-folder metadata; no downloads or writes to OneDrive."""
import base64, json, os, pathlib, urllib.error, urllib.parse, urllib.request
url=os.environ["ONEDRIVE_SHARE_URL"].strip()
out=pathlib.Path("output");out.mkdir(exist_ok=True)
token="u!"+base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")
base="https://api.onedrive.com/v1.0/shares/"+token+"/root"
def request(endpoint):
    req=urllib.request.Request(endpoint,headers={"Accept":"application/json","User-Agent":"TriMindECU-inventory/0.1"})
    try:
        with urllib.request.urlopen(req,timeout=40) as response:
            return json.load(response),response.status
    except urllib.error.HTTPError as e:
        return {"error":"HTTP "+str(e.code),"details":e.read(1000).decode("utf-8","replace")[:300]},e.code
    except Exception as e:
        return {"error":type(e).__name__,"details":str(e)[:300]},0
root,status=request(base)
report={"root_status":status,"root_type":"folder" if "folder" in root else "file" if "file" in root else "unknown","root_error":root.get("error")}
items=[]
if status==200 and "folder" in root:
    pending=[("",base+"/children")]
    while pending and len(items)<10000:
        prefix,endpoint=pending.pop(0)
        while endpoint and len(items)<10000:
            data,code=request(endpoint)
            if code!=200:
                report.setdefault("listing_errors",[]).append({"path":prefix,"status":code,"error":data.get("error")})
                break
            for item in data.get("value",[]):
                name=item.get("name","")
                path=prefix+"/"+name
                folder="folder" in item
                items.append({"path":path,"type":"folder" if folder else "file","size":item.get("size",0),"extension":pathlib.PurePosixPath(name).suffix.lower()})
                if folder:pending.append((path,base+"/children" if False else "https://api.onedrive.com/v1.0/shares/"+token+"/root:"+urllib.parse.quote(path,safe="/")+":/children"))
            endpoint=data.get("@odata.nextLink")
report["item_count"]=len(items)
report["file_count"]=sum(x["type"]=="file" for x in items)
report["folder_count"]=sum(x["type"]=="folder" for x in items)
report["truncated"]=len(items)>=10000
(out/"onedrive_probe.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
if items:
    (out/"onedrive_manifest.json").write_text(json.dumps(items,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
