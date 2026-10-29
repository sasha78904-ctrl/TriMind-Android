#!/usr/bin/env python3
"""Export A2L-declared MAP schemas to TSV; this preparatory step uses TriMind A2L parser, NOT HEXplorer."""
import sys,json
from pathlib import Path
sys.path.insert(0, '/mnt/data')
from trimind_decoder_v05 import load_v05
base=Path('/mnt/data/hexplorer_shadow_realtest')
p=load_v05('/mnt/data/edc16_13.a2l.bin')
with (base/'mapspec.tsv').open('w',encoding='utf-8') as f:
 for m in p['maps']:
  a=m.get('axis',[])
  if len(a)<2:continue
  layout=p['record_layouts'].get(m['record_layout']) or []
  st=';'.join(x['field']+':'+x['datatype'] for x in layout)
  if not st:continue
  f.write('\t'.join(map(str,[m['name'],hex(m['address']),a[0].get('maximum_points') or 0,a[1].get('maximum_points') or 0,st]))+'\n')
print('map specs',len((base/'mapspec.tsv').read_text().splitlines()),'byteorder',p['byte_order'])