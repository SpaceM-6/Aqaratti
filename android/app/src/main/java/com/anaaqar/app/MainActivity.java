package com.anaaqar.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // زر الرجوع في أندرويد: يرجع للصفحة السابقة داخل التطبيق (ويغلق النوافذ المفتوحة)،
        // ومن الصفحة الرئيسية بلا صفحات سابقة يُصغّر التطبيق بدل إغلاقه.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                if (webView != null) {
                    String url = webView.getUrl();
                    boolean atHome = url == null || url.matches("^https?://[^/]+/?(index\\.html)?([?#].*)?$");
                    if (!atHome) {
                        webView.loadUrl("https://anaaqar.com/");
                        return;
                    }
                }
                moveTaskToBack(true);
            }
        });
    }
}
