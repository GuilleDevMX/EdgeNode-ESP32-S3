import re

with open("src/NetworkManager.cpp", "r") as f:
    content = f.read()

old_ota = """esp_err_t NetworkManager::setupOTAEndpoints(AsyncWebServer* server) {
    server->on("/api/system/ota", HTTP_POST, 
        [](AsyncWebServerRequest *request) {
            if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
            String authToken = request->header("Authorization");
            if(!authToken.startsWith("Bearer ") || !isAuthorized(request, "admin")) { 
                auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado\"}"); addSecurityHeaders(r); request->send(r); return; 
            }
            if (!Update.hasError()) {
                ESP_LOGI(TAG, "OTA - Transferencia completada.");
                String logMsg = "Actualización OTA realizada con éxito.";
                writeAuditLog("INFO", "admin", logMsg);
                auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}");
                r->addHeader("Connection", "close"); addSecurityHeaders(r); request->send(r);
                ESP_LOGI(TAG, "OTA - Transferencia completada. Reiniciando.");
                pendingReboot = true; rebootRequestTime = millis();
            } else {
                ESP_LOGE(TAG, "OTA - Fallo en transferencia.");
                auto r = request->beginResponse(500, "application/json", "{\"error\":\"OTA Failed\"}"); addSecurityHeaders(r); request->send(r);
            }
        },
        [](AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final) {
            String authToken = request->header("Authorization");
            if(!authToken.startsWith("Bearer ") || !isAuthorized(request, "admin")) return;
            if (!index) {
                int command = (filename.indexOf("littlefs") > -1 || filename.indexOf("spiffs") > -1) ? U_SPIFFS : U_FLASH;
                ESP_LOGI(TAG, "OTA - Iniciando: %s", filename.c_str());
                Update.begin(UPDATE_SIZE_UNKNOWN, command);
            }
            Update.write(data, len);
            if (final) Update.end(true);
        }
    );
    return ESP_OK;
}"""

new_ota = """static void ota_event_handler(HttpEvent_t *event) {
    switch (event->event_id) {
        case HTTP_EVENT_ERROR: ESP_LOGE(TAG, "OTA - HTTP_EVENT_ERROR"); break;
        case HTTP_EVENT_ON_CONNECTED: ESP_LOGI(TAG, "OTA - HTTP_EVENT_ON_CONNECTED"); break;
        case HTTP_EVENT_HEADER_SENT: ESP_LOGI(TAG, "OTA - HTTP_EVENT_HEADER_SENT"); break;
        case HTTP_EVENT_ON_HEADER: ESP_LOGI(TAG, "OTA - HTTP_EVENT_ON_HEADER, key=%s, value=%s", event->header_key, event->header_value); break;
        case HTTP_EVENT_ON_DATA: break;
        case HTTP_EVENT_ON_FINISH: ESP_LOGI(TAG, "OTA - HTTP_EVENT_ON_FINISH"); break;
        case HTTP_EVENT_DISCONNECTED: ESP_LOGI(TAG, "OTA - HTTP_EVENT_DISCONNECTED"); break;
        case HTTP_EVENT_REDIRECT: ESP_LOGI(TAG, "OTA - HTTP_EVENT_REDIRECT"); break;
    }
}

esp_err_t NetworkManager::setupOTAEndpoints(AsyncWebServer* server) {
    AsyncCallbackJsonWebHandler* otaHandler = new AsyncCallbackJsonWebHandler("/api/system/ota", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        String authToken = request->header("Authorization");
        if(!authToken.startsWith("Bearer ") || !isAuthorized(request, "admin")) { 
            auto r = request->beginResponse(401, "application/json", "{\\"error\\":\\"No autorizado\\"}"); addSecurityHeaders(r); request->send(r); return; 
        }
        
        JsonObject data = json.as<JsonObject>();
        if (!data.containsKey("url")) {
            auto r = request->beginResponse(400, "application/json", "{\\"error\\":\\"Missing URL\\"}"); addSecurityHeaders(r); request->send(r); return; 
        }
        String otaUrl = data["url"].as<String>();
        
        ESP_LOGI(TAG, "OTA - Iniciando descarga desde: %s", otaUrl.c_str());
        
        HttpsOTA.onHttpEvent(ota_event_handler);
        HttpsOTA.begin(otaUrl.c_str(), NULL, true); // true = skip cert common name check for compat
        
        writeAuditLog("INFO", "admin", "Descarga de firmware iniciada.");
        auto r = request->beginResponse(200, "application/json", "{\\"status\\":\\"success\\", \\"message\\":\\"OTA pull started\\"}"); 
        addSecurityHeaders(r); request->send(r);
    });
    server->addHandler(otaHandler);
    return ESP_OK;
}"""

if old_ota in content:
    content = content.replace(old_ota, new_ota)
    with open("src/NetworkManager.cpp", "w") as f:
        f.write(content)
    print("Patch applied to NetworkManager.cpp successfully.")
else:
    print("Could not find the text to replace in NetworkManager.cpp.")
