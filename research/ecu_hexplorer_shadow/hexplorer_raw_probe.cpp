// Experimental standalone subset of HEXplorer hexfile.cpp getDecValues
// Origin: https://github.com/adhoc2/HEXplorer (c67a73f2...)
// Inspired by same GPL-3.0-or-later algorithmic branches; no Qt GUI.
// This is an ADAPTED subset, not the native executable nor an independent A2L parser.
// Warning: source's missing-address->zero behavior is explicitly represented here.
// SPDX-License-Identifier: GPL-3.0-or-later
#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <string>
#include <cstdint>
#include <iomanip>
#include <algorithm>
#include <cmath>
#include <limits>
#include <cstring>
using namespace std;
struct Field {string field,datatype;};
vector<string> split(const string&s,char c){vector<string> v; string q;istringstream in(s);while(getline(in,q,c))v.push_back(q);return v;}
int sz(const string& dt){if(dt=="SBYTE"||dt=="UBYTE")return 1;if(dt=="SWORD"||dt=="UWORD")return 2;if(dt=="SLONG"||dt=="ULONG"||dt=="FLOAT32_IEEE")return 4;return 0;}
struct Memory{
 vector<uint8_t> data; uint32_t base=0x800000;
 bool covered(uint64_t addr,size_t n) const {return addr>=base && addr-base<=data.size() && n<=data.size()-(addr-base);}
 double read(uint64_t addr,const string&dt,bool big,bool &ok) const {
   int n=sz(dt);
   if(!n || !covered(addr,n)){ok=false;return 0;} // original zero fallback, now explicit error flag
   uint32_t u=0;
   for(int k=0;k<n;k++){uint8_t b=data[addr-base+k];if(big)u=(u<<8)|b;else u|=uint32_t(b)<<(8*k);}
   if(dt=="SBYTE")return double((int8_t)u);
   if(dt=="SWORD")return double((int16_t)u);
   if(dt=="SLONG")return double((int32_t)u);
   if(dt=="FLOAT32_IEEE"){float f;memcpy(&f,&u,sizeof(float));return f;}
   return double(u);
 }
};
struct Res{string name,status,reason;int x=0,y=0;vector<double>ax,ay,z;uint64_t addr=0;};
Res decode(const string &name,uint64_t addr,int maxx,int maxy,const vector<Field> &f,const Memory &mem){
 Res r;r.name=name;r.addr=addr;r.status="INCOMPLETE";r.reason="unsupported_layout";
 uint64_t at=addr;
 int nx=0,ny=0;bool ok=true;
 for(const auto&e:f){
  int n=sz(e.datatype);
  if(!n){r.reason="unsupported_datatype";return r;}
  if(e.field=="NO_AXIS_PTS_X"||e.field=="NO_AXIS_PTS_Y"){
   double val=mem.read(at,e.datatype,true,ok);at+=n;
   if(!ok){r.reason="missing_bytes";return r;}
   int d=int(val);
   if(d<=0 || d>512){r.reason="bad_axis_count";return r;}
   if(e.field=="NO_AXIS_PTS_X"){nx=d;if(nx>maxx){r.reason="max_axis_limit";return r;}}
   else {ny=d;if(ny>maxy){r.reason="max_axis_limit";return r;}}
  }else if(e.field=="AXIS_PTS_X"||e.field=="AXIS_PTS_Y"){
   int d=(e.field=="AXIS_PTS_X"?nx:ny);
   // HEXplorer can use MaxAxisPoints where no explicit count; flag rather than assert.
   if(d==0){r.reason="missing_axis_count_unsafe_max_fallback";return r;}
   if(d>512){r.reason="large_axis";return r;}
   auto &v=e.field=="AXIS_PTS_X"?r.ax:r.ay;
   for(int i=0;i<d;i++){double q=mem.read(at,e.datatype,true,ok);if(!ok){r.reason="missing_bytes";return r;}v.push_back(q);at+=n;}
  }else if(e.field=="FNC_VALUES"){
   if(nx<=0||ny<=0){r.reason="missing_dimensions";return r;}
   for(int i=0;i<nx*ny;i++){double q=mem.read(at,e.datatype,true,ok);if(!ok){r.reason="missing_bytes";return r;}r.z.push_back(q);at+=n;}
  }else {r.reason="unsupported_layout_field";return r;}
 }
 if(r.ax.size()!=size_t(nx)||r.ay.size()!=size_t(ny)||r.z.size()!=size_t(nx*ny)){
  r.reason="incomplete_fields";return r;
 }
 r.x=nx;r.y=ny;r.status="RAW_DECODED";r.reason="";
 return r;
}
string joinv(const vector<double>&v){ostringstream os;os<<setprecision(10);for(size_t i=0;i<v.size();i++){if(i)os<<',';os<<v[i];}return os.str();}
int main(int argc,char**argv){
 if(argc!=4){cerr<<"usage: probe mers_nov.bin mapspec.tsv results.tsv\n";return 2;}
 ifstream binary(argv[1],ios::binary);if(!binary){cerr<<"missing BIN\n";return 2;}
 Memory m;m.data=vector<uint8_t>(istreambuf_iterator<char>(binary),{});
 if(m.data.size()!=1048576){cerr<<"invalid expected image size\n";return 3;}
 ifstream input(argv[2]);ofstream out(argv[3]);if(!input||!out){cerr<<"bad files\n";return 2;}
 out<<"name\tstatus\treason\tnx\tny\taddress\taxis_x\taxis_y\tvalues_z\n";
 int total=0,complete=0;string line;
 while(getline(input,line)){
  auto a=split(line,'\t');if(a.size()!=5)continue;
  auto fld=split(a[4],';');vector<Field> f;
  for(const auto& t:fld){auto pos=t.find(':');if(pos!=string::npos)f.push_back({t.substr(0,pos),t.substr(pos+1)});}
  auto r=decode(a[0],stoull(a[1],nullptr,0),stoi(a[2]),stoi(a[3]),f,m);
  out<<r.name<<'\t'<<r.status<<'\t'<<r.reason<<'\t'<<r.x<<'\t'<<r.y<<'\t'<<hex<<uppercase<<r.addr<<dec<<'\t'<<joinv(r.ax)<<'\t'<<joinv(r.ay)<<'\t'<<joinv(r.z)<<'\n';
  total++;if(r.status=="RAW_DECODED")complete++;
 }
 cerr<<"C++ RAW PROBE: "<<complete<<"/"<<total<<" decoded (NOT independently verified)\n";
 return 0;
}