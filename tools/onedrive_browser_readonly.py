#!/usr/bin/env python3
"""Read-only inspection of OneDrive public share with Playwright."""
import asyncio,json,os,pathlib
from urllib.parse import urlparse
from playwright.async_api import async_playwright
async def main():
 out=pathlib.Path("output");out.mkdir(exist_ok=True)
 report={"read_only":True}
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  page=await browser.new_page(locale="en-US")
  try:
   await page.goto(os.environ["SHARE_URL"],wait_until="domcontentloaded",timeout=60000)
   await page.wait_for_timeout(10000)
   report["title"]=await page.title()
   report["host"]=urlparse(page.url).hostname
   report["visible_text"]=(await page.locator("body").inner_text())[:12000]
   report["links"]=(await page.locator("a").all_text_contents())[:100]
   await page.screenshot(path=str(out/"onedrive_view.png"))
  except Exception as e:report["error"]=str(e)[:300]
  await browser.close()
 (out/"onedrive_browser.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps({"title":report.get("title"),"host":report.get("host"),"text_chars":len(report.get("visible_text","")),"error":report.get("error")},ensure_ascii=False))
asyncio.run(main())
