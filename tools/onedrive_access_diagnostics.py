#!/usr/bin/env python3
"""Read-only OneDrive share accessibility diagnostics. No file payloads are downloaded."""
import base64,json,os,pathlib,urllib.request,urllib.error,urllib.parse
url=os.environ["ONEDRIVE_SHARE_URL"].strip()
out=pathlib.Path("output");out.mkdir(exist_ok=True)
token="u!"+base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")
checks=[
 ("onedrive_v1","https://api.onedrive.com/v1.0/shares/"+token+"/root"),
 ("graph_v1","https://graph.microsoft.com/v1.0/shares/"+token+"/driveItem"),
 ("share_web",url)
]
results=[]
for label,endpoint in checks:
 req=urllib.request.Request(endpoint,headers={"User-Agent":"Mozilla/5.0 (compatible; TriMindInventory/1.0)","Accept":"application/json" if label!="share_web" else "text/html"})
 try:
  with urllib.request.urlopen(req,timeout=35) as response:
   payload=response.read(131072)
   ct=response.headers.get("Content-Type","")
   result={"method":label,"http_status":response.status,"content_type":ct.split(";")[0],"final_host":urllib.parse.urlparse(response.url).hostname,"bytes_sampled":len(payload)}
   if "json" in ct:
    try:
     data=json.loads(payload)
     result["item_type"]="folder" if "folder" in data else "file" if "file" in data else "unknown"
     result["item_name"]=data.get("name")
    except Exception:result["json_parse"]="incomplete"
   elif label=="share_web":
    result["page_reachable"]=True
   results.append(result)
 except urllib.error.HTTPError as e:results.append({"method":label,"http_status":e.code,"error":"HTTP "+str(e.code)})
 except Exception as e:results.append({"method":label,"error":type(e).__name__,"detail":str(e)[:120]})
report={"checks":results,"note":"HTTP 200 HTML means the share page opens, not that programmatic listing is supported. No source files modified."}
(out/"onedrive_access_diagnostics.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
