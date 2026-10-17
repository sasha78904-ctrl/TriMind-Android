package com.trimind.bridge;
import android.content.ContentResolver;
import android.net.Uri;
import android.provider.DocumentsContract;
final class FileOps {
 static Uri root(Uri tree) {
   return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
 }
 private FileOps() {}
}
