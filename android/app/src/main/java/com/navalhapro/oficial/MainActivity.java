package com.navalhapro.oficial;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    private void handleDeepLink(Intent intent) {
        if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction())) {
            Uri data = intent.getData();
            if (data != null) {
                boolean isHttps = "https".equalsIgnoreCase(data.getScheme()) && "pronavalha.lovable.app".equalsIgnoreCase(data.getHost());
                boolean isCustomScheme = "com.navalhapro.oficial".equalsIgnoreCase(data.getScheme());
                if (isHttps || isCustomScheme) {
                    String targetUrl = data.toString();
                    if (isCustomScheme) {
                        targetUrl = targetUrl.replace("com.navalhapro.oficial://", "https://pronavalha.lovable.app/");
                    }
                    final String urlToLoad = targetUrl;
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().post(() -> {
                            getBridge().getWebView().loadUrl(urlToLoad);
                        });
                    }
                }
            }
        }
    }
}
