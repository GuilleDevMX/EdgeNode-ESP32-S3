#include "NetworkManager.h"
#include <WiFi.h>
#include <esp_wifi.h>
#include <LittleFS.h>
#include <AsyncJson.h>
#include <ArduinoJson.h>
#include "SecurityManager.h"
#include <ESPmDNS.h>
#include <Preferences.h>
#include <Update.h>
#include <time.h>
#include <esp_log.h>

static const char *TAG = "EdgeSecOps";

extern bool isIpAllowed(AsyncWebServerRequest *request);
extern void addSecurityHeaders(AsyncWebServerResponse *response);
extern bool isAuthorized(AsyncWebServerRequest *request, String requiredRole);
extern void writeAuditLog(String severity, String user, String action);
extern bool pendingReboot;
extern unsigned long rebootRequestTime;

NetworkManager NetMgr;

void NetworkManager::startSecureProvisioning() {
    Preferences nvs;
    nvs.begin("wifi", true);
    String ap_ssid = nvs.getString("ap_ssid", "");
    String ap_pass = nvs.getString("ap_pass", "");
    bool ap_hide = nvs.getBool("ap_hide", false);
    nvs.end();

    uint8_t mac[6];
    esp_wifi_get_mac(WIFI_IF_AP, mac);
    char default_ssid[20];
    sprintf(default_ssid, "EdgeNode_%02X%02X", mac[4], mac[5]);
    char default_pass[25];
    sprintf(default_pass, "SecOps_%02X%02X%02X%02X", mac[2], mac[3], mac[4], mac[5]);

    if(ap_ssid == "") ap_ssid = String(default_ssid);
    if(ap_pass == "") ap_pass = String(default_pass);

    WiFi.mode(WIFI_AP_STA);
    if(WiFi.softAP(ap_ssid.c_str(), ap_pass.c_str(), 1, ap_hide ? 1 : 0, 4)) { 
        ESP_LOGI(TAG, "--- MODO PROVISION / RESCATE ACTIVO ---");
        ESP_LOGI(TAG, "SSID: %s (Oculto: %s)", ap_ssid.c_str(), ap_hide ? "SI" : "NO");
        ESP_LOGI(TAG, "PASS: %s", ap_pass.c_str());
        ESP_LOGI(TAG, "Gateway IP: %s", WiFi.softAPIP().toString().c_str());
    }
}

bool NetworkManager::connectToOperationalWiFi() {
    Preferences nvs;
    nvs.begin("net", true); 
    String ssid = nvs.getString("ssid", "");     
    String pass = nvs.getString("pass", "");     
    bool useDhcp = nvs.getBool("dhcp", true);
    String static_ip = nvs.getString("ip", "");
    String static_gw = nvs.getString("gw", "");
    String static_sn = nvs.getString("sn", "");
    String static_dns = nvs.getString("dns", "");
    nvs.end();

    if(ssid == "") {
        ESP_LOGE(TAG, "NET - Red no configurada. SSID vacío en memoria NVS.");
        return false;
    }

    WiFi.mode(WIFI_STA);
    WiFi.setTxPower(WIFI_POWER_8_5dBm);
    WiFi.setSleep(false);
    WiFi.setAutoReconnect(true);

    if (!useDhcp && static_ip != "" && static_gw != "" && static_sn != "") {
        IPAddress ip, gw, sn, dns;
        ip.fromString(static_ip); gw.fromString(static_gw);
        sn.fromString(static_sn); dns.fromString(static_dns);
        WiFi.config(ip, gw, sn, dns);
        ESP_LOGI(TAG, "NET - Aplicando configuración IP Estática.");
    }

    WiFi.begin(ssid.c_str(), pass.c_str());
    ESP_LOGI(TAG, "NET - Conectando a red operativa '%s'...", ssid.c_str());
    
    esp_wifi_set_ps(WIFI_PS_MIN_MODEM);

    uint8_t attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) { 
        delay(500); 
        attempts++;
    }
    
    if(WiFi.status() == WL_CONNECTED) {
        ESP_LOGI(TAG, "NET - Conectado exitosamente. IP: %s", WiFi.localIP().toString().c_str());
        
        initNTP(); 
        
        ESP_LOGI(TAG, "SYS - Esperando sincronía horaria NTP...");
        attempts = 0;
        while (time(nullptr) < 1000000000l && attempts < 30) { 
            delay(500);
            attempts++;
        }
        
        if (time(nullptr) > 1000000000l) {
            ESP_LOGI(TAG, "SYS - Reloj interno calibrado exitosamente con NTP.");
        } else {
            ESP_LOGE(TAG, "SYS - TIMEOUT NTP: No se pudo obtener la hora.");
        }

        if (MDNS.begin("edgenode")) {
            ESP_LOGI(TAG, "NET - mDNS Responder activo. Accesible en: http://edgenode.local");
        }
        
        return true;
    } else {
        ESP_LOGE(TAG, "NET - Timeout. No se pudo establecer conexión con el SSID.");
        return false;
    }
}

