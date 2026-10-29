// SPDX-License-Identifier: GPL-3.0-or-later
// TriMind experimental native BIN reader, functionally adapted from HEXplorer
// HexFile::getDecValues; original HEXplorer Data::readHexValues NOT linked.
// Paired with genuine native HEXplorer A2L parse exported JSON and explicit A2L layouts.
// Reads only. No ECU writes. No zero-filling. No guessed MAX_AXIS_PTS dimensions.
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <map>
#include <sstream>
#include <string>
#include <vector>
using namespace std;
struct Part {string key,dt;};
struct Def {string name,type,layout,conversion;uint64_t address;int maxx,maxy,count,blob;vector<Part> parts;};
struct R {string status="UNSUPPORTED",reason="NO_SUPPORTED_LAYOUT";vector<double>x,y,z;int nx=0,ny=0;size_t bytes=0;};
static vector<string> split(string s,char delim){vector<string>v;istringstream ss(s);string p;while(getline(ss,p,delim))v.push_back(p);return v;}
static string esc(const string&s){string o="\"";for(unsigned char c:s){if(c=='"'||c=='\\'){o+='\\';o+=c;}else if(c=='\n')o+="\\n";else if(c=='\r')o+="\\r";else if(c=='\t')o+="\\t";else if(c<32)o+=' ';else o+=c;}return o+'"';}
static string arr(const vector<double>&v){ostringstream out;out<<setprecision(15)<<'[';for(size_t i=0;i<v.size();i++){if(i)out<<',';if(isfinite(v[i]))out<<v[i];else out<<"null";}return out.str()+']';}
struct Memory{
 vector<unsigned char> d;uint64_t base=0;bool big=true;
 bool covered(uint64_t addr,size_t n)const {return addr>=base && addr-base<=d.size() && n<=d.size()-(addr-base);}
 static int width(const string&dt){if(dt=="SBYTE"||dt=="UBYTE")return 1;if(dt=="SWORD"||dt=="UWORD")return 2;if(dt=="SLONG"||dt=="ULONG"||dt=="FLOAT32_IEEE")return 4;return 0;}
 bool read(uint64_t addr,const string&dt,double&v)const{
  int n=width(dt);if(n==0 || !covered(addr,n))return false;
  uint32_t w=0;for(int i=0;i<n;i++){uint8_t b=d[addr-base+i];if(big)w=(w<<8)|b;else w|=(uint32_t)b<<(8*i);}
  if(dt=="SBYTE")v=(int8_t)w;
  else if(dt=="SWORD")v=(int16_t)w;
  else if(dt=="SLONG")v=(int32_t)w;
  else if(dt=="FLOAT32_IEEE"){float f;static_assert(sizeof(f)==4,"");memcpy(&f,&w,4);v=f;return isfinite(v);}
  else v=w;
  return true;
 }
};
static bool mono(const vector<double>&v){bool inc=true,dec=true;for(size_t i=1;i<v.size();i++){inc&=v[i]>=v[i-1];dec&=v[i]<=v[i-1];}return inc||dec;}
static R decode(const Def&d,const Memory&m){
 R r;uint64_t off=d.address;int nx=0,ny=0;
 auto fail=[&](const string&why){r.reason=why;return r;};
 if(d.parts.empty())return fail("LAYOUT_MISSING");
 if(d.type!="MAP"&&d.type!="CURVE"&&d.type!="VALUE"&&d.type!="VAL_BLK")return fail("UNSUPPORTED_TYPE");
 for(const Part &p:d.parts){
  int sz=Memory::width(p.dt);if(!sz)return fail("UNSUPPORTED_DATATYPE");
  if(p.key=="NO_AXIS_PTS_X"||p.key=="NO_AXIS_PTS_Y"){
   double v=0;if(!m.read(off,p.dt,v))return fail("MISSING_COUNT_BYTES");off+=sz;
   if(v!=floor(v)||v<1||v>512)return fail("INVALID_AXIS_COUNT");
   if(p.key=="NO_AXIS_PTS_X"){nx=(int)v;if(d.maxx>0&&nx>d.maxx)return fail("EXCEEDS_MAX_X");}
   else{ny=(int)v;if(d.maxy>0&&ny>d.maxy)return fail("EXCEEDS_MAX_Y");}
  }else if(p.key=="AXIS_PTS_X"||p.key=="AXIS_PTS_Y"){
   bool xx=p.key=="AXIS_PTS_X";int count=xx?nx:ny;
   if(count<=0)return fail("AXIS_COUNT_NOT_EXPLICIT");
   auto &out=xx?r.x:r.y;
   for(int i=0;i<count;i++){double v;if(!m.read(off,p.dt,v))return fail("AXIS_BYTES_MISSING");out.push_back(v);off+=sz;}
  }else if(p.key=="FNC_VALUES"){
   int count=0;
   if(d.type=="MAP") {if(nx<1||ny<1)return fail("MAP_DIMENSIONS_MISSING");count=nx*ny;}
   else if(d.type=="CURVE") {if(nx<1)return fail("CURVE_COUNT_MISSING");count=nx;}
   else if(d.type=="VALUE")count=1;
   else if(d.type=="VAL_BLK") {if(d.count<1||d.count>262144)return fail("VAL_BLK_DECLARED_COUNT_MISSING");count=d.count;}
   if((uint64_t)count*sz>1048576)return fail("IMPOSSIBLE_ARRAY_SIZE");
   for(int i=0;i<count;i++){double v;if(!m.read(off,p.dt,v))return fail("VALUE_BYTES_MISSING");r.z.push_back(v);off+=sz;}
  }else return fail("UNSUPPORTED_RECORD_LAYOUT_FIELD");
 }
 if(r.z.empty())return fail("NO_FNC_VALUES");
 if(d.type=="MAP"&&((int)r.x.size()!=nx||(int)r.y.size()!=ny||(int)r.z.size()!=nx*ny))return fail("INCOMPLETE_MAP");
 if(d.type=="CURVE"&&((int)r.x.size()!=nx||(int)r.z.size()!=nx))return fail("INCOMPLETE_CURVE");
 if((d.type=="MAP"||d.type=="CURVE")&&(!mono(r.x)||!mono(r.y)))return fail("NON_MONOTONIC_AXIS");
 if(d.blob>0 && off-d.address>(uint64_t)d.blob)return fail("EXCEEDS_EXPLICIT_DP_BLOB");
 r.status="RAW_DECODED_UNVERIFIED_PAIR";r.reason="";r.nx=nx;r.ny=ny;r.bytes=off-d.address;return r;
}
int main(int argc,char**argv){
 if(argc!=6){cerr<<"Usage: xyz native_manifest.tsv source.bin base_hex endian(BE|LE) output.jsonl\n";return 64;}
 Memory mem;mem.base=stoull(argv[3],nullptr,0);mem.big=string(argv[4])=="BE";
 if(string(argv[4])!="BE"&&string(argv[4])!="LE")return 65;
 ifstream inbin(argv[2],ios::binary);if(!inbin){cerr<<"cannot read binary\n";return 66;}
 mem.d=vector<unsigned char>(istreambuf_iterator<char>(inbin),{});
 if(mem.d.empty())return 67;
 ifstream defs(argv[1]);ofstream dst(argv[5]);if(!defs||!dst)return 68;
 map<string,int> summary;string line;int total=0;
 while(getline(defs,line)){
  auto f=split(line,'\t');if(f.size()!=10)continue;
  if(f[0]=="name")continue;
  Def d;try{
   d.name=f[0];d.type=f[1];d.address=stoull(f[2],nullptr,0);d.layout=f[3];d.conversion=f[4];
   d.maxx=stoi(f[5]);d.maxy=stoi(f[6]);d.count=stoi(f[7]);d.blob=stoi(f[8]);
  }catch(...){cerr<<"invalid input manifest for "<<f[0]<<'\n';return 69;}
  for(auto part:split(f[9],';')){auto q=split(part,':');if(q.size()==2)d.parts.push_back({q[0],q[1]});}
  R r=decode(d,mem);summary[r.status]++;total++;
  dst<<"{\"name\":"<<esc(d.name)<<",\"type\":"<<esc(d.type)
    <<",\"address\":"<<d.address<<",\"layout\":"<<esc(d.layout)
    <<",\"status\":"<<esc(r.status)<<",\"reason\":"<<esc(r.reason)
    <<",\"nx\":"<<r.nx<<",\"ny\":"<<r.ny<<",\"byte_length\":"<<r.bytes
    <<",\"x_raw\":"<<arr(r.x)<<",\"y_raw\":"<<arr(r.y)<<",\"z_raw\":"<<arr(r.z)<<"}\n";
 }
 cerr<<"TRIMIND_HEXPLORER_CXX_ADAPTED_XYZ: processed="<<total<<" bytes="<<mem.d.size()<<'\n';
 for(auto &kv:summary)cerr<<kv.first<<'='<<kv.second<<'\n';
 return total?0:70;
}
