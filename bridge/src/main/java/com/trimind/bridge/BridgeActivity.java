package com.trimind.bridge;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.io.OutputStream;
import android.provider.DocumentsContract;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.HashSet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipOutputStream;

public final class BridgeActivity extends Activity {
 private static final int SOURCE=1,DEST=2;
 private final ExecutorService executor=Executors.newSingleThreadExecutor();
 private Uri source,destination,archive;
 private TextView info;
 private Button pick,scan,choose,copy,make,share;
 private volatile boolean busy;
 @Override public void onCreate(Bundle state){
   super.onCreate(state);
   ScrollView sc=new ScrollView(this);
   LinearLayout root=new LinearLayout(this);
   root.setOrientation(LinearLayout.VERTICAL);
   root.setPadding(20,25,20,25);
   sc.addView(root);
   TextView title=new TextView(this);
   title.setText("TriMind Bridge 0.1");title.setTextSize(25);root.addView(title);
   TextView desc=new TextView(this);
   desc.setText("Обери папку ECU, переглянь файли, скопіюй у окрему папку або створи ZIP там. Якщо Drive не підтримує вибір папки, передай ZIP через меню Поділитися.");
   root.addView(desc);
   pick=button(root,"1. Обрати папку ECU",()->tree(SOURCE));
   scan=button(root,"2. Порахувати файли",this::scanFiles);
   choose=button(root,"3. Обрати папку призначення",()->tree(DEST));
   copy=button(root,"4. Копіювати без перезапису",this::copyFiles);
   make=button(root,"5. Створити ZIP у папці призначення",this::createZip);
   share=button(root,"6. Надіслати ZIP у Google Drive",this::shareZip);
   info=new TextView(this);info.setTextSize(15);info.setTextIsSelectable(true);
   info.setPadding(8,18,8,8);root.addView(info);
   info.setText("Файли не видаляються. Наявні файли у папці призначення пропускаються.");
   setContentView(sc);buttons();
 }
 private Button button(LinearLayout root,String text,Runnable run){
   Button b=new Button(this);b.setText(text);b.setAllCaps(false);
   root.addView(b,new LinearLayout.LayoutParams(-1,-2));
   b.setOnClickListener(v->run.run());return b;
 }
 private void buttons(){
   pick.setEnabled(!busy);choose.setEnabled(!busy);
   scan.setEnabled(!busy&&source!=null);
   copy.setEnabled(!busy&&source!=null&&destination!=null);
   make.setEnabled(!busy&&source!=null&&destination!=null&&!FileOps.nested(source,destination));
   share.setEnabled(!busy&&archive!=null);
 }
 private void show(String message){runOnUiThread(()->info.setText(message));}
 private void run(String name,Task task){
   if(busy)return;
   busy=true;buttons();show(name+"...");
   executor.execute(()->{
     try{task.execute();}catch(Exception e){
       show("Помилка: "+e.getMessage()+"\nОригінали не змінювалися. Перевір неповні нові файли.");
     }finally{runOnUiThread(()->{busy=false;buttons();});}
   });
 }
 interface Task{void execute()throws Exception;}
 private void tree(int request){
   Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
   intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|
                   Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
   startActivityForResult(intent,request);
 }
 private void createZip(){
   if(source==null||destination==null||FileOps.nested(source,destination)){
     show("Спочатку обери окрему папку призначення поза папкою джерела.");return;
   }
   run("Створення ZIP",()->{
     Uri from=source, to=destination;
     // Full SAF tree preflight catches nested destinations even with opaque document IDs.
     // Run before creating any output so a source tree can never archive itself.
     FileOps.preflight(getContentResolver(),FileOps.root(from),FileOps.root(to));
     Uri target=FileOps.root(to);
     String base="TriMind_ECU_Backup_"+new SimpleDateFormat("yyyyMMdd_HHmmss",Locale.US).format(new Date());
     String name=FileOps.uniqueName(getContentResolver(),target,base,".zip");
     Uri created=DocumentsContract.createDocument(getContentResolver(),target,"application/zip",name);
     if(created==null)throw new IllegalStateException("Не вдалося створити ZIP у папці призначення");
     // Refuse self-archiving even if a provider aliases the selected folders.
     if(FileOps.sameDocument(created,FileOps.root(from)))
       throw new IllegalStateException("Папка призначення збігається з джерелом");
     FileOps.Stats stats=new FileOps.Stats();
     try(OutputStream out=getContentResolver().openOutputStream(created,"w")){
       if(out==null)throw new IllegalStateException("Не вдалося відкрити новий ZIP");
       try(ZipOutputStream zip=new ZipOutputStream(out)){
         FileOps.zip(getContentResolver(),FileOps.root(from),"",zip,stats,
                     new HashSet<>(),this::show,0,created);
       }
     }catch(Exception e){
       archive=null;
       throw new IllegalStateException("ZIP не завершено; у папці призначення може залишитися неповний файл "+name+". "+e.getMessage(),e);
     }
     archive=created;
     show("ZIP успішно закрито: "+name+". "+stats+"\\nОригінали не змінені. Для Google Drive натисни Поділитися та вибери ОКРЕМУ папку.");
   });
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
   super.onActivityResult(request,result,data);
   if(result!=RESULT_OK||data==null||data.getData()==null)return;
   Uri uri=data.getData();
   if(request==SOURCE||request==DEST){
     int flags=data.getFlags()&(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
     try{getContentResolver().takePersistableUriPermission(uri,flags);}
     catch(SecurityException ignored){}
     if(request==SOURCE){source=uri;archive=null;show("Обрано джерело: "+uri);}
     else{destination=uri;show("Обрано призначення: "+uri);}
     buttons();
   }
 }
 private void scanFiles(){
   run("Сканування",()->{
     FileOps.Stats s=new FileOps.Stats();
     FileOps.scan(getContentResolver(),FileOps.root(source),s,this::show,0);
     show("Сканування завершено. "+s);
   });
 }
 private void copyFiles(){
   if(FileOps.nested(source,destination)){
     show("Помилка: папка призначення не може бути всередині джерела.");return;
   }
   run("Копіювання",()->{
     FileOps.Stats s=new FileOps.Stats();
     FileOps.copy(getContentResolver(),FileOps.root(source),
                  FileOps.root(destination),s,this::show,0);
     show("Копіювання завершено. "+s+"\nОригінали збережено.");
   });
 }
 private void shareZip(){
   if(archive==null)return;
   Intent intent=new Intent(Intent.ACTION_SEND);
   intent.setType("application/zip");
   intent.putExtra(Intent.EXTRA_STREAM,archive);
   intent.setClipData(ClipData.newRawUri("TriMind ECU",archive));
   intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
   try{startActivity(Intent.createChooser(intent,"Надіслати архів у Google Drive"));}
   catch(Exception e){Toast.makeText(this,"Немає програми для передачі ZIP",Toast.LENGTH_LONG).show();}
 }
 @Override protected void onDestroy(){executor.shutdown();super.onDestroy();}
}
