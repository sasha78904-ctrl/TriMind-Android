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
import java.util.HashSet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipOutputStream;

public final class BridgeActivity extends Activity {
 private static final int SOURCE=1,DEST=2,ZIP=3;
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
   desc.setText("Обери папку ECU, перевір кількість файлів, скопіюй у другу папку або створи ZIP для Google Drive.");
   root.addView(desc);
   pick=button(root,"1. Обрати папку ECU",()->tree(SOURCE));
   scan=button(root,"2. Порахувати файли",this::scanFiles);
   choose=button(root,"3. Обрати папку призначення",()->tree(DEST));
   copy=button(root,"4. Копіювати без перезапису",this::copyFiles);
   make=button(root,"5. Створити ZIP",this::createZip);
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
   make.setEnabled(!busy&&source!=null);
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
   Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
   intent.addCategory(Intent.CATEGORY_OPENABLE);
   intent.setType("application/zip");
   intent.putExtra(Intent.EXTRA_TITLE,"TriMind_ECU_Backup.zip");
   intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
   startActivityForResult(intent,ZIP);
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
   }else if(request==ZIP){
     archive=null;
     run("Створення ZIP",()->{
       FileOps.Stats stats=new FileOps.Stats();
       try(OutputStream out=getContentResolver().openOutputStream(uri,"w")){
         if(out==null)throw new IllegalStateException("Не вдалося відкрити архів");
         try(ZipOutputStream zip=new ZipOutputStream(out)){
           FileOps.zip(getContentResolver(),FileOps.root(source),"",zip,stats,
                       new HashSet<>(),this::show,0);
         }
       }
       archive=uri;
       show("ZIP створено. "+stats+"\nНатисни кнопку передачі у Google Drive.");
     });
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
