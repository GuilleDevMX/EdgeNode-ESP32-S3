#include "ApiServer.h"
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <AsyncJson.h>
#include <ArduinoJson.h>
#include "SecurityManager.h"
#include "NotificationManager.h"
#include "NetworkManager.h"
#include "TelemetryManager.h"
#include <Preferences.h>
#include <time.h>
#include <esp_log.h>
#include "CryptoUtils.h"
#include <map>
#include <nvs.h>
#include <nvs_flash.h>
#include <esp_check.h>

static const char *TAG = "ApiServer";

extern Preferences prefs;
extern SemaphoreHandle_t nvsMutex;
extern SemaphoreHandle_t sessionMutex;

extern String currentSessionToken;
extern String currentSessionRole;
extern time_t sessionExpirationEpoch;

extern bool pendingReboot;
extern unsigned long rebootRequestTime;
extern const unsigned long REBOOT_DELAY_MS;

struct LoginAttempt {
    uint8_t count;
    uint32_t firstAttempt;
};

std::map<String, LoginAttempt> loginAttempts;  // Mapa IP -> intentos
const uint8_t MAX_LOGIN_ATTEMPTS = 5;
const uint32_t LOGIN_WINDOW_MS = 300000;  // 5 minutos


// --- SERVIDORES WEB ---
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");


bool isRateLimited(const String& clientIP) {

    if (loginAttempts.size() > 50) loginAttempts.clear();
    
    uint32_t now = millis();
    
    // Limpiar entradas expiradas
    for(auto it = loginAttempts.begin(); it != loginAttempts.end(); ) {
        if(now - it->second.firstAttempt > LOGIN_WINDOW_MS) {
            it = loginAttempts.erase(it);
        } else {
            ++it;
        }
    }
    
    auto& attempt = loginAttempts[clientIP];
    if(now - attempt.firstAttempt > LOGIN_WINDOW_MS) {
        attempt.count = 1;
        attempt.firstAttempt = now;
        return false;
    }
    
    attempt.count++;
    if(attempt.count > MAX_LOGIN_ATTEMPTS) {
        ESP_LOGW(TAG, "SEC - Rate limit excedido para IP: %s", clientIP.c_str());
        return true;
    }
    return false;
}

bool safeNvsRead(const char* ns, const char* key, String& value, const String& defaultVal) {
    if (xSemaphoreTake(nvsMutex, pdMS_TO_TICKS(500)) != pdTRUE) return false;
    Preferences p; p.begin(ns, true);
    value = p.getString(key, defaultVal);
    p.end(); xSemaphoreGive(nvsMutex); return true;
}

bool safeNvsRead(const char* ns, const char* key, int& value, int defaultVal) {
    if (xSemaphoreTake(nvsMutex, pdMS_TO_TICKS(500)) != pdTRUE) return false;
    Preferences p; p.begin(ns, true);
    value = p.getInt(key, defaultVal);
    p.end(); xSemaphoreGive(nvsMutex); return true;
}

bool safeNvsRead(const char* ns, const char* key, bool& value, bool defaultVal) {
    if (xSemaphoreTake(nvsMutex, pdMS_TO_TICKS(500)) != pdTRUE) return false;
    Preferences p; p.begin(ns, true);
    value = p.getBool(key, defaultVal);
    p.end(); xSemaphoreGive(nvsMutex); return true;
}

bool safeNvsRead(const char* ns, const char* key, float& value, float defaultVal) {
    if (xSemaphoreTake(nvsMutex, pdMS_TO_TICKS(500)) != pdTRUE) return false;
    Preferences p; p.begin(ns, true);
    value = p.getFloat(key, defaultVal);
    p.end(); xSemaphoreGive(nvsMutex); return true;
}

bool isIpAllowed(AsyncWebServerRequest *request) {
    bool allowlistEnabled = false; String allowedIps = "";
    safeNvsRead("sec", "al_en", allowlistEnabled, false);
    safeNvsRead("sec", "al_ips", allowedIps, String(""));

    if (!allowlistEnabled) return true; 

    String clientIP = request->client()->remoteIP().toString();
    
    String searchIP = "\n" + clientIP + "\n";
    String safeList = "\n" + allowedIps + "\n";
    safeList.replace("\r\n", "\n"); 

    if (safeList.indexOf(searchIP) != -1) {
        return true;
    }
    
    ESP_LOGW(TAG, "Firewall - Bloqueo Activo: IP %s rechazada.", clientIP.c_str());
    return false;
}

bool isAuthorized(AsyncWebServerRequest *request, String requiredRole) {
    if(!request->hasHeader("Authorization")) return false;
    
    String bearer = request->header("Authorization");
    if(!bearer.startsWith("Bearer ")) return false;
    String tokenStr = bearer.substring(7); 

    if (requiredRole == "m2m_dataset") {
        String incomingHash = generateSHA256(tokenStr);
        prefs.begin("apikeys", true);
        for(int i=0; i<5; i++) {
            if(prefs.getString(("k_hash_" + String(i)).c_str(), "") == incomingHash) {
                prefs.end(); 
                return true; 
            }
        }
        prefs.end();
        return false;
    }

    bool authorized = false;
    if (xSemaphoreTake(sessionMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        if(currentSessionToken != "" && tokenStr == currentSessionToken) {
            time_t now; time(&now);
            if (sessionExpirationEpoch == 0 || now <= sessionExpirationEpoch) {
                // Verificar rol
                if (requiredRole == "viewer") {
                    authorized = true;
                } else if (requiredRole == "operator") {
                    if (currentSessionRole == "admin" || currentSessionRole == "operator") 
                        authorized = true;
                } else if (requiredRole == "admin") {
                    if (currentSessionRole == "admin") 
                        authorized = true;
                }
            } else {
                ESP_LOGW(TAG, "IAM - Token expirado. Limpiando sesión.");
                currentSessionToken = ""; 
                currentSessionRole = "";
                sessionExpirationEpoch = 0;
            }
        }
        xSemaphoreGive(sessionMutex);
    } else {
        ESP_LOGE(TAG, "IAM - Timeout esperando mutex de sesión");
        return false;
    }

    if (!authorized) {
        ESP_LOGW(TAG, "IAM - Acceso denegado. Rol actual: %s, Requerido: %s", 
                 currentSessionRole.c_str(), requiredRole.c_str());
    }
    return authorized;
}

void addSecurityHeaders(AsyncWebServerResponse *response) {
    response->addHeader("X-Content-Type-Options", "nosniff");
    response->addHeader("X-Frame-Options", "DENY");
    response->addHeader("X-XSS-Protection", "1; mode=block");
    response->addHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    response->addHeader("Referrer-Policy", "strict-origin-when-cross-origin");
}

void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
    if (type == WS_EVT_CONNECT) {
        ESP_LOGI(TAG, "WS - Cliente Conectado. ID: %u.", client->id());
    } else if (type == WS_EVT_DATA) {
        AwsFrameInfo *info = (AwsFrameInfo*)arg;
        if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
            data[len] = 0; 
            String msg = (char*)data;
            
            if (msg.indexOf("\"type\":\"auth\"") > 0) {
                StaticJsonDocument<256> doc;
                DeserializationError error = deserializeJson(doc, msg);
                
                if (!error && doc.containsKey("token")) {
                    String receivedToken = doc["token"].as<String>();
                    
                    bool tokenValid = false;
                    if (xSemaphoreTake(sessionMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                        if (currentSessionToken != "" && receivedToken == currentSessionToken) {
                            tokenValid = true;
                        }
                        xSemaphoreGive(sessionMutex);
                    }
                    
                    if (tokenValid) {
                        client->text("{\"type\":\"status\",\"message\":\"Autenticación aceptada\"}");
                    } else {
                        ESP_LOGW(TAG, "WS - Token inválido. Cerrando conexión ID: %u.", client->id());
                        client->text("{\"type\":\"error\",\"message\":\"invalid_token\"}");
                        client->close();
                    }
                } else {
                    ESP_LOGW(TAG, "WS - JSON malformed en auth. Cerrando conexión.");
                    client->close();
                }
            }
        }
    } else if (type == WS_EVT_DISCONNECT) {
        ESP_LOGI(TAG, "WS - Cliente Desconectado. ID: %u.", client->id());
    }
}

