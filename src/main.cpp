#include <Arduino.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <AsyncJson.h>
#include <ArduinoJson.h>
#include "SecurityManager.h" 
#include "NotificationManager.h"
#include <ESPmDNS.h>
#include <DHT.h>
#include <Preferences.h>
#include <Update.h>
#include <time.h>
#include <nvs_flash.h> 
#include <nvs.h>             
#include <esp_log.h>
#include "CryptoUtils.h"
#include <esp_system.h>
#include <esp_task_wdt.h>
#include <TensorFlowLite_ESP32.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"

// --- DEFINICIÓN DE PINES ---
const int PIN_CARGANDO = 13;
const int PIN_LLENO = 14;

// --- ETIQUETA GLOBAL PARA LOS LOGS ---
static const char *TAG = "EdgeSecOps";

// --- PROTOTIPOS DE FUNCIONES ---
void initNTP();
String generateRandomHex(size_t length);  // Helper para salt/nonce
void initSecureRNG();

// --- INSTANCIACIÓN DE CLASES PRINCIPALES ---
Preferences prefs;

void initSecureRNG() {
    uint32_t seed = esp_random() ^ (uint32_t)micros() ^ (uint32_t)(ESP.getEfuseMac() >> 32);
    seed ^= (uint32_t)(ESP.getEfuseMac() & 0xFFFFFFFF);
    for(int i=0; i<8; i++) seed ^= esp_random();
    randomSeed(seed);
}

// --- Control de Ciclo de Vida del Sistema ---
bool pendingReboot = false;
unsigned long rebootRequestTime = 0;
const unsigned long REBOOT_DELAY_MS = 3000;

// --- VARIABLES COMPARTIDAS Y MUTEX (RTOS) ---
SemaphoreHandle_t nvsMutex = NULL;
SemaphoreHandle_t sensorMutex;
SemaphoreHandle_t sessionMutex;

float currentTemp = 0.0;
float currentHum = 0.0;
float currentBatVoltage = 0.0;
String currentPowerState = "Discharging";

// --- VARIABLES DE SESIÓN (IAM) - PROTEGIDAS POR sessionMutex ---
String currentSessionToken = ""; 
String currentSessionRole = ""; 
time_t sessionExpirationEpoch = 0; 

// --- RATE LIMITING PARA LOGIN ---
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

// Verificación de rate limiting por IP
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

// --- MOTOR DE INTELIGENCIA ARTIFICIAL (TinyML) ---
const float norm_t_min = 10.0;
const float norm_t_max = 40.0;
const float norm_h_min = 20.0;
const float norm_h_max = 80.0;
const float anomaly_threshold = 0.015; 

const tflite::Model* ml_model = nullptr;
tflite::MicroInterpreter* ml_interpreter = nullptr;
TfLiteTensor* ml_input = nullptr;
TfLiteTensor* ml_output = nullptr;

constexpr int kTensorArenaSize = 8 * 1024; 
uint8_t tensor_arena[kTensorArenaSize];
uint8_t* model_buffer = nullptr;
bool ml_ready = false;

unsigned long lastAiAlertTime = 0;
int getBatteryPercentage(float voltage);


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

// --- MIDDLEWARE DE FIREWALL ---
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

// --- MIDDLEWARE RBAC MEJORADO ---
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

// Helper para añadir headers de seguridad a todas las respuestas
void addSecurityHeaders(AsyncWebServerResponse *response) {
    response->addHeader("X-Content-Type-Options", "nosniff");
    response->addHeader("X-Frame-Options", "DENY");
    response->addHeader("X-XSS-Protection", "1; mode=block");
    response->addHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    response->addHeader("Referrer-Policy", "strict-origin-when-cross-origin");
}

