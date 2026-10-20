package com.trimind.ecu;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.view.ViewGroup;
public class EcuActivity extends Activity {
 private WebView web; private ValueCallback<Uri[]> fileCallback;
 @Override public void onCreate(Bundle b) { super.onCreate(b);
 web=new WebView(this); setContentView(web,new ViewGroup.LayoutParams(-1,-1));
 web.getSettings().setJavaScriptEnabled(true); web.getSettings().setAllowFileAccess(true);
 web.getSettings().setAllowContentAccess(true);
 web.setWebViewClient(new WebViewClient());
 web.setWebChromeClient(new WebChromeClient(){
 @Override public boolean onShowFileChooser(WebView w,ValueCallback<Uri[]> cb,FileChooserParams p){
 if(fileCallback!=null)fileCallback.onReceiveValue(null);
 fileCallback=cb;
 Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.addCategory(Intent.CATEGORY_OPENABLE);
 try{startActivityForResult(i,42);return true;}catch(Exception e){fileCallback=null;return false;}
 }});
 web.loadUrl("file:///android_asset/ecu.html");
 }
 @Override protected void onActivityResult(int req,int res,Intent data){super.onActivityResult(req,res,data);
 if(req==42&&fileCallback!=null){Uri[] a=res==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null;fileCallback.onReceiveValue(a);fileCallback=null;}
 }
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
}
