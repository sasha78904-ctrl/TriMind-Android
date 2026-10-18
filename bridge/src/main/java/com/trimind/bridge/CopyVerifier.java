package com.trimind.bridge;

import android.content.ContentResolver;
import android.net.Uri;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.Arrays;

/** Read-only SHA-256 and byte-count verification of a newly copied SAF document. */
final class CopyVerifier {
  private static final class Fingerprint {
    final byte[] sha256;
    final long size;
    Fingerprint(byte[] sha256,long size){this.sha256=sha256;this.size=size;}
  }
  private static Fingerprint fingerprint(ContentResolver resolver,Uri document)throws Exception {
    MessageDigest digest=MessageDigest.getInstance("SHA-256");
    long bytes=0;
    try(InputStream in=resolver.openInputStream(document)) {
      if(in==null)throw new IllegalStateException("SAF provider did not open document for read-back");
      byte[] buffer=new byte[65536];
      for(int n;(n=in.read(buffer))!=-1;) {
        if(n==0)continue;
        digest.update(buffer,0,n);
        bytes+=n;
      }
    }
    return new Fingerprint(digest.digest(),bytes);
  }
  static void verify(ContentResolver resolver,Uri source,Uri copy)throws Exception {
    Fingerprint a=fingerprint(resolver,source), b=fingerprint(resolver,copy);
    if(a.size!=b.size||!Arrays.equals(a.sha256,b.sha256))
      throw new IllegalStateException("Copy failed SHA-256 / size verification");
  }
  private CopyVerifier(){}
}