// --- MODOS DE RED ---
void startSecureProvisioning() {
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

bool connectToOperationalWiFi() {
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

// --- TAREA DE LOGGING DE DATOS (CSV) ---
void dataLoggerTask(void *parameter) {
    vTaskDelay(pdMS_TO_TICKS(5000)); 

    for(;;) {
        // 🛡️ CORRECCIÓN: Independizar del SecMgr. Escribe si hay red operativa.
        if (WiFi.getMode() == WIFI_STA && WiFi.status() == WL_CONNECTED) {
            float t = 0, h = 0, b = 0;
            
            if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
                t = currentTemp; h = currentHum; b = currentBatVoltage;
                xSemaphoreGive(sensorMutex);
            }

            File file = LittleFS.open("/www/dataset.csv", "a");
            if (file) {
                if (file.size() > 500 * 1024) { 
                    file.close();
                    LittleFS.remove("/www/dataset_old.csv");
                    LittleFS.rename("/www/dataset.csv", "/www/dataset_old.csv");
                    file = LittleFS.open("/www/dataset.csv", "w"); 
                    file.println("timestamp,temperature,humidity,battery_v"); 
                    ESP_LOGI(TAG, "FS - Rotación de logs ejecutada (500KB alcanzados).");
                } else if (file.size() == 0) {
                    file.println("timestamp,temperature,humidity,battery_v");
                }
                
                time_t now; 
                time(&now);
                String timeStampStr;
                
                if (now > 1600000000LL) {
                    struct tm timeinfo;
                    localtime_r(&now, &timeinfo);
                    char buf[30];
                    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
                    timeStampStr = String(buf);
                } else {
                    timeStampStr = String(millis() / 1000); 
                }

                String csvLine = timeStampStr + "," + String(t, 2) + "," + String(h, 2) + "," + String(b, 2);
                
                file.println(csvLine);
                file.close();
            } else {
                ESP_LOGE(TAG, "FS - Imposible abrir dataset.csv para escritura.");
            }
        }
        vTaskDelay(pdMS_TO_TICKS(60000));
    }
}

void sensorTask(void *parameter) {
    // =========================================================
    // FASE 1: CONFIGURACIÓN INICIAL (Fuera del Bucle)
    // =========================================================
    prefs.begin("sen", true);
    int dhtPin = prefs.getInt("dht_pin", 4);
    int dhtType = prefs.getInt("dht_type", 22); 
    int adcPin = prefs.getInt("adc_pin", 5);
    float r1 = prefs.getFloat("r1", 50000.0);
    float r2 = prefs.getFloat("r2", 47000.0);
    float tempOffset = prefs.getFloat("t_off", -0.5);

    int pollRate = prefs.getInt("poll", 5000);
    if (pollRate < 2000) pollRate = 2000;
    prefs.end();

    DHT dht(dhtPin, dhtType);
    dht.begin();
    
    analogSetAttenuation(ADC_11db); 
    analogReadResolution(12);

    for(;;) {
        // =========================================================
        // FASE 2: LECTURA DHT22 OPTIMIZADA
        // =========================================================
        float h = dht.readHumidity();
        float t = dht.readTemperature();
        
        if (!isnan(t)) t += tempOffset;

        // =========================================================
        // FASE 3: SOBREMUESTREO DEL ADC (Oversampling)
        // =========================================================
        analogRead(adcPin);
        vTaskDelay(pdMS_TO_TICKS(2));

        uint32_t adcSum = 0;
        int validSamples = 64;
        for(int i = 0; i < validSamples; i++) {
            adcSum += analogRead(adcPin);
            vTaskDelay(pdMS_TO_TICKS(1)); 
        }
        float adcAvg = (float)adcSum / validSamples;
        
        float pinVoltage = (adcAvg / 4095.0) * 3.3; 
        float batVoltage = pinVoltage * ((r1 + r2) / r2);

        // =========================================================
        // FASE 4: ESTADO DE ENERGÍA (TP4056)
        // =========================================================
        bool isCharging = (digitalRead(PIN_CARGANDO) == LOW);
        bool isFull = (digitalRead(PIN_LLENO) == LOW);

        String localPowerState = "Discharging";
        if (isCharging) {
            localPowerState = "Charging";
        } else if (isFull) {
            localPowerState = "Charged";
        }

        // =========================================================
        // FASE 5: ACTUALIZACIÓN DE GLOBALES (MUTEX)
        // =========================================================
        if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
            if (!isnan(t)) currentTemp = t;
            if (!isnan(h)) currentHum = h;
            currentBatVoltage = batVoltage;
            currentPowerState = localPowerState; 
            xSemaphoreGive(sensorMutex);
        }

        // =========================================================
        // FASE 6: ALERTAS Y TINYML
        // =========================================================
        NotifMgr.checkSensorThresholds(t, h, batVoltage);

        if (ml_ready && !isnan(t) && !isnan(h)) {
            float norm_t = (t - norm_t_min) / (norm_t_max - norm_t_min);
            float norm_h = (h - norm_h_min) / (norm_h_max - norm_h_min);
            
            if(norm_t < 0) norm_t = 0; if(norm_t > 1) norm_t = 1;
            if(norm_h < 0) norm_h = 0; if(norm_h > 1) norm_h = 1;

            ml_input->data.f[0] = norm_t;
            ml_input->data.f[1] = norm_h;

            if (ml_interpreter->Invoke() == kTfLiteOk) {
                float recon_t = ml_output->data.f[0];
                float recon_h = ml_output->data.f[1];

                float mse = ((norm_t - recon_t) * (norm_t - recon_t) + 
                             (norm_h - recon_h) * (norm_h - recon_h)) / 2.0;

                if (mse > anomaly_threshold) {
                    ESP_LOGW(TAG, "🤖 TinyML - ¡ANOMALÍA DETECTADA! MSE: %f", mse);
                    
                    unsigned long now = millis();
                    if (now - lastAiAlertTime > 3600000 || lastAiAlertTime == 0) { 
                        String aiMsg = "<b>¡ALERTA PREDICTIVA DE IA (AUTOENCODER)!</b><br><br>"
                                       "El modelo ha detectado un comportamiento ambiental anómalo.<br><br>"
                                       "<b>Temperatura:</b> " + String(t, 1) + " °C<br>"
                                       "<b>Humedad:</b> " + String(h, 1) + " %<br>"
                                       "<b>MSE:</b> " + String(mse, 4) + "<br><br>"
                                       "<i>Inspección física requerida.</i>";
                        NotifMgr.sendEmail("🤖 ALERTA PREDICTIVA: Anomalía", aiMsg);
                        lastAiAlertTime = now;
                    }
                }
            }
        }

        vTaskDelay(pdMS_TO_TICKS(pollRate));
    }
}

