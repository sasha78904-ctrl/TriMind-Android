package com.trimind.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Keeps provider API keys encrypted with a non-exportable Android Keystore key. */
final class SecretStore {
    private static final String ALIAS = "trimind-v1-api-key";
    private final SharedPreferences prefs;
    private final SecretKey key;

    SecretStore(Context context) throws Exception {
        prefs = context.getSharedPreferences("trimind_secrets", Context.MODE_PRIVATE);
        KeyStore keystore = KeyStore.getInstance("AndroidKeyStore");
        keystore.load(null);
        SecretKey existing = (SecretKey) keystore.getKey(ALIAS, null);
        if (existing != null) {
            key = existing;
        } else {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(
                    ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build());
            key = generator.generateKey();
        }
    }

    void save(String provider, String secret) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] encrypted = cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8));
        String payload = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
                + ":" + Base64.encodeToString(encrypted, Base64.NO_WRAP);
        if (!prefs.edit().putString(provider, payload).commit()) {
            throw new IllegalStateException("Не вдалося зберегти ключ");
        }
    }

    String load(String provider) throws Exception {
        String payload = prefs.getString(provider, "");
        if (payload == null || payload.isEmpty()) return "";
        String[] parts = payload.split(":", 2);
        if (parts.length != 2) throw new IllegalStateException("Некоректний формат ключа");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key,
                new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)),
                StandardCharsets.UTF_8);
    }
}
