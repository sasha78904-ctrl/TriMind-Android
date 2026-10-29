// GPL-3.0-or-later from linked HEXplorer dependency. TriMind test harness (new work).
// Uses original adhoc2/HEXplorer A2lLexer and A2LFILE classes, NOT a regex reimplementation.
#include <QApplication>
#include <QFile>
#include <QTextStream>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QFileInfo>
#include <QDebug>
#include <QTimer>
#include <QStringList>
#include "ASAP2/lexer.h"
#include "ASAP2/Nodes/a2lfile.h"
#include "ASAP2/Nodes/project.h"
#include "ASAP2/Nodes/characteristic.h"
#include "ASAP2/Nodes/axis_pts.h"
#include "ASAP2/Nodes/record_layout.h"
#include "ASAP2/Nodes/compu_method.h"

static QJsonObject attrs(Node *n) {
  QJsonObject j;
  const auto *p=n->getParameters();
  if(p) {
    for(auto it=p->cbegin(); it!=p->cend(); ++it) j[it.key()]=it.value();
    delete p;
  }
  return j;
}
static QJsonObject walk(Node *node, QJsonArray &maps, QJsonObject &stats, unsigned &seen) {
  QJsonObject n; n["name"]=node->name; n["line"]=node->a2lLine;
  if(dynamic_cast<CHARACTERISTIC *>(node)) {
    auto properties=attrs(node);
    n["parameters"]=properties;
    // characteristic includes curves, values, etc; export all with type as declared.
    maps.append(n);
    stats["characteristic_count"]=stats.value("characteristic_count").toInt()+1;
  } else if(dynamic_cast<AXIS_PTS *>(node)) {
    stats["axis_pts_count"]=stats.value("axis_pts_count").toInt()+1;
  } else if(dynamic_cast<RECORD_LAYOUT *>(node)) {
    stats["record_layout_count"]=stats.value("record_layout_count").toInt()+1;
  } else if(dynamic_cast<COMPU_METHOD *>(node)) {
    stats["compu_method_count"]=stats.value("compu_method_count").toInt()+1;
  }
  ++seen;
  for(Node *x:node->childNodes) if(x) walk(x,maps,stats,seen);
  return n;
}
int main(int argc,char**argv) {
  qputenv("QT_QPA_PLATFORM","offscreen");
  QApplication app(argc,argv);
  if(argc!=3) {qCritical()<<"Usage: hexplorer_a2l_cli INPUT.a2l OUTPUT.json"; return 64;}
  QFile f(QString::fromLocal8Bit(argv[1]));
  if(!f.open(QFile::ReadOnly)) {qCritical()<<"Cannot read A2L"; return 66;}
  QString source=QString::fromLatin1(f.readAll());
  f.close();
  QTextStream in(&source);
  auto *lexer=new A2lLexer(in);
  lexer->initialize();
  auto *errors=new QStringList;
  A2LFILE root(nullptr,lexer,errors,QString::fromLocal8Bit(argv[1]));
  QJsonObject stat;
  stat["characteristic_count"]=0;stat["axis_pts_count"]=0;
  stat["record_layout_count"]=0;stat["compu_method_count"]=0;
  QJsonArray chars;unsigned seen=0;
  walk(&root,chars,stat,seen);
  QJsonArray e;for(const QString &x:*errors)e.append(x);
  QJsonObject result;
  result["engine"]="HEXplorer native A2lLexer + A2LFILE";
  result["upstream_commit"]="c67a73f2fd1b43a999012c95a04181c6d52e51aa";
  result["input"]=QFileInfo(QString::fromLocal8Bit(argv[1])).fileName();
  result["parsed"]=root.isParsed();
  result["errors"]=e;result["summary"]=stat;result["all_node_count"]=(int)seen;
  result["characteristics"]=chars;
  QFile out(QString::fromLocal8Bit(argv[2]));
  if(!out.open(QFile::WriteOnly|QFile::Truncate)) {qCritical()<<"Cannot write output";return 74;}
  out.write(QJsonDocument(result).toJson(QJsonDocument::Indented));out.close();
  qInfo().noquote()<<"Native HEXplorer output" << chars.size()<<"characteristics,"<<e.size()<<"errors";
  return e.isEmpty()&&root.getProject()!=nullptr?0:2;
}