// --- TELEMETRÍA WEBSOCKETS MEJORADA ---
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

// --- CONFIGURACIÓN DE NTP ---
void initNTP() {
    prefs.begin("wifi", true); 
    String ntpServer = prefs.getString("ntp", "time.google.com");
    String tz = prefs.getString("tz", "CST6CDT,M4.1.0,M10.5.0"); 
    prefs.end();
    ESP_LOGI(TAG, "SYS - NTP Server: %s | TZ: %s", ntpServer.c_str(), tz.c_str());
    configTzTime(tz.c_str(), ntpServer.c_str());
}

// --- SERVIDORES WEB (OOBE) ---
void setupWebServerOOBE() {
    // 1. ENDPOINT: Estado Anti-Secuestro delegando a SecMgr
    server.on("/api/oobe/status", HTTP_GET, [](AsyncWebServerRequest *request) {
        bool isClaimed = SecMgr.isProvisioned();
        auto response = request->beginResponse(200, "application/json", 
            "{\"is_claimed\":" + String(isClaimed ? "true" : "false") + "}");
        addSecurityHeaders(response); 
        request->send(response);
    });

    // 2. ENDPOINT: Escaneo WiFi (Se mantiene igual)
    server.on("/api/wifi/scan", HTTP_GET, [](AsyncWebServerRequest *request) {
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

    // 3. ENDPOINT: Setup (Limpiado y Delegado)
    AsyncCallbackJsonWebHandler* setupHandler = new AsyncCallbackJsonWebHandler("/api/setup", [](AsyncWebServerRequest *request, JsonVariant &json) {
        JsonObject data = json.as<JsonObject>();
        String ssid = data["ssid"].as<String>();
        String pass = data["pass"].as<String>();
        String username = data["username"].as<String>();
        String password = data["password"].as<String>();

        // EVALUACIÓN DE ESTADO: Recuperación o Virgen
        if (SecMgr.isProvisioned()) {
            // MODO RECUPERACIÓN: Validar identidad con el motor IAM real
            if (!SecMgr.authenticateUser(username, password)) {
                auto response = request->beginResponse(401, "application/json", "{\"error\":\"Credenciales de administrador incorrectas.\"}");
                addSecurityHeaders(response); request->send(response);
                return;
            }
        } else {
            // NODO VIRGEN: Registrar en la Base de Datos segura
            if (!SecMgr.registerAdmin(username, password)) {
                auto response = request->beginResponse(500, "application/json", "{\"error\":\"Fallo al registrar administrador en NVS.\"}");
                addSecurityHeaders(response); request->send(response);
                return;
            }
        }

        // GUARDAR CONFIGURACIÓN DE RED
        Preferences prefs;
        prefs.begin("net", false);
        prefs.putString("ssid", ssid);
        prefs.putString("pass", pass);
        // Guardamos también IP estática si el payload la incluye
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
    server.addHandler(setupHandler);

    server.serveStatic("/", LittleFS, "/www/").setDefaultFile("index.html");
    server.onNotFound([](AsyncWebServerRequest *request) {
        if (request->method() == HTTP_OPTIONS) { request->send(200); } 
        else {
            auto response = request->beginResponse(LittleFS, "/www/index.html", "text/html");
            addSecurityHeaders(response); request->send(response);
        }
    });

    server.begin();
    ESP_LOGI(TAG, "SYS - OOBE Web Server en escucha.");
}

void cleanupWebServer() {
    ws.closeAll();
    server.reset();
    // Liberar handlers dinámicos si se usó 'new'
}

// --- SISTEMA DE AUDITORÍA (AUDIT TRAIL) ---
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

// --- SERVIDORES WEB (API PRINCIPAL) ---
void setupWebServerAPI() {
    
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
        if (xSemaphoreTake(sensorMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
            doc["voltage"] = currentBatVoltage;
            doc["percentage"] = getBatteryPercentage(currentBatVoltage);
            doc["power_state"] = currentPowerState;
            xSemaphoreGive(sensorMutex);
            
            String response; serializeJson(doc, response);
            auto resp = request->beginResponse(200, "application/json", response);
            addSecurityHeaders(resp); request->send(resp);
        } else {
            auto resp = request->beginResponse(503, "application/json", "{\"error\":\"Sensor lock timeout\"}");
            addSecurityHeaders(resp); request->send(resp);
        }
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
        if(LittleFS.exists("/www/dataset.csv")) {
            auto r = request->beginResponse(LittleFS, "/www/dataset.csv", "text/csv", true); addSecurityHeaders(r); request->send(r);
        } else {
            auto r = request->beginResponse(404, "application/json", "{\"error\":\"Dataset vacío.\"}"); addSecurityHeaders(r); request->send(r);
        }
    });
    
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
        
        JsonDocument doc; prefs.begin("wifi", true); 
        doc["ssid"] = prefs.getString("ssid", ""); doc["dhcp"] = prefs.getBool("dhcp", true);
        doc["ip"] = prefs.getString("ip", "192.168.1.200"); doc["gateway"] = prefs.getString("gw", "192.168.1.1");
        doc["subnet"] = prefs.getString("sn", "255.255.255.0"); doc["dns"] = prefs.getString("dns", "8.8.8.8");
        doc["ap_ssid"] = prefs.getString("ap_ssid", ""); doc["ap_hide"] = prefs.getBool("ap_hide", false);
        doc["mdns"] = prefs.getString("mdns", "edgenode"); doc["ntp"] = prefs.getString("ntp", "time.google.com");
        doc["tz"] = prefs.getString("tz", "CST6CDT,M4.1.0,M10.5.0");
        prefs.end();
        
        String response; serializeJson(doc, response); 
        auto r = request->beginResponse(200, "application/json", response); addSecurityHeaders(r); request->send(r);
    });

    AsyncCallbackJsonWebHandler* netUpdateHandler = new AsyncCallbackJsonWebHandler("/api/config/network", [](AsyncWebServerRequest *request, JsonVariant &json) {
        if(!isAuthorized(request, "admin")) { auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado.\"}"); addSecurityHeaders(r); request->send(r); return; }
        JsonObject data = json.as<JsonObject>(); prefs.begin("wifi", false);
        if(data["ssid"].is<String>()) prefs.putString("ssid", data["ssid"].as<String>());
        if(data["pass"].is<String>()) { String p = data["pass"].as<String>(); if(p != "") prefs.putString("pass", p); }
        if(data["dhcp"].is<bool>()) prefs.putBool("dhcp", data["dhcp"].as<bool>());
        if(data["ip"].is<String>()) prefs.putString("ip", data["ip"].as<String>());
        if(data["gateway"].is<String>()) prefs.putString("gw", data["gateway"].as<String>());
        if(data["subnet"].is<String>()) prefs.putString("sn", data["subnet"].as<String>());
        if(data["dns"].is<String>()) prefs.putString("dns", data["dns"].as<String>());
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
        doc["adc_pin"] = prefs.getInt("adc_pin", 5); doc["r1"] = prefs.getFloat("r1", 100000.0);
        doc["r2"] = prefs.getFloat("r2", 100000.0); doc["temp_offset"] = prefs.getFloat("t_off", -0.5);
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
        if(data["r1"].is<float>()) prefs.putFloat("r1", data["r1"].as<float>());
        if(data["r2"].is<float>()) prefs.putFloat("r2", data["r2"].as<float>());
        if(data["temp_offset"].is<float>()) prefs.putFloat("t_off", data["temp_offset"].as<float>());
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
        LittleFS.remove("/www/dataset.csv"); LittleFS.remove("/www/dataset_old.csv");
        auto r = request->beginResponse(200, "application/json", "{\"status\":\"success\"}"); addSecurityHeaders(r); request->send(r);
    });

    server.on("/api/system/ota", HTTP_POST, 
        [](AsyncWebServerRequest *request) {
            if(!isIpAllowed(request)) { auto r = request->beginResponse(403); addSecurityHeaders(r); request->send(r); return; }
            String authToken = request->header("Authorization");
            if(!authToken.startsWith("Bearer ") || !isAuthorized(request, "admin")) { 
                auto r = request->beginResponse(401, "application/json", "{\"error\":\"No autorizado\"}"); addSecurityHeaders(r); request->send(r); return; 
            }
            if (!Update.hasError()) {
                ESP_LOGI(TAG, "OTA - Transferencia completada.");
                // Registrar la creación en la auditoría
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
}
void initTinyML() {
    if (!LittleFS.exists("/www/anomaly_net.tflite")) {
        ESP_LOGW(TAG, "TinyML - Modelo inactivo. Esperando archivo .tflite via OTA.");
        return;
    }

    File file = LittleFS.open("/www/anomaly_net.tflite", "r");
    if (!file) { ESP_LOGE(TAG, "TinyML - No se pudo abrir el modelo."); return; }
    
    size_t size = file.size();
    uint32_t caps = psramFound() ? (MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) : MALLOC_CAP_INTERNAL;
    
    model_buffer = (uint8_t*) heap_caps_malloc(size, caps);
    if (!model_buffer) {
        ESP_LOGE(TAG, "TinyML - Fallo al asignar %d bytes.", size);
        file.close(); return;
    }
    
    size_t bytesRead = file.read(model_buffer, size);
    file.close();
    
    // ✅ VERIFICACIÓN CRÍTICA
    if (bytesRead != size) {
        ESP_LOGE(TAG, "TinyML - Lectura incompleta: %d/%d bytes. Liberando buffer...", bytesRead, size);
        heap_caps_free(model_buffer); model_buffer = nullptr; return;
    }

    ml_model = tflite::GetModel(model_buffer);
    if (!ml_model || ml_model->version() != TFLITE_SCHEMA_VERSION) {
        ESP_LOGE(TAG, "TinyML - Modelo corrupto o versión incompatible.");
        heap_caps_free(model_buffer); model_buffer = nullptr; return;
    }

    constexpr size_t minArena = 16 * 1024;
    constexpr size_t maxArena = 64 * 1024;
    const size_t arenaSize = (kTensorArenaSize < minArena) ? minArena : 
                            (kTensorArenaSize > maxArena) ? maxArena : kTensorArenaSize;

    static tflite::AllOpsResolver resolver;
    static tflite::MicroInterpreter static_interpreter(ml_model, resolver, tensor_arena, arenaSize, nullptr);
    ml_interpreter = &static_interpreter;

    if (ml_interpreter->AllocateTensors() != kTfLiteOk) {
        ESP_LOGE(TAG, "TinyML - Fallo AllocateTensors(). Arena: %d bytes.", arenaSize);
        // ⚠️ NO LIBERAR model_buffer aquí si el interpreter lo referencia internamente
        return;
    }

    ml_input = ml_interpreter->input(0);
    ml_output = ml_interpreter->output(0);
    ml_ready = true;
    ESP_LOGI(TAG, "TinyML - Autoencoder Activado (%d bytes).", size);
}

int getBatteryPercentage(float voltage) {
    if (voltage >= 4.2) return 100;
    if (voltage <= 3.2) return 0;
    return (int)(((voltage - 3.2) / (4.2 - 3.2)) * 100.0);
}

// --- CICLO PRINCIPAL ---
void setup() {
    Serial.begin(115200);
    pinMode(PIN_CARGANDO, INPUT_PULLUP);
    pinMode(PIN_LLENO, INPUT_PULLUP);

    initSecureRNG();

    // 1. NVS con recovery
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "SYS - NVS requiere formateo.");
        nvs_flash_erase();
        err = nvs_flash_init();
    }
    if (err != ESP_OK) ESP_LOGE(TAG, "CRIT - Fallo fatal en NVS: %s", esp_err_to_name(err));

    // 2. LittleFS
    if(!LittleFS.begin(true)){
        ESP_LOGE(TAG, "CRIT - Fallo montando LittleFS.");
        while(1) { delay(100); }
    }
    
    if (!psramInit()) ESP_LOGW(TAG, "PSRAM no disponible - modo degradado activado");


    // 3. Inicialización de TODOS los Mutexes
    sensorMutex = xSemaphoreCreateMutex();
    sessionMutex = xSemaphoreCreateMutex(); 
    nvsMutex = xSemaphoreCreateMutex();
    
    // Validar que los mutex se crearon correctamente antes de lanzar tareas
    if (sensorMutex != NULL && nvsMutex != NULL) {

        esp_task_wdt_init(10, true);
        esp_task_wdt_add(NULL);

        xTaskCreatePinnedToCore(sensorTask, "SensorTask", 16384, NULL, 1, NULL, 1);
        xTaskCreatePinnedToCore(dataLoggerTask, "DataLogger", 8192, NULL, 1, NULL, 0);
    } else {
        ESP_LOGE(TAG, "CRIT - Fallo creando Mutex. RTOS inestable.");
        while(1) { delay(100); }
    }

    // 4. Inicialización de Módulos Externos
    NotifMgr.begin(); // <-- Inicializar el gestor de correos
    // 4. MÁQUINA DE ESTADOS
    SecMgr.begin();

    if (!SecMgr.isProvisioned()) {
        ESP_LOGI(TAG, "SYS - Nodo sin aprovisionar. Modo OOBE.");
        startSecureProvisioning();
        setupWebServerOOBE();
        return;
    } else {
        ESP_LOGI(TAG, "SYS - Perfil encontrado. Iniciando red.");
        
        if (!connectToOperationalWiFi()) {
            ESP_LOGE(TAG, "NET - Fallo WiFi. Modo rescate.");
            startSecureProvisioning(); 
            setupWebServerOOBE();      
            return;
        }
        
        ESP_LOGI(TAG, "NET - Conexión exitosa. Levantando API.");
        setupWebServerAPI();
    }
}

void loop() {
    // =========================================================
    // 1. NETWORK WATCHDOG (Perro Guardián de Conexión)
    // =========================================================
    static unsigned long lastWifiCheck = 0;
    // Solo vigila si estamos en modo producción (STA)
    if (WiFi.getMode() == WIFI_STA && millis() - lastWifiCheck > 30000) { 
        lastWifiCheck = millis();
        if (WiFi.status() != WL_CONNECTED) {
            ESP_LOGW(TAG, "NET - Enlace WiFi caído (Router reiniciado/Lejos). Forzando reconexión...");
            WiFi.disconnect();
            WiFi.reconnect(); // Intenta conectar usando las credenciales en RAM de forma asíncrona
        }
    }

    // =========================================================
    // 2. TELEMETRÍA WEBSOCKETS
    // =========================================================
    // 🛡️ CORRECCIÓN: Solo enviamos si el WiFi está vivo
    if(WiFi.getMode() == WIFI_STA && WiFi.status() == WL_CONNECTED && ws.count() > 0) {
        static unsigned long lastTelemetry = 0;
        if (millis() - lastTelemetry > 5000) {
            lastTelemetry = millis();
            JsonDocument doc; 
            doc["type"] = "telemetry";
            
            if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
                doc["temperature"] = currentTemp; 
                doc["humidity"] = currentHum; 
                doc["battery_v"] = currentBatVoltage;
                doc["power_state"] = currentPowerState;
                xSemaphoreGive(sensorMutex);
            }
            doc["heap_free"] = ESP.getFreeHeap(); 
            doc["psram_free"] = ESP.getFreePsram(); 
            doc["uptime"] = millis() / 1000;
            
            String jsonOutput; 
            serializeJson(doc, jsonOutput); 
            ws.textAll(jsonOutput);
        }
    }
    
    ws.cleanupClients(); 
    vTaskDelay(pdMS_TO_TICKS(10)); // Ceder control al RTOS
    esp_task_wdt_reset();
    
    // =========================================================
    // 3. GESTIÓN DE REINICIO SEGURO
    // =========================================================
    if (pendingReboot) {
        if (millis() - rebootRequestTime >= REBOOT_DELAY_MS) {
            cleanupWebServer();
            ESP_LOGI(TAG, "SYS - Reiniciando por solicitud del administrador..."); 
            Serial.flush(); 
            ESP.restart();
        }
    }
}