void NetworkManager::initNTP() {
    Preferences prefs;
    prefs.begin("wifi", true); 
    String ntpServer = prefs.getString("ntp", "time.google.com");
    String tz = prefs.getString("tz", "CST6CDT,M4.1.0,M10.5.0"); 
    prefs.end();
    ESP_LOGI(TAG, "SYS - NTP Server: %s | TZ: %s", ntpServer.c_str(), tz.c_str());
    configTzTime(tz.c_str(), ntpServer.c_str());
}

void NetworkManager::setupWebServerOOBE(AsyncWebServer* server) {
    server->on("/api/oobe/status", HTTP_GET, [](AsyncWebServerRequest *request) {
        bool isClaimed = SecMgr.isProvisioned();
        auto response = request->beginResponse(200, "application/json", 
            "{\"is_claimed\":" + String(isClaimed ? "true" : "false") + "}");
        addSecurityHeaders(response); 
        request->send(response);
    });

    server->on("/api/wifi/scan", HTTP_GET, [](AsyncWebServerRequest *request) {
        int n = WiFi.scanComplete();
        if (n == -2) {
            WiFi.scanNetworks(true);
            auto response = request->beginResponse(202, "application/json", "{\"status\":\"scanning\"}");
            addSecurityHeaders(response); request->send(response);
        } else if (n == -1) {
            auto response = request->beginResponse(202, "application/json", "{\"status\":\"scanning\"}");
            addSecurityHeaders(response); request->send(response);
        } else {
            JsonDocument doc; JsonArray nets = doc.to<JsonArray>();
            for (int i = 0; i < n; ++i) {
                JsonObject net = nets.add<JsonObject>();
                net["ssid"] = WiFi.SSID(i); net["rssi"] = WiFi.RSSI(i);
                net["secure"] = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
            }
            WiFi.scanDelete();
            String responseStr; serializeJson(doc, responseStr);
            auto response = request->beginResponse(200, "application/json", responseStr);
            addSecurityHeaders(response); request->send(response);
        }
    });

    AsyncCallbackJsonWebHandler* setupHandler = new AsyncCallbackJsonWebHandler("/api/setup", [](AsyncWebServerRequest *request, JsonVariant &json) {
        JsonObject data = json.as<JsonObject>();
        String ssid = data["ssid"].as<String>();
        String pass = data["pass"].as<String>();
        String username = data["username"].as<String>();
        String password = data["password"].as<String>();

        if (SecMgr.isProvisioned()) {
            if (!SecMgr.authenticateUser(username, password)) {
                auto response = request->beginResponse(401, "application/json", "{\"error\":\"Credenciales de administrador incorrectas.\"}");
                addSecurityHeaders(response); request->send(response);
                return;
            }
        } else {
            if (!SecMgr.registerAdmin(username, password)) {
                auto response = request->beginResponse(500, "application/json", "{\"error\":\"Fallo al registrar administrador en NVS.\"}");
                addSecurityHeaders(response); request->send(response);
                return;
            }
        }

        Preferences prefs;
        prefs.begin("net", false);
        prefs.putString("ssid", ssid);
        prefs.putString("pass", pass);
        if (data.containsKey("dhcp")) prefs.putBool("dhcp", data["dhcp"].as<bool>());
        if (data.containsKey("ip")) prefs.putString("ip", data["ip"].as<String>());
        if (data.containsKey("gateway")) prefs.putString("gw", data["gateway"].as<String>());
        if (data.containsKey("subnet")) prefs.putString("sn", data["subnet"].as<String>());
        if (data.containsKey("dns")) prefs.putString("dns", data["dns"].as<String>());
        prefs.end();

        auto response = request->beginResponse(200, "application/json", "{\"message\":\"Configuración aplicada. Reiniciando nodo...\"}");
        addSecurityHeaders(response); request->send(response);
        
        delay(1000); ESP.restart();
    });
    server->addHandler(setupHandler);

    server->serveStatic("/", LittleFS, "/www/").setDefaultFile("index.html");
    server->onNotFound([](AsyncWebServerRequest *request) {
        if (request->method() == HTTP_OPTIONS) { request->send(200); } 
        else {
            auto response = request->beginResponse(LittleFS, "/www/index.html", "text/html");
            addSecurityHeaders(response); request->send(response);
        }
    });

    server->begin();
    ESP_LOGI(TAG, "SYS - OOBE Web Server en escucha.");
}

void NetworkManager::setupOTAEndpoints(AsyncWebServer* server) {
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
}

void NetworkManager::handleLoop() {
    static unsigned long lastWifiCheck = 0;
    if (WiFi.getMode() == WIFI_STA && millis() - lastWifiCheck > 30000) { 
        lastWifiCheck = millis();
        if (WiFi.status() != WL_CONNECTED) {
            ESP_LOGW(TAG, "NET - Enlace WiFi caído (Router reiniciado/Lejos). Forzando reconexión...");
            WiFi.disconnect();
            WiFi.reconnect();
        }
    }
}
