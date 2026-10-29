"""Deterministic regression for adapted C++ binary reader. No real ECU needed."""
from pathlib import Path
import tempfile,subprocess,json,csv,struct
EXE=Path(__file__).with_name('hexplorer_xyz')

def run(defs,mem,base=0x800000,endian='BE'):
    with tempfile.TemporaryDirectory() as d:
        d=Path(d); (d/'ecu.bin').write_bytes(mem)
        with (d/'in.tsv').open('w',newline='') as h:
            w=csv.writer(h,delimiter='\t',lineterminator='\n');w.writerow(['name','type','address','layout','conversion','maxx','maxy','count','blob','fields']);w.writerows(defs)
        p=subprocess.run([str(EXE),str(d/'in.tsv'),str(d/'ecu.bin'),hex(base),endian,str(d/'out.jsonl')],capture_output=True,text=True)
        assert p.returncode==0,(p.stdout,p.stderr)
        return [json.loads(x) for x in (d/'out.jsonl').read_text().splitlines()]

def one(name,ty,off,layout,fields,maxx=10,maxy=10,count=0,blob=0):
    return [name,ty,hex(0x800000+off),layout,'Identity',maxx,maxy,count,blob,fields]

def test():
    be=lambda *x:b''.join(struct.pack('>h',v) for v in x)
    m=bytearray([255]*256)
    # Valid X(2), Y(2), X=[10,20],Y=[1,2],Z=[3,4,5,6]
    m[0:24]=be(2,2,10,20,1,2,3,4,5,6,0,0)
    m[50:60]=be(3,10,20,30,40)
    m[80:82]=be(-33)
    m[90:96]=bytes([5,7,9,11,13,15])
    m[120:124]=be(0,2) # invalid X count
    m[140:154]=be(3,2,10,5,8,1,2) # X nonmonotonic
    m[175:187]=be(2,2,10,20,2,1) # missing Z due to truncation with blob not pertinent
    defs=[
      one('m','MAP',0,'M','NO_AXIS_PTS_X:SWORD;NO_AXIS_PTS_Y:SWORD;AXIS_PTS_X:SWORD;AXIS_PTS_Y:SWORD;FNC_VALUES:SWORD'),
      one('curve','CURVE',50,'C','NO_AXIS_PTS_X:SWORD;AXIS_PTS_X:SWORD;FNC_VALUES:SWORD'),
      one('value','VALUE',80,'V','FNC_VALUES:SWORD'),
      one('vec','VAL_BLK',90,'A','FNC_VALUES:UBYTE',count=6),
      one('missing','VALUE',999,'V','FNC_VALUES:SWORD'),
      one('bad_dim','MAP',120,'M','NO_AXIS_PTS_X:SWORD;NO_AXIS_PTS_Y:SWORD;AXIS_PTS_X:SWORD;AXIS_PTS_Y:SWORD;FNC_VALUES:SWORD'),
      one('bad_max','CURVE',50,'C','NO_AXIS_PTS_X:SWORD;AXIS_PTS_X:SWORD;FNC_VALUES:SWORD',maxx=2),
      one('bad_blob','VALUE',80,'V','FNC_VALUES:SWORD',blob=1),
      one('no_count','VAL_BLK',90,'A','FNC_VALUES:UBYTE'),
      one('bad_mono','MAP',140,'M','NO_AXIS_PTS_X:SWORD;NO_AXIS_PTS_Y:SWORD;AXIS_PTS_X:SWORD;AXIS_PTS_Y:SWORD;FNC_VALUES:SWORD'),
      one('no_axis_count','CURVE',50,'C','AXIS_PTS_X:SWORD;FNC_VALUES:SWORD')
    ]
    r=run(defs,m);r={x['name']:x for x in r}
    checks=[
        ('map correct',r['m']['status']=='RAW_DECODED_UNVERIFIED_PAIR' and r['m']['x_raw']==[10,20] and r['m']['y_raw']==[1,2] and r['m']['z_raw']==[3,4,5,6]),
        ('curve correct',r['curve']['status']=='RAW_DECODED_UNVERIFIED_PAIR' and r['curve']['x_raw']==[10,20,30] and r['curve']['z_raw']==[40, -1, -1]),
        ('value signed',r['value']['z_raw']==[-33]),
        ('array count',r['vec']['z_raw']==[5,7,9,11,13,15]),
        ('missing memory rejected',r['missing']['reason']=='VALUE_BYTES_MISSING'),
        ('zero axis rejected',r['bad_dim']['reason']=='INVALID_AXIS_COUNT'),
        ('axis max bounded',r['bad_max']['reason']=='EXCEEDS_MAX_X'),
        ('explicit blob bounded',r['bad_blob']['reason']=='EXCEEDS_EXPLICIT_DP_BLOB'),
        ('missing number rejected',r['no_count']['reason']=='VAL_BLK_DECLARED_COUNT_MISSING'),
        ('non-monotonic axis rejected',r['bad_mono']['reason']=='NON_MONOTONIC_AXIS'),
        ('max not actual length',r['no_axis_count']['reason']=='AXIS_COUNT_NOT_EXPLICIT')
    ]
    for label,ok in checks:
        print(('PASS' if ok else 'FAIL'),label)
    assert all(v for k,v in checks)
    # Endian must change decoding, not guess
    a=run([one('le','VALUE',80,'V','FNC_VALUES:SWORD')],m,endian='LE')[0]
    assert a['z_raw'][0] != -33;print('PASS explicit endian')
    return len(checks)+1
if __name__=='__main__': print('TOTAL PASS:',test())
