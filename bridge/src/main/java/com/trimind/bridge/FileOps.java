package com.trimind.bridge;

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

/** SAF-only file operations: never modify source files, delete, or overwrite destination files. */
final class FileOps {
 interface Progress { void update(String message); }
 static final class Stats {
   long files, bytes, skipped, folders;
   public String toString() {
     return "Файлів: "+files+"; папок: "+folders+"; байтів: "+bytes+"; пропущено: "+skipped;
   }
 }
 static final class Item {
   final Uri uri;
   final String name, mime;
   final long size;
   Item(Uri uri,String name,String mime,long size) {
     this.uri=uri;this.name=name;this.mime=mime;this.size=size;
   }
   boolean folder(){return DocumentsContract.Document.MIME_TYPE_DIR.equals(mime);}
 }
 static Uri root(Uri tree) {
   return DocumentsContract.buildDocumentUriUsingTree(tree,DocumentsContract.getTreeDocumentId(tree));
 }
 static boolean sameDocument(Uri a,Uri b) {
   if(a==null||b==null||!a.getAuthority().equals(b.getAuthority()))return false;
   try {return DocumentsContract.getDocumentId(a).equals(DocumentsContract.getDocumentId(b));}
   catch(IllegalArgumentException e){return a.equals(b);}
 }
 static boolean nested(Uri source,Uri dest) {
   if(source==null||dest==null||!source.getAuthority().equals(dest.getAuthority()))return false;
   String s=DocumentsContract.getTreeDocumentId(source),d=DocumentsContract.getTreeDocumentId(dest);
   return d.equals(s)||d.startsWith(s+"/");
 }
 static List<Item> children(ContentResolver resolver,Uri folder) {
   Uri list=DocumentsContract.buildChildDocumentsUriUsingTree(folder,DocumentsContract.getDocumentId(folder));
   String[] cols={DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME,
     DocumentsContract.Document.COLUMN_MIME_TYPE,DocumentsContract.Document.COLUMN_SIZE};
   List<Item> items=new ArrayList<>();
   try(Cursor c=resolver.query(list,cols,null,null,null)){
     if(c==null)throw new IllegalStateException("Постачальник файлів не повернув список");
     while(c.moveToNext()){
       String id=c.getString(0),name=c.getString(1),mime=c.getString(2);
       long size=c.isNull(3)?-1:c.getLong(3);
       if(id!=null&&name!=null)items.add(new Item(
         DocumentsContract.buildDocumentUriUsingTree(folder,id),name,
         mime==null?"application/octet-stream":mime,size));
     }
   }
   return items;
 }
 static void scan(ContentResolver resolver,Uri folder,Stats stats,Progress progress,int depth) {
   if(depth>64)throw new IllegalStateException("Забагато рівнів папок");
   for(Item item:children(resolver,folder)){
     if(item.folder()){stats.folders++;scan(resolver,item.uri,stats,progress,depth+1);}
     else{stats.files++;stats.bytes+=Math.max(0,item.size);}
     if(stats.files>0&&stats.files%100==0)progress.update("Знайдено "+stats.files+" файлів");
   }
 }
 static long stream(InputStream input,OutputStream output)throws Exception {
   byte[] buf=new byte[65536];long total=0;
   for(int n;(n=input.read(buf))!=-1;){
     if(n==0)continue;
     output.write(buf,0,n);total+=n;
   }
   return total;
 }
 static String uniqueName(ContentResolver resolver,Uri folder,String base,String extension) {
   Set<String> existing=new HashSet<>();
   for(Item item:children(resolver,folder))existing.add(item.name);
   for(int index=0;index<10000;index++){
     String candidate=base+(index==0?"":"_"+index)+extension;
     if(!existing.contains(candidate))return candidate;
   }
   throw new IllegalStateException("Не вдалося підібрати нове ім'я архіву");
 }
 static void preflight(ContentResolver resolver,Uri from,Uri to) {
   if(nested(from,to)||sameDocument(from,to))
     throw new IllegalStateException("Destination is inside source");
   assertDestinationOutsideSource(resolver,from,to,new HashSet<String>(),0);
 }
 static void copy(ContentResolver resolver,Uri from,Uri to,Stats stats,Progress progress,int depth)throws Exception {
   if(sameDocument(from,to))throw new IllegalStateException("Джерело та призначення збігаються");
   assertDestinationOutsideSource(resolver,from,to,new HashSet<String>(),depth);
   copyInternal(resolver,from,to,stats,progress,depth,new HashSet<String>(),
     to.getAuthority()+":"+DocumentsContract.getDocumentId(to));
 }
 /** Preflight the full folder tree before creating anything, including providers with opaque IDs. */
 private static void assertDestinationOutsideSource(ContentResolver resolver,Uri folder,Uri destination,
                                                     Set<String> visited,int depth) {
   if(!folder.getAuthority().equals(destination.getAuthority()))return;
   if(depth>64)throw new IllegalStateException("Забагато рівнів папок");
   if(sameDocument(folder,destination))
     throw new IllegalStateException("Призначення розташоване всередині джерела");
   String key=folder.getAuthority()+":"+DocumentsContract.getDocumentId(folder);
   if(!visited.add(key))return;
   for(Item item:children(resolver,folder))
     if(item.folder())assertDestinationOutsideSource(resolver,item.uri,destination,visited,depth+1);
 }
 private static void copyInternal(ContentResolver resolver,Uri from,Uri to,Stats stats,
                                  Progress progress,int depth,Set<String> visited,
                                  String destinationKey)throws Exception {
   if(depth>64)throw new IllegalStateException("Забагато рівнів папок");
   String sourceKey=from.getAuthority()+":"+DocumentsContract.getDocumentId(from);
   if(sourceKey.equals(destinationKey))throw new IllegalStateException("Призначення вкладено в джерело");
   if(!visited.add(sourceKey))throw new IllegalStateException("Виявлено циклічне посилання на папку");
   Map<String,Item> present=new HashMap<>();
   for(Item item:children(resolver,to))present.put(item.name,item);
   for(Item item:children(resolver,from)){
     String key=item.uri.getAuthority()+":"+DocumentsContract.getDocumentId(item.uri);
     if(key.equals(destinationKey))throw new IllegalStateException("Папка призначення всередині джерела");
     Item old=present.get(item.name);
     if(item.folder()){
       if(old!=null&&!old.folder()){stats.skipped++;continue;}
       Uri target=old!=null?old.uri:DocumentsContract.createDocument(resolver,to,
         DocumentsContract.Document.MIME_TYPE_DIR,item.name);
       if(target==null)throw new IllegalStateException("Не створено папку "+item.name);
       stats.folders++;
       copyInternal(resolver,item.uri,target,stats,progress,depth+1,visited,destinationKey);
     }else{
       if(old!=null){stats.skipped++;continue;}
       Uri created=DocumentsContract.createDocument(resolver,to,item.mime,item.name);
       if(created==null)throw new IllegalStateException("Не створено файл "+item.name);
       // If the provider races and returns an existing document, never write into it.
       if(sameDocument(created,item.uri)||sameDocument(created,from))
         throw new IllegalStateException("Небезпечний збіг документів: "+item.name);
       try(InputStream in=resolver.openInputStream(item.uri);
           OutputStream out=resolver.openOutputStream(created,"w")){
         if(in==null||out==null)throw new IllegalStateException("Не відкривається "+item.name);
         stats.bytes+=stream(in,out);
       }catch(Exception e){
         throw new IllegalStateException("Копіювання "+item.name+
           " перервано; новий файл може бути неповним. Оригінал не змінено.",e);
       }
       stats.files++;
       if(stats.files%25==0)progress.update("Скопійовано "+stats.files);
     }
   }
   visited.remove(sourceKey);
 }
 static void zip(ContentResolver resolver,Uri from,String prefix,ZipOutputStream zip,
                 Stats stats,Set<String> used,Progress progress,int depth,Uri archive)throws Exception {
   if(depth>64)throw new IllegalStateException("Забагато рівнів папок");
   for(Item item:children(resolver,from)){
     if(sameDocument(item.uri,archive))continue;
     String safeName=item.name.replace('/','_').replace('\\','_');
     String name=prefix+safeName;
     if(item.folder()){
       stats.folders++;
       zip(resolver,item.uri,name+"/",zip,stats,used,progress,depth+1,archive);
     }else{
       if(!used.add(name)){stats.skipped++;continue;}
       zip.putNextEntry(new ZipEntry(name));
       try(InputStream in=resolver.openInputStream(item.uri)){
         if(in==null)throw new IllegalStateException("Не відкрився "+name);
         stats.bytes+=stream(in,zip);
       }
       zip.closeEntry();stats.files++;
       if(stats.files%25==0)progress.update("Архівовано "+stats.files);
     }
   }
 }
 private FileOps(){}
}
