package com.trimind.app;
import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
final class FileOps {
 interface Progress { void update(String message); }
 static final class Stats {
   long files, bytes, skipped, folders;
   public String toString(){return "Файлів: "+files+"; папок: "+folders+"; байтів: "+bytes+"; пропущено: "+skipped;}
 }
 static final class Item {
   final Uri uri; final String name,mime; final long size;
   Item(Uri u,String n,String m,long s){uri=u;name=n;mime=m;size=s;}
   boolean folder(){return DocumentsContract.Document.MIME_TYPE_DIR.equals(mime);}
 }
 static Uri root(Uri tree){
   return DocumentsContract.buildDocumentUriUsingTree(tree,DocumentsContract.getTreeDocumentId(tree));
 }
 static List<Item> children(ContentResolver r,Uri folder){
   Uri list=DocumentsContract.buildChildDocumentsUriUsingTree(folder,DocumentsContract.getDocumentId(folder));
   String[] cols={DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME,
     DocumentsContract.Document.COLUMN_MIME_TYPE,DocumentsContract.Document.COLUMN_SIZE};
   List<Item> items=new ArrayList<>();
   try(Cursor c=r.query(list,cols,null,null,null)){
     if(c==null)throw new IllegalStateException("Немає доступу до папки");
     while(c.moveToNext()){
       String id=c.getString(0),name=c.getString(1),mime=c.getString(2);
       long size=c.isNull(3)?0:c.getLong(3);
       if(id!=null&&name!=null)items.add(new Item(DocumentsContract.buildDocumentUriUsingTree(folder,id),
         name,mime==null?"application/octet-stream":mime,size));
     }
   }
   return items;
 }
 static void scan(ContentResolver r,Uri folder,Stats s,Progress p,int depth){
   if(depth>64)throw new IllegalStateException("Забагато рівнів");
   for(Item i:children(r,folder)){
     if(i.folder()){s.folders++;scan(r,i.uri,s,p,depth+1);}
     else{s.files++;s.bytes+=Math.max(0,i.size);}
     if(s.files>0&&s.files%100==0)p.update("Знайдено "+s.files);
   }
 }
 static long stream(InputStream in,OutputStream out)throws Exception{
   byte[] b=new byte[65536];long size=0;
   for(int n;(n=in.read(b))!=-1;){out.write(b,0,n);size+=n;}
   return size;
 }
 static void copy(ContentResolver r,Uri from,Uri to,Stats s,Progress p,int depth)throws Exception{
   if(depth>64)throw new IllegalStateException("Забагато рівнів");
   Map<String,Item> present=new HashMap<>();
   for(Item i:children(r,to))present.put(i.name,i);
   for(Item i:children(r,from)){
     Item old=present.get(i.name);
     if(i.folder()){
       if(old!=null&&!old.folder()){s.skipped++;continue;}
       Uri target=old!=null?old.uri:DocumentsContract.createDocument(r,to,DocumentsContract.Document.MIME_TYPE_DIR,i.name);
       if(target==null)throw new IllegalStateException("Не створено папку "+i.name);
       s.folders++;copy(r,i.uri,target,s,p,depth+1);
     }else{
       if(old!=null){s.skipped++;continue;}
       Uri created=DocumentsContract.createDocument(r,to,i.mime,i.name);
       if(created==null)throw new IllegalStateException("Не створено "+i.name);
       try(InputStream in=r.openInputStream(i.uri);OutputStream out=r.openOutputStream(created,"w")){
         if(in==null||out==null)throw new IllegalStateException("Не відкрився "+i.name);
         s.bytes+=stream(in,out);
       }
       s.files++;if(s.files%25==0)p.update("Скопійовано "+s.files);
     }
   }
 }
 static void zip(ContentResolver r,Uri from,String prefix,ZipOutputStream zip,Stats s,
                 Set<String> used,Progress p,int depth)throws Exception{
   if(depth>64)throw new IllegalStateException("Забагато рівнів");
   for(Item i:children(r,from)){
     String name=prefix+i.name.replace('/','_').replace('\\','_');
     if(i.folder()){s.folders++;zip(r,i.uri,name+"/",zip,s,used,p,depth+1);}
     else{
       if(!used.add(name)){s.skipped++;continue;}
       zip.putNextEntry(new ZipEntry(name));
       try(InputStream in=r.openInputStream(i.uri)){
         if(in==null)throw new IllegalStateException("Не відкрився "+name);
         s.bytes+=stream(in,zip);
       }
       zip.closeEntry();s.files++;
       if(s.files%25==0)p.update("Архівовано "+s.files);
     }
   }
 }
 static boolean nested(Uri source,Uri dest){
   if(!source.getAuthority().equals(dest.getAuthority()))return false;
   String s=DocumentsContract.getTreeDocumentId(source),d=DocumentsContract.getTreeDocumentId(dest);
   return d.equals(s)||d.startsWith(s+"/");
 }
 private FileOps(){}
}
