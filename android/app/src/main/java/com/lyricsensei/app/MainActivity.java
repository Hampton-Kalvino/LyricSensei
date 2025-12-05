package com.lyricsensei.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.util.Base64;
import java.security.MessageDigest;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;

import com.getcapacitor.BridgeActivity;

import com.facebook.CallbackManager;
import com.facebook.FacebookCallback;
import com.facebook.FacebookException;
import com.facebook.FacebookSdk;
import com.facebook.login.LoginManager;
import com.facebook.login.LoginResult;
import com.facebook.AccessToken;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "LyricSensei";
    private CallbackManager callbackManager;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initialize Facebook SDK
        FacebookSdk.sdkInitialize(getApplicationContext());
        
        // Create callback manager for handling login responses
        callbackManager = CallbackManager.Factory.create();
        
        // Register Facebook Login callback
        LoginManager.getInstance().registerCallback(callbackManager,
            new FacebookCallback<LoginResult>() {
                @Override
                public void onSuccess(LoginResult loginResult) {
                    Log.d(TAG, "Facebook Login Success!");
                    AccessToken accessToken = loginResult.getAccessToken();
                    String token = accessToken.getToken();
                    String userId = accessToken.getUserId();
                    
                    Log.d(TAG, "Facebook User ID: " + userId);
                    Log.d(TAG, "Facebook Access Token: " + token.substring(0, 20) + "...");
                    
                    // Send token to WebView/Capacitor for server-side processing
                    String js = "window.dispatchEvent(new CustomEvent('facebook-login-success', { detail: { token: '" + token + "', userId: '" + userId + "' } }));";
                    getBridge().getWebView().evaluateJavascript(js, null);
                }

                @Override
                public void onCancel() {
                    Log.d(TAG, "Facebook Login Cancelled");
                    String js = "window.dispatchEvent(new CustomEvent('facebook-login-cancelled'));";
                    getBridge().getWebView().evaluateJavascript(js, null);
                }

                @Override
                public void onError(FacebookException exception) {
                    Log.e(TAG, "Facebook Login Error: " + exception.getMessage());
                    String js = "window.dispatchEvent(new CustomEvent('facebook-login-error', { detail: { error: '" + exception.getMessage().replace("'", "\\'") + "' } }));";
                    getBridge().getWebView().evaluateJavascript(js, null);
                }
            });

        // Log key hash for Facebook setup
        try {
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

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        // Pass the activity result to Facebook CallbackManager
        if (callbackManager != null) {
            callbackManager.onActivityResult(requestCode, resultCode, data);
        }
    }
}