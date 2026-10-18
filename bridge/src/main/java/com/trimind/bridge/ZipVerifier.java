package com.trimind.bridge;

import android.content.ContentResolver;
import android.net.Uri;
import java.io.InputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Read-only ZIP verification after closing the writer. ZipInputStream validates
 * per-entry CRC, while the EOCD check detects a missing ZIP central directory
 * (a truncated archive can otherwise look valid to ZipInputStream).
 */
final class ZipVerifier {
  static void verify(ContentResolver resolver, Uri archive,
                     long expectedFiles, long expectedBytes) throws Exception {
    long files=0, bytes=0;
    try(InputStream raw=resolver.openInputStream(archive)) {
      if(raw==null)throw new IllegalStateException("ZIP cannot be opened for verification");
      try(ZipInputStream zip=new ZipInputStream(raw)) {
        byte[] buffer=new byte[65536];
        ZipEntry entry;
        while((entry=zip.getNextEntry())!=null) {
          if(!entry.isDirectory()) {
            files++;
            for(int n;(n=zip.read(buffer))!=-1;) {
              if(n==0)continue;
              bytes+=n;
            }
          }
          zip.closeEntry(); // forces CRC check, including data descriptors
        }
      }
    }
    if(files!=expectedFiles||bytes!=expectedBytes)
      throw new IllegalStateException("ZIP content count mismatch: expected "+
        expectedFiles+"/"+expectedBytes+", found "+files+"/"+bytes);
    checkEndOfCentralDirectory(resolver,archive);
  }
  private static void checkEndOfCentralDirectory(ContentResolver resolver,Uri archive)
      throws Exception {
    // Max ZIP comment length 65535 + fixed EOCD size 22.
    final int capacity=65557;
    byte[] ring=new byte[capacity],buffer=new byte[65536];
    long total=0;
    try(InputStream in=resolver.openInputStream(archive)) {
      if(in==null)throw new IllegalStateException("ZIP cannot be reopened");
      for(int n;(n=in.read(buffer))!=-1;) {
        if(n==0)continue;
        for(int i=0;i<n;i++)ring[(int)(total++%capacity)]=buffer[i];
      }
    }
    int length=(int)Math.min(total,capacity);
    if(length<22)throw new IllegalStateException("ZIP too short");
    int first=(int)((total-length)%capacity);
    byte[] tail=new byte[length];
    for(int i=0;i<length;i++)tail[i]=ring[(first+i)%capacity];
    for(int i=length-22;i>=0;i--) {
      if((tail[i]&255)!=0x50||(tail[i+1]&255)!=0x4b||
         (tail[i+2]&255)!=0x05||(tail[i+3]&255)!=0x06)continue;
      int comment=(tail[i+20]&255)|((tail[i+21]&255)<<8);
      if(i+22+comment!=length)continue;
      long cdSize=u32(tail,i+12),cdOffset=u32(tail,i+16);
      if(cdSize!=0xffffffffL&&cdOffset!=0xffffffffL&&
         (cdOffset>total||cdSize>total-cdOffset))
        throw new IllegalStateException("ZIP central directory is outside file");
      return;
    }
    throw new IllegalStateException("ZIP central directory end (EOCD) is missing");
  }
  private static long u32(byte[] b,int p) {
    return ((long)b[p]&255)|(((long)b[p+1]&255)<<8)|
      (((long)b[p+2]&255)<<16)|(((long)b[p+3]&255)<<24);
  }
  private ZipVerifier(){}
}