void ApiServer::cleanup() {
    ws.closeAll();
    server.reset();
    // Liberar handlers dinámicos si se usó 'new'
}

void writeAuditLog(String severity, String user, String action) {
    if (WiFi.status() != WL_CONNECTED) return; // Requerimos NTP

    File file = LittleFS.open("/www/audit.csv", "a");
    if (!file) return;

    // Rotación de logs (Máximo 50KB para no gastar la memoria flash)
    if (file.size() > 50 * 1024) {
        file.close();
        LittleFS.remove("/www/audit_old.csv");
        LittleFS.rename("/www/audit.csv", "/www/audit_old.csv");
        file = LittleFS.open("/www/audit.csv", "w");
        file.println("timestamp,severity,user,action");
    } else if (file.size() == 0) {
        file.println("timestamp,severity,user,action");
    }

    time_t now; time(&now);
    if (now > 1600000000LL) {
        struct tm timeinfo;
        localtime_r(&now, &timeinfo);
        char buf[30];
        strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
        
        // Formato: Fecha, Nivel, Usuario, Acción
        file.printf("%s,%s,%s,\"%s\"\n", buf, severity.c_str(), user.c_str(), action.c_str());
    }
    file.close();
}

esp_err_t ApiServer::begin(bool oobeMode) {
    if (oobeMode) {
        return NetMgr.setupWebServerOOBE(&server);
    }

    server.on("/api/oobe/status", HTTP_GET, [](AsyncWebServerRequest *request) {
        bool isClaimed = SecMgr.isProvisioned();
        auto response = request->beginResponse(200, "application/json", 
            "{\"is_provisioned\":" + String(isClaimed ? "true" : "false") + "}");
        addSecurityHeaders(response); 
        request->send(response);
    });

    
    // ========================================================================
    // 1. DIAGNÓSTICO Y SALUD (Healthchecks)
    // ========================================================================
    server.on("/api/health", HTTP_GET, [](AsyncWebServerRequest *request) {
        JsonDocument doc;
        doc["status"] = "online";
        doc["uptime_seconds"] = millis() / 1000;
        doc["free_heap_kb"] = ESP.getFreeHeap() / 1024;
        doc["wifi_rssi"] = WiFi.RSSI();
        
        String response; serializeJson(doc, response);
        auto resp = request->beginResponse(200, "application/json", response);
        addSecurityHeaders(resp); request->send(resp);
    });

    server.on("/api/system/battery", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403, "application/json", "{\"error\":\"Firewall\"}"); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"Unauthorized\"}"); addSecurityHeaders(r); request->send(r); return; }
        
        JsonDocument doc;
        doc["voltage"] = TelemetryMgr.getBatteryVoltage();
        doc["percentage"] = TelemetryMgr.getBatteryPercentage(TelemetryMgr.getBatteryVoltage());
        doc["power_state"] = TelemetryMgr.getPowerState();
        
        String response; serializeJson(doc, response);
        auto resp = request->beginResponse(200, "application/json", response);
        addSecurityHeaders(resp); request->send(resp);
    });

    // ========================================================================
    // 2. GESTIÓN DE IDENTIDADES Y ACCESOS (IAM)
    // ========================================================================
    AsyncCallbackJsonWebHandler* loginHandler = new AsyncCallbackJsonWebHandler("/api/login", [](AsyncWebServerRequest *request, JsonVariant &json) {
        String clientIP = request->client()->remoteIP().toString();
        
        if (isRateLimited(clientIP)) {
            auto resp = request->beginResponse(429, "application/json", "{\"error\":\"Demasiados intentos. Intente en 5 minutos.\"}");
            addSecurityHeaders(resp); request->send(resp); return;
        }
        
        if(!isIpAllowed(request)) { 
            auto resp = request->beginResponse(403, "application/json", "{\"error\":\"Firewall: IP Bloqueada.\"}");
            addSecurityHeaders(resp); request->send(resp); return; 
        }
        
        JsonObject payload = json.as<JsonObject>();
        String user = payload["username"] | "";
        String pass = payload["password"] | "";

        // 🛡️ Delegación a SecurityManager
        bool authOk = SecMgr.authenticateUser(user, pass);

        if (authOk) {
            uint32_t r1 = esp_random(); uint32_t r2 = esp_random(); uint32_t r3 = esp_random();
            currentSessionToken = "ESP32_SEC_" + String(r1, HEX) + String(r2, HEX) + String(r3, HEX) + "_" + String(millis());
            currentSessionRole = SecMgr.getUserRole(user);

            prefs.begin("sec", true);
            int expMinutes = prefs.getString("jwt_exp", "15").toInt();
            prefs.end();
            
            time_t now; time(&now);
            if (now > 1000000000l) {
                if (xSemaphoreTake(sessionMutex, portMAX_DELAY) == pdTRUE) {
                    sessionExpirationEpoch = now + (expMinutes * 60);
                    xSemaphoreGive(sessionMutex);
                }
            } else {
                sessionExpirationEpoch = 0;
            }

            ESP_LOGI(TAG, "IAM - Auth OK. User: %s | Rol: %s", user.c_str(), currentSessionRole.c_str());
            
            JsonDocument respDoc;
            respDoc["status"] = "ok";
            respDoc["token"] = currentSessionToken;
            respDoc["role"] = currentSessionRole;
            String response; serializeJson(respDoc, response);
            // Registrar la creación en la auditoría
            String logMsg = "Login exitoso desde IP: " + clientIP + " con rol: " + currentSessionRole;
            writeAuditLog("INFO", user, logMsg);
            auto resp = request->beginResponse(200, "application/json", response);
            addSecurityHeaders(resp); request->send(resp);
            
            loginAttempts.erase(clientIP);
        } else {
            ESP_LOGW(TAG, "IAM - Login fallido para: %s desde %s", user.c_str(), clientIP.c_str());
            auto resp = request->beginResponse(401, "application/json", "{\"error\":\"Credenciales no válidas\"}");
            addSecurityHeaders(resp); request->send(resp);
        }
    });
    server.addHandler(loginHandler);

    server.on("/api/system/rotate_key", HTTP_POST, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403, "application/json", "{\"error\":\"Firewall\"}"); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"Unauthorized\"}"); addSecurityHeaders(r); request->send(r); return; }
        
        ESP_LOGE(TAG, "CRIT - Llave de sesión rotada manualmente.");
        if (xSemaphoreTake(sessionMutex, portMAX_DELAY) == pdTRUE) {
            currentSessionToken = ""; currentSessionRole = ""; sessionExpirationEpoch = 0;
            xSemaphoreGive(sessionMutex);
        }

        // Registrar la creación en la auditoría
            String logMsg = "Rotación manual de clave de sesión por administrador.";
            writeAuditLog("CRITICAL", "admin", logMsg);
        auto resp = request->beginResponse(200, "application/json", "{\"status\":\"success\"}");
        addSecurityHeaders(resp); request->send(resp);
    });

    server.on("/api/users", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }
        JsonDocument doc; JsonArray usersArray = doc.to<JsonArray>();
        JsonObject rootObj = usersArray.add<JsonObject>();
        rootObj["id"] = "root"; rootObj["username"] = "admin";
        rootObj["role"] = "admin"; rootObj["last_login"] = "Protegido";

        prefs.begin("users", true);
        for(int i=0; i<5; i++) {
            String uName = prefs.getString(("u_name_" + String(i)).c_str(), "");
            if(uName != "") {
                JsonObject uObj = usersArray.add<JsonObject>();
                uObj["id"] = String(i); uObj["username"] = uName;
                uObj["role"] = prefs.getString(("u_role_" + String(i)).c_str(), "viewer");
                uObj["last_login"] = "Desconocido";
            }
        }
        prefs.end();
        String response; serializeJson(doc, response);
        // Registrar la creación en la auditoría
            String logMsg = "Listado de usuarios solicitado por administrador.";
            writeAuditLog("INFO", "admin", logMsg);
        auto r = request->beginResponse(200, "application/json", response); addSecurityHeaders(r); request->send(r);
    });

    AsyncCallbackJsonWebHandler* usersCreateHandler = new AsyncCallbackJsonWebHandler("/api/users", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        if(request->method() == HTTP_POST) {
            JsonObject data = json.as<JsonObject>();
            String username = data["username"] | ""; String password = data["password"] | ""; String role = data["role"] | "viewer";
            if(username == "" || password == "") { auto r = request->beginResponse(400, "application/json", "{\"error\":\"Datos incompletos.\"}"); addSecurityHeaders(r); request->send(r); return; }

            prefs.begin("users", false); int slot = -1;
            for(int i=0; i<5; i++) { if(prefs.getString(("u_name_" + String(i)).c_str(), "") == "") { slot = i; break; } }
            if(slot == -1) { prefs.end(); auto r = request->beginResponse(400, "application/json", "{\"error\":\"Límite alcanzado.\"}"); addSecurityHeaders(r); request->send(r); return; }

            String salt = generateRandomHex(16);
            String passHash = generateSHA256(password + salt);
            prefs.putString(("u_name_" + String(slot)).c_str(), username);
            prefs.putString(("u_hash_" + String(slot)).c_str(), passHash);
            prefs.putString(("u_salt_" + String(slot)).c_str(), salt);
            prefs.putString(("u_role_" + String(slot)).c_str(), role);
            prefs.end();
            ESP_LOGI(TAG, "IAM - Nuevo usuario en slot %d", slot);

            // Registrar la creación en la auditoría
            String logMsg = "Creación de nuevo usuario: " + username + " con rol: " + role;
            writeAuditLog("INFO", "admin", logMsg);
            auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}"); addSecurityHeaders(r); request->send(r);

        }
    }); server.addHandler(usersCreateHandler);

    server.on("/api/users", HTTP_DELETE, [](AsyncWebServerRequest *request) {
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        if (request->hasParam("id")) {
            String idStr = request->getParam("id")->value();
            if(idStr == "root") { auto r = request->beginResponse(403, "application/json", "{\"error\":\"No Root.\"}"); addSecurityHeaders(r); request->send(r); return; }
            int slot = idStr.toInt();
            if(slot >= 0 && slot < 5) {
                prefs.begin("users", false);
                prefs.remove(("u_name_" + String(slot)).c_str()); prefs.remove(("u_hash_" + String(slot)).c_str());
                prefs.remove(("u_salt_" + String(slot)).c_str()); prefs.remove(("u_role_" + String(slot)).c_str());
                prefs.end();
                // Registrar la creación en la auditoría
                String logMsg = "Eliminación de usuario en slot: " + idStr;
                writeAuditLog("WARNING", "admin", logMsg);
                auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}"); addSecurityHeaders(r); request->send(r);
            } else { auto r = request->beginResponse(400, "application/json", "{\"error\":\"ID inválido.\"}"); addSecurityHeaders(r); request->send(r); }
        } else { auto r = request->beginResponse(400, "application/json", "{\"error\":\"Falta ID.\"}"); addSecurityHeaders(r); request->send(r); }
    });

    server.on("/api/keys", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }
        JsonDocument doc; JsonArray keysArray = doc.to<JsonArray>();
        prefs.begin("apikeys", true);
        for(int i=0; i<5; i++) {
            String prefixKey = "k_pfx_" + String(i);
            if(prefs.isKey(prefixKey.c_str())) {
                JsonObject keyObj = keysArray.add<JsonObject>();
                keyObj["id"] = String(i); keyObj["name"] = prefs.getString(("k_name_" + String(i)).c_str(), "Unknown");
                keyObj["prefix"] = prefs.getString(prefixKey.c_str(), "••••••"); keyObj["expiration_date"] = prefs.getString(("k_exp_" + String(i)).c_str(), "Never");
            }
        }
        prefs.end();
        String response; serializeJson(doc, response);
        auto r = request->beginResponse(200, "application/json", response); addSecurityHeaders(r); request->send(r);
    });

    AsyncCallbackJsonWebHandler* keyCreateHandler = new AsyncCallbackJsonWebHandler("/api/keys", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        JsonObject data = json.as<JsonObject>();
        String name = data["name"] | "Service Account"; String expDays = data["expiration"] | "30";

        time_t now; time(&now); struct tm timeinfo; bool isTimeSynced = false;
        if (getLocalTime(&timeinfo, 10)) { if (timeinfo.tm_year > 120) isTimeSynced = true; }

        String rawToken = "edg_" + String(esp_random(), HEX) + "_" + String(millis());
        String hashedToken = generateSHA256(rawToken); String prefix = rawToken.substring(0, 10);

        prefs.begin("apikeys", false); int slot = -1;
        for(int i=0; i<5; i++) { if(!prefs.isKey(("k_hash_" + String(i)).c_str())) { slot = i; break; } }
        if(slot == -1) { prefs.end(); auto r = request->beginResponse(400, "application/json", "{\"error\":\"Límite máximo.\"}"); addSecurityHeaders(r); request->send(r); return; }

        String expDateStr = "Pendiente de Sync";
        if (expDays != "never") {
            if (isTimeSynced) {
                time_t expTime = now + (expDays.toInt() * 86400);
                struct tm *ti = localtime(&expTime);
                char buf[30]; strftime(buf, sizeof(buf), "%d/%m/%Y", ti); expDateStr = String(buf);
            } else expDateStr = "Sync Requerido";
        }

        prefs.putString(("k_name_" + String(slot)).c_str(), name); prefs.putString(("k_hash_" + String(slot)).c_str(), hashedToken);
        prefs.putString(("k_pfx_" + String(slot)).c_str(), prefix); prefs.putString(("k_exp_" + String(slot)).c_str(), expDateStr);
        prefs.end();
        // Registrar la creación en la auditoría
        String logMsg = "Creación de nueva clave API: " + name + " con expiración: " + expDateStr;
        writeAuditLog("INFO", "admin", logMsg);
        auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\",\"token\":\"" + rawToken + "\"}"); addSecurityHeaders(r); request->send(r);
    }); server.addHandler(keyCreateHandler);

    server.on("/api/keys", HTTP_DELETE, [](AsyncWebServerRequest *request) {
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        if (request->hasParam("id")) {
            int slot = request->getParam("id")->value().toInt();
            if(slot >= 0 && slot < 5) {
                prefs.begin("apikeys", false);
                prefs.remove(("k_name_" + String(slot)).c_str()); prefs.remove(("k_hash_" + String(slot)).c_str());
                prefs.remove(("k_pfx_" + String(slot)).c_str());  prefs.remove(("k_exp_" + String(slot)).c_str());
                prefs.end();
                // Registrar la creación en la auditoría
                String logMsg = "Eliminación de clave API en slot: " + String(slot);
                writeAuditLog("WARNING", "admin", logMsg);
                auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}"); addSecurityHeaders(r); request->send(r);
            } else { auto r = request->beginResponse(400, "application/json", "{\"error\":\"ID inválido.\"}"); addSecurityHeaders(r); request->send(r); }
        } else { auto r = request->beginResponse(400, "application/json", "{\"error\":\"Falta ID.\"}"); addSecurityHeaders(r); request->send(r); }
    });

    // ========================================================================
    // 3. EXTRACCIÓN DE DATOS Y TELEMETRÍA
    // ========================================================================
    server.on("/api/dataset", HTTP_GET, [](AsyncWebServerRequest *request){
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403, "application/json", "{\"error\":\"Firewall\"}"); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "operator") && !isAuthorized(request, "m2m_dataset")) { 
            auto r = request->beginResponse(401, "application/json", "{\"error\":\"Acceso Denegado.\"}"); addSecurityHeaders(r); request->send(r); return; 
        }
        
        String fileName = "/www/dataset.csv";
        if (request->hasParam("date")) {
            fileName = "/dataset_" + request->getParam("date")->value() + ".csv";
        } else {
            time_t now; time(&now);
            if (now > 1600000000LL) {
                struct tm timeinfo;
                localtime_r(&now, &timeinfo);
                char buf[30];
                strftime(buf, sizeof(buf), "/dataset_%Y-%m-%d.csv", &timeinfo);
                if (LittleFS.exists(buf)) {
                    fileName = String(buf);
                }
            }
        }

        if(LittleFS.exists(fileName.c_str())) {
            auto r = request->beginResponse(LittleFS, fileName.c_str(), "text/csv", true); addSecurityHeaders(r); request->send(r);
        } else {
            auto r = request->beginResponse(200, "text/csv", "timestamp,temperature,humidity,battery_v\n"); addSecurityHeaders(r); request->send(r);
        }
    });

    server.on("/api/datasets", HTTP_GET, [](AsyncWebServerRequest *request){
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403, "application/json", "{\"error\":\"Firewall\"}"); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "operator") && !isAuthorized(request, "m2m_dataset")) { 
            auto r = request->beginResponse(401, "application/json", "{\"error\":\"Acceso Denegado.\"}"); addSecurityHeaders(r); request->send(r); return; 
        }
        
        JsonDocument doc; JsonArray files = doc.to<JsonArray>();
        File root = LittleFS.open("/");
        File file = root.openNextFile();
        while(file) {
            String name = file.name();
            if (name.startsWith("dataset_") && name.endsWith(".csv")) {
                String dateStr = name.substring(8, 18);
                JsonObject obj = files.add<JsonObject>();
                obj["date"] = dateStr;
                obj["size"] = file.size();
            } else if (name == "dataset.csv") {
                JsonObject obj = files.add<JsonObject>();
                obj["date"] = "today";
                obj["size"] = file.size();
            }
            file = root.openNextFile();
        }
        String response; serializeJson(doc, response);
        auto r = request->beginResponse(200, "application/json", response); addSecurityHeaders(r); request->send(r);
    });

    server.on("/api/config/storage", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }
        JsonDocument doc; prefs.begin("data", true);
        doc["retention"] = prefs.getInt("retention", 1);
        prefs.end();
        String response; serializeJson(doc, response);
        auto r = request->beginResponse(200, "application/json", response); addSecurityHeaders(r); request->send(r);
    });

    AsyncCallbackJsonWebHandler* storageUpdateHandler = new AsyncCallbackJsonWebHandler("/api/config/storage", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        JsonObject data = json.as<JsonObject>(); prefs.begin("data", false);
        if(data["retention"].is<int>()) prefs.putInt("retention", data["retention"].as<int>());
        prefs.end();
        TelemetryMgr.cleanupOldDatasets(); // Forzar limpieza
        auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}"); addSecurityHeaders(r); request->send(r);
    });
    server.addHandler(storageUpdateHandler);
    
    ws.onEvent(onWsEvent); 
    server.addHandler(&ws);

    // --- LECTURA DE LOGS CON FILTRO RBAC ---
    server.on("/api/system/logs", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        
        // 1. Verificar Token
        String authToken = request->header("Authorization");
        if(!authToken.startsWith("Bearer ")) { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }
        
        // 2. Extraer Rol de la sesión actual
        String role = currentSessionRole; 
        if (role == "") { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }

        if(!LittleFS.exists("/www/audit.csv")) {
            auto r = request->beginResponse(200, "application/json", "[]");
            addSecurityHeaders(r); request->send(r); return;
        }

        File file = LittleFS.open("/www/audit.csv", "r");
        JsonDocument doc; JsonArray logs = doc.to<JsonArray>();
        
        if (file) {
            String header = file.readStringUntil('\n'); // Saltar cabecera
            while (file.available()) {
                String line = file.readStringUntil('\n');
                line.trim();
                if (line.length() == 0) continue;

                // Parsear CSV manual rápido
                int comma1 = line.indexOf(',');
                int comma2 = line.indexOf(',', comma1 + 1);
                int comma3 = line.indexOf(',', comma2 + 1);

                if (comma1 > 0 && comma2 > 0 && comma3 > 0) {
                    String severity = line.substring(comma1 + 1, comma2);
                    
                    // LÓGICA RBAC: Filtrar según el rol
                    bool canView = false;
                    if (role == "admin") canView = true;
                    else if (role == "operator" && (severity == "INFO" || severity == "WARN")) canView = true;
                    else if (role == "viewer" && severity == "INFO") canView = true;

                    if (canView) {
                        JsonObject obj = logs.add<JsonObject>();
                        obj["timestamp"] = line.substring(0, comma1);
                        obj["severity"] = severity;
                        obj["user"] = line.substring(comma2 + 1, comma3);
                        String action = line.substring(comma3 + 1);
                        action.replace("\"", ""); // Quitar comillas
                        obj["action"] = action;
                    }
                }
            }
            file.close();
        }
        
        String response; serializeJson(doc, response);
        // Registrar la creación en la auditoría
        String logMsg = "Solicitud de logs de auditoría. Rol: " + role;
        writeAuditLog("INFO", "admin", logMsg);
        auto r = request->beginResponse(200, "application/json", response);
        addSecurityHeaders(r); request->send(r);
    });

    // --- BORRADO DE LOGS (CON FIRMA DE ADMIN) ---
    AsyncCallbackJsonWebHandler* clearLogsHandler = new AsyncCallbackJsonWebHandler("/api/system/logs/clear", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        
        JsonObject data = json.as<JsonObject>();
        String password = data["password"] | "";

        // Verificamos explícitamente que la contraseña introducida sea la del Root/Admin
        if (!SecMgr.authenticateUser("admin", password)) {
            // Dormimos 2 segundos para mitigar ataques de fuerza bruta
            vTaskDelay(pdMS_TO_TICKS(2000));
            auto r = request->beginResponse(403, "application/json", "{\"error\":\"Contraseña de administrador incorrecta.\"}");
            addSecurityHeaders(r); request->send(r); return;
        }

        // Si la contraseña es correcta, borramos
        LittleFS.remove("/www/audit.csv");
        LittleFS.remove("/www/audit_old.csv");
        
        writeAuditLog("CRIT", "admin", "PURGA DE LOGS DE AUDITORÍA DEL SISTEMA");
        ESP_LOGW(TAG, "SYS - Logs de auditoría borrados por el Administrador.");
        // Registrar la creación en la auditoría
        String logMsg = "Purgado de logs de auditoría por administrador.";
        auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}");
        addSecurityHeaders(r); request->send(r);
    }); 
    server.addHandler(clearLogsHandler);

    // ========================================================================
    // 4. CONFIGURACIONES DEL SISTEMA (Red, Sensores, Seguridad, SMTP)
    // ========================================================================
    server.on("/api/config/network", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }
        
        JsonDocument doc; 
        prefs.begin("net", true); 
        doc["ssid"] = prefs.getString("ssid", ""); doc["dhcp"] = prefs.getBool("dhcp", true);
        doc["ip"] = prefs.getString("ip", "192.168.1.200"); doc["gateway"] = prefs.getString("gw", "192.168.1.1");
        doc["subnet"] = prefs.getString("sn", "255.255.255.0"); doc["dns"] = prefs.getString("dns", "8.8.8.8");
        prefs.end();
        
        prefs.begin("wifi", true);
        doc["ap_ssid"] = prefs.getString("ap_ssid", ""); doc["ap_hide"] = prefs.getBool("ap_hide", false);
        doc["mdns"] = prefs.getString("mdns", "edgenode"); doc["ntp"] = prefs.getString("ntp", "time.google.com");
        doc["tz"] = prefs.getString("tz", "CST6");
        prefs.end();
        
        String response; serializeJson(doc, response); 
        auto r = request->beginResponse(200, "application/json", response); addSecurityHeaders(r); request->send(r);
    });

    AsyncCallbackJsonWebHandler* netUpdateHandler = new AsyncCallbackJsonWebHandler("/api/config/network", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        JsonObject data = json.as<JsonObject>(); 
        prefs.begin("net", false);
        if(data["ssid"].is<String>()) prefs.putString("ssid", data["ssid"].as<String>());
        if(data["pass"].is<String>()) { String p = data["pass"].as<String>(); if(p != "") prefs.putString("pass", p); }
        if(data["dhcp"].is<bool>()) prefs.putBool("dhcp", data["dhcp"].as<bool>());
        if(data["ip"].is<String>()) prefs.putString("ip", data["ip"].as<String>());
        if(data["gateway"].is<String>()) prefs.putString("gw", data["gateway"].as<String>());
        if(data["subnet"].is<String>()) prefs.putString("sn", data["subnet"].as<String>());
        if(data["dns"].is<String>()) prefs.putString("dns", data["dns"].as<String>());
        prefs.end();

        prefs.begin("wifi", false);
        if(data["ap_ssid"].is<String>()) prefs.putString("ap_ssid", data["ap_ssid"].as<String>());
        if(data["ap_pass"].is<String>()) { String ap_p = data["ap_pass"].as<String>(); if(ap_p != "") prefs.putString("ap_pass", ap_p); }
        if(data["ap_hide"].is<bool>()) prefs.putBool("ap_hide", data["ap_hide"].as<bool>());
        if(data["mdns"].is<String>()) prefs.putString("mdns", data["mdns"].as<String>());
        if(data["ntp"].is<String>()) prefs.putString("ntp", data["ntp"].as<String>());
        if(data["tz"].is<String>()) prefs.putString("tz", data["tz"].as<String>());
        prefs.end();
        ESP_LOGI(TAG, "SYS - Configuración de Red actualizada.");
        // Registrar la creación en la auditoría
        String logMsg = "Actualización de configuración de red. Cambios: ";
        if(data["ssid"].is<String>()) logMsg += "SSID; ";
        if(data["pass"].is<String>()) logMsg += "Password; ";
        if(data["dhcp"].is<bool>()) logMsg += "DHCP; ";
        if(data["ip"].is<String>()) logMsg += "IP; ";
        if(data["gateway"].is<String>()) logMsg += "Gateway; ";
        if(data["subnet"].is<String>()) logMsg += "Subnet; ";
        if(data["dns"].is<String>()) logMsg += "DNS; ";
        if(data["ap_ssid"].is<String>()) logMsg += "AP SSID; ";
        if(data["ap_pass"].is<String>()) logMsg += "AP Password; ";
        if(data["ap_hide"].is<bool>()) logMsg += "AP Hide; ";
        if(data["mdns"].is<String>()) logMsg += "mDNS; ";
        if(data["ntp"].is<String>()) logMsg += "NTP; ";
        if(data["tz"].is<String>()) logMsg += "Timezone; ";
        writeAuditLog("INFO", "admin", logMsg);
        auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\",\"message\":\"Red guardada. Reiniciando...\"}"); addSecurityHeaders(r); request->send(r);
        pendingReboot = true; rebootRequestTime = millis();
    }); server.addHandler(netUpdateHandler);

    server.on("/api/config/security", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }
        JsonDocument doc; prefs.begin("sec", true);
        doc["jwt_exp"] = prefs.getString("jwt_exp", "15");
        doc["allowlist_enabled"] = prefs.getBool("al_en", false);
        doc["allowlist"] = prefs.getString("al_ips", "");
        prefs.end();
        String response; serializeJson(doc, response); 
        auto r = request->beginResponse(200, "application/json", response); addSecurityHeaders(r); request->send(r);
    });

    AsyncCallbackJsonWebHandler* secUpdateHandler = new AsyncCallbackJsonWebHandler("/api/config/security", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        JsonObject data = json.as<JsonObject>(); 
        prefs.begin("sec", false);
        if(data["jwt_exp"].is<String>()) prefs.putString("jwt_exp", data["jwt_exp"].as<String>());
        if(data["allowlist_enabled"].is<bool>()) prefs.putBool("al_en", data["allowlist_enabled"].as<bool>());
        if(data["allowlist"].is<String>()) prefs.putString("al_ips", data["allowlist"].as<String>());
        prefs.end(); 

        if(data["new_pass"].is<String>()) { 
            String np = data["new_pass"].as<String>(); 
            if(np != "") SecMgr.updateAdminPass(np);
        }
        
        ESP_LOGI(TAG, "SecOps - Políticas de seguridad actualizadas en NVS.");
        auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}"); addSecurityHeaders(r); request->send(r);
    }); server.addHandler(secUpdateHandler);

    server.on("/api/config/sensors", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "operator")) { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }
        JsonDocument doc; prefs.begin("sen", true);
        doc["dht_pin"] = prefs.getInt("dht_pin", 4); doc["dht_type"] = prefs.getInt("dht_type", 22);
        doc["adc_pin"] = prefs.getInt("adc_pin", 5); doc["adc_gnd_pin"] = prefs.getInt("adc_gnd_pin", -1);
        doc["r1"] = prefs.getFloat("r1", 100000.0);
        doc["r2"] = prefs.getFloat("r2", 100000.0); doc["temp_offset"] = prefs.getFloat("t_off", -0.5);
        doc["adc_offset"] = prefs.getFloat("adc_off", 0.0); doc["adc_mult"] = prefs.getFloat("adc_mult", 1.0);
        doc["sleep_mode"] = prefs.getInt("slp_mode", 0); doc["sleep_time"] = prefs.getInt("slp_time", 60);
        doc["polling_rate"] = prefs.getInt("poll", 5000);
        prefs.end();
        String response; serializeJson(doc, response);
        auto r = request->beginResponse(200, "application/json", response); addSecurityHeaders(r); request->send(r);
    });

    AsyncCallbackJsonWebHandler* senUpdateHandler = new AsyncCallbackJsonWebHandler("/api/config/sensors", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isAuthorized(request, "operator")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        JsonObject data = json.as<JsonObject>(); prefs.begin("sen", false);
        if(data["dht_pin"].is<int>()) prefs.putInt("dht_pin", data["dht_pin"].as<int>());
        if(data["dht_type"].is<int>()) prefs.putInt("dht_type", data["dht_type"].as<int>());
        if(data["adc_pin"].is<int>()) prefs.putInt("adc_pin", data["adc_pin"].as<int>());
        if(data["adc_gnd_pin"].is<int>()) prefs.putInt("adc_gnd_pin", data["adc_gnd_pin"].as<int>());
        if(data["r1"].is<float>()) prefs.putFloat("r1", data["r1"].as<float>());
        if(data["r2"].is<float>()) prefs.putFloat("r2", data["r2"].as<float>());
        if(data["temp_offset"].is<float>()) prefs.putFloat("t_off", data["temp_offset"].as<float>());
        if(data["adc_offset"].is<float>()) prefs.putFloat("adc_off", data["adc_offset"].as<float>());
        if(data["adc_mult"].is<float>()) prefs.putFloat("adc_mult", data["adc_mult"].as<float>());
        if(data["sleep_mode"].is<int>()) prefs.putInt("slp_mode", data["sleep_mode"].as<int>());
        if(data["sleep_time"].is<int>()) prefs.putInt("slp_time", data["sleep_time"].as<int>());
        if(data["polling_rate"].is<int>()) prefs.putInt("poll", data["polling_rate"].as<int>());
        prefs.end();
        ESP_LOGI(TAG, "SYS - Configuración de Sensores actualizada.");
        auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\",\"message\":\"Hardware reconfigurado. Reiniciando...\"}"); addSecurityHeaders(r); request->send(r);
        pendingReboot = true; rebootRequestTime = millis();
    }); server.addHandler(senUpdateHandler);

    server.on("/api/config/smtp", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }
        JsonDocument doc; prefs.begin("smtp", true);
        doc["enabled"] = prefs.getBool("enabled", false); doc["host"] = prefs.getString("host", "smtp.gmail.com");
        doc["port"] = prefs.getInt("port", 465); doc["user"] = prefs.getString("user", ""); doc["dest"] = prefs.getString("dest", "");
        doc["t_max"] = prefs.getFloat("t_max", 35.0); doc["t_min"] = prefs.getFloat("t_min", 10.0);
        doc["h_max"] = prefs.getFloat("h_max", 60.0); doc["h_min"] = prefs.getFloat("h_min", 20.0);
        doc["b_min"] = prefs.getFloat("b_min", 3.2); doc["cooldown"] = prefs.getInt("cooldown", 60);
        doc["alert_temp"] = prefs.getBool("a_temp", true); doc["alert_hum"] = prefs.getBool("a_hum", true);
        doc["alert_sec"] = prefs.getBool("a_sec", true); doc["pass"] = prefs.getString("pass", "") == "" ? "" : "********"; 
        prefs.end();
        String response; serializeJson(doc, response); 
        auto r = request->beginResponse(200, "application/json", response); addSecurityHeaders(r); request->send(r);
    });

    AsyncCallbackJsonWebHandler* smtpUpdateHandler = new AsyncCallbackJsonWebHandler("/api/config/smtp", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        JsonObject data = json.as<JsonObject>(); prefs.begin("smtp", false);
        if(data["enabled"].is<bool>()) prefs.putBool("enabled", data["enabled"].as<bool>());
        if(data["host"].is<String>()) prefs.putString("host", data["host"].as<String>());
        if(data["port"].is<int>()) prefs.putInt("port", data["port"].as<int>());
        if(data["user"].is<String>()) prefs.putString("user", data["user"].as<String>());
        if(data["dest"].is<String>()) prefs.putString("dest", data["dest"].as<String>());
        if(data["t_max"].is<float>()) prefs.putFloat("t_max", data["t_max"].as<float>());
        if(data["t_min"].is<float>()) prefs.putFloat("t_min", data["t_min"].as<float>());
        if(data["h_max"].is<float>()) prefs.putFloat("h_max", data["h_max"].as<float>());
        if(data["h_min"].is<float>()) prefs.putFloat("h_min", data["h_min"].as<float>());
        if(data["b_min"].is<float>()) prefs.putFloat("b_min", data["b_min"].as<float>());
        if(data["cooldown"].is<int>()) prefs.putInt("cooldown", data["cooldown"].as<int>());
        if(data["alert_temp"].is<bool>()) prefs.putBool("a_temp", data["alert_temp"].as<bool>());
        if(data["alert_hum"].is<bool>()) prefs.putBool("a_hum", data["alert_hum"].as<bool>());
        if(data["alert_sec"].is<bool>()) prefs.putBool("a_sec", data["alert_sec"].as<bool>());
        if(data["pass"].is<String>()) { String p = data["pass"].as<String>(); if(p != "" && p != "********") prefs.putString("pass", p); }
        prefs.end(); 
        ESP_LOGI(TAG, "SYS - Configuración SMTP actualizada.");
        auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}"); addSecurityHeaders(r); request->send(r);
    }); server.addHandler(smtpUpdateHandler);

    server.on("/api/system/test_email", HTTP_POST, [](AsyncWebServerRequest *request){
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }
        ESP_LOGI(TAG, "SMTP - Ejecutando prueba de envío...");
        bool success = NotifMgr.sendEmail("Verificación de Sistema - EdgeSecOps", "<b>¡Conexión Exitosa!</b><br><br>El motor de notificaciones está operativo.");
        // Registrar la creación en la auditoría
        String logMsg = "Prueba de envío de email realizada. Resultado: " + String(success ? "Éxito" : "Fallo");
        writeAuditLog(success ? "INFO" : "ERROR", "admin", logMsg);
        if (success) { auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}"); addSecurityHeaders(r); request->send(r); } 
        else { auto r = request->beginResponse(500, "application/json", "{\"error\":\"Fallo SMTP.\"}"); addSecurityHeaders(r); request->send(r); }
    });

    // --- ENDPOINT: WHATSAPP CONFIG ---
    server.on("/api/config/whatsapp", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isAuthorized(request, "admin")) return;
        String json = "{\"enabled\":" + String(prefs.getBool("wa_en", false) ? "true" : "false") + 
                      ",\"phone\":\"" + prefs.getString("wa_phone", "") + "\"" +
                      ",\"api_key\":\"" + prefs.getString("wa_api", "") + "\"}";
        auto r = request->beginResponse(200, "application/json", json); addSecurityHeaders(r); request->send(r);
    });

    AsyncCallbackJsonWebHandler* saveWAHandler = new AsyncCallbackJsonWebHandler("/api/config/whatsapp", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isAuthorized(request, "admin")) return;
        JsonObject data = json.as<JsonObject>();
        prefs.putBool("wa_en", data["enabled"] | false);
        prefs.putString("wa_phone", data["phone"] | "");
        prefs.putString("wa_api", data["api_key"] | "");
        writeAuditLog("WARN", currentSessionRole, "Configuración de WhatsApp alterada");
        // Registrar la creación en la auditoría
        String logMsg = "Actualización de configuración de WhatsApp. Habilitado: " + String(data["enabled"] | false ? "Sí" : "No") + "; Teléfono: " + (data["phone"].is<String>() ? data["phone"].as<String>() : "N/A");
        writeAuditLog("INFO", "admin", logMsg);
        auto r = request->beginResponse(200, "application/json", "{\"message\":\"WhatsApp Configurado\"}");
        addSecurityHeaders(r); request->send(r);
    });
    server.addHandler(saveWAHandler);

    // --- ENDPOINT: CLOUD WEBHOOK CONFIG ---
    server.on("/api/config/cloud", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isAuthorized(request, "admin")) return;
        String json = "{\"enabled\":" + String(prefs.getBool("cloud_en", false) ? "true" : "false") + 
                      ",\"url\":\"" + prefs.getString("cloud_url", "") + "\"" +
                      ",\"token\":\"" + prefs.getString("cloud_auth", "") + "\"}";
        auto r = request->beginResponse(200, "application/json", json); addSecurityHeaders(r); request->send(r);
    });

    AsyncCallbackJsonWebHandler* saveCloudHandler = new AsyncCallbackJsonWebHandler("/api/config/cloud", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isAuthorized(request, "admin")) return;
        JsonObject data = json.as<JsonObject>();
        prefs.putBool("cloud_en", data["enabled"] | false);
        prefs.putString("cloud_url", data["url"] | "");
        prefs.putString("cloud_auth", data["token"] | "");
        writeAuditLog("WARN", currentSessionRole, "Destino Cloud Webhook modificado");
        // Registrar la creación en la auditoría
        String logMsg = "Actualización de configuración de Cloud Webhook. Habilitado: " + String(data["enabled"] | false ? "Sí" : "No") + "; URL: " + (data["url"].is<String>() ? data["url"].as<String>() : "N/A");
        writeAuditLog("INFO", "admin", logMsg);
        auto r = request->beginResponse(200, "application/json", "{\"message\":\"Cloud Webhook Configurado\"}");
        addSecurityHeaders(r); request->send(r);
    });
    server.addHandler(saveCloudHandler);

    // --- ENDPOINT: POWER CONFIG ---
    server.on("/api/config/power", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }
        JsonDocument doc; prefs.begin("pwr", true);
        doc["sleep_en"] = prefs.getBool("sleep_en", false);
        doc["sleep_time_m"] = prefs.getInt("sleep_time_m", 15);
        prefs.end();
        String response; serializeJson(doc, response);
        auto r = request->beginResponse(200, "application/json", response); addSecurityHeaders(r); request->send(r);
    });

    AsyncCallbackJsonWebHandler* pwrUpdateHandler = new AsyncCallbackJsonWebHandler("/api/config/power", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        JsonObject data = json.as<JsonObject>(); prefs.begin("pwr", false);
        if(data["sleep_en"].is<bool>()) prefs.putBool("sleep_en", data["sleep_en"].as<bool>());
        if(data["sleep_time_m"].is<int>()) prefs.putInt("sleep_time_m", data["sleep_time_m"].as<int>());
        prefs.end();
        ESP_LOGI(TAG, "SYS - Configuración de Energía actualizada.");
        String logMsg = "Actualización de configuración de energía.";
        writeAuditLog("INFO", "admin", logMsg);
        auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\",\"message\":\"Configuración de energía guardada.\"}"); addSecurityHeaders(r); request->send(r);
    });
    server.addHandler(pwrUpdateHandler);

    // ========================================================================
    // 5. MANTENIMIENTO, ALMACENAMIENTO Y OTA
    // ========================================================================
    server.on("/api/system/info", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "viewer")) { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }
        JsonDocument doc;
        doc["chip_model"] = ESP.getChipModel(); doc["cores"] = 2; doc["sdk_version"] = ESP.getSdkVersion();
        doc["fw_version"] = "v1.1.0-SecOps"; doc["build_date"] = String(__DATE__) + " " + String(__TIME__);
        if (LittleFS.exists("/www/anomaly_net.tflite")) {
            File f = LittleFS.open("/www/anomaly_net.tflite", "r");
            doc["ml_status"] = "Activo"; doc["ml_size"] = f.size(); f.close();
        } else { doc["ml_status"] = "Inactivo"; doc["ml_size"] = 0; }
        String response; serializeJson(doc, response);
        auto r = request->beginResponse(200, "application/json", response); addSecurityHeaders(r); request->send(r);
    });

    server.on("/api/system/storage", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401); addSecurityHeaders(r); request->send(r); return; }
        JsonDocument doc;
        doc["flash_total"] = ESP.getFlashChipSize();
        doc["fs_total"] = LittleFS.totalBytes(); doc["fs_used"] = LittleFS.usedBytes();
        nvs_stats_t nvs_stats; esp_err_t err = nvs_get_stats(NULL, &nvs_stats);
        if (err == ESP_OK) { doc["nvs_total"] = nvs_stats.total_entries; doc["nvs_used"] = nvs_stats.used_entries; }
        else { doc["nvs_total"] = 0; doc["nvs_used"] = 0; }
        String response; serializeJson(doc, response);
        auto r = request->beginResponse(200, "application/json", response); addSecurityHeaders(r); request->send(r);
    });

    server.on("/api/system/reboot", HTTP_POST, [](AsyncWebServerRequest *request){
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        // Registrar la creación en la auditoría
        String logMsg = "Reinicio del sistema solicitado.";
        writeAuditLog("INFO", "admin", logMsg);
        auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}"); addSecurityHeaders(r); request->send(r);
        pendingReboot = true; rebootRequestTime = millis();
    });

    server.on("/api/system/factory_reset", HTTP_POST, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        // Registrar la creación en la auditoría
        String logMsg = "Restablecimiento de fábrica solicitado.";
        writeAuditLog("INFO", "admin", logMsg);
        nvs_flash_erase(); nvs_flash_init();
        auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}"); addSecurityHeaders(r); request->send(r);
        pendingReboot = true; rebootRequestTime = millis();
    });

    server.on("/api/system/format_logs", HTTP_POST, [](AsyncWebServerRequest *request) {
        if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        // Registrar la creación en la auditoría
        String logMsg = "Formato de logs solicitado.";
        writeAuditLog("INFO", "admin", logMsg);
        File root = LittleFS.open("/");
        File file = root.openNextFile();
        while(file) {
            String name = file.name();
            if (name.startsWith("dataset") && name.endsWith(".csv")) {
                LittleFS.remove("/www/" + name);
            }
            file = root.openNextFile();
        }
        auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}"); addSecurityHeaders(r); request->send(r);
    });

    ESP_RETURN_ON_ERROR(NetMgr.setupOTAEndpoints(&server), TAG, "Failed to setup OTA endpoints");

    // ========================================================================
    // 6. ENRUTADOR FRONTEND CON HEADERS DE SEGURIDAD
    // ========================================================================
    server.serveStatic("/", LittleFS, "/www/")
        .setDefaultFile("index.html")
        .setCacheControl("max-age=600")
        .setTemplateProcessor([](const String& var) -> String { return var; }); 
    
    server.onNotFound([](AsyncWebServerRequest *request){
        if (request->method() == HTTP_OPTIONS) {
            request->send(200); 
        } else {
            auto response = request->beginResponse(LittleFS, "/www/index.html", "text/html");
            addSecurityHeaders(response); 
            request->send(response);
        }
    });

    server.begin();
    ESP_LOGI(TAG, "SYS - API Web Server operativo. RBAC Zero-Trust + Headers de Seguridad Activos.");
    return ESP_OK;
}


void ApiServer::handleWebSocket() {
    ws.cleanupClients();
}

void ApiServer::broadcastTelemetry(const String& jsonOutput) {
    if(WiFi.getMode() == WIFI_STA && WiFi.status() == WL_CONNECTED && ws.count() > 0) {
        ws.textAll(jsonOutput);
    }
}

ApiServer ApiSrv;
