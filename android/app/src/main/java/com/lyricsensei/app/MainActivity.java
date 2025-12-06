package com.lyricsensei.app;

import android.os.Bundle;
import android.util.Log;
import android.util.Base64;
import java.security.MessageDigest;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            // Use getPackageName() to dynamically get the package name
            PackageInfo info = getPackageManager().getPackageInfo(
                    getPackageName(),
                    PackageManager.GET_SIGNATURES);
            for (Signature signature : info.signatures) {
                MessageDigest md = MessageDigest.getInstance("SHA");
                md.update(signature.toByteArray());
                String keyHash = Base64.encodeToString(md.digest(), Base64.DEFAULT);
                Log.d("KeyHash", "Key Hash: " + keyHash);
            }
        } catch (Exception e) {
            Log.e("KeyHash", "Error getting key hash", e);
        }
    }
}