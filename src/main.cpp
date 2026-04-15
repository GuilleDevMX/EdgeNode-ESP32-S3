#include <Arduino.h>
#include "ApiServer.h"
#include <WiFi.h>
#include <esp_wifi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <AsyncJson.h>
#include <ArduinoJson.h>
#include "SecurityManager.h" 
#include "NotificationManager.h"
#include "NetworkManager.h"
#include "TelemetryManager.h"
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
#include "AiManager.h"
#include "DisplayManager.h"
#include <map>
#include <esp_check.h>

// --- ETIQUETA GLOBAL PARA LOS LOGS ---
#include <esp_ota_ops.h>

static const char *TAG = "EdgeSecOps";

// --- PROTOTIPOS DE FUNCIONES ---
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
SemaphoreHandle_t sessionMutex;

// --- VARIABLES DE SESIÓN (IAM) - PROTEGIDAS POR sessionMutex ---
String currentSessionToken = ""; 
String currentSessionRole = ""; 
time_t sessionExpirationEpoch = 0; 

// --- INICIALIZACIÓN DEL SISTEMA CON MANEJO DE ERRORES (ESP-IDF) ---
esp_err_t init_system() {
    // 1. NVS con recovery
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "SYS - NVS requiere formateo.");
        ESP_RETURN_ON_ERROR(nvs_flash_erase(), TAG, "CRIT - Fallo al borrar NVS");
        err = nvs_flash_init();
    }
    ESP_RETURN_ON_ERROR(err, TAG, "CRIT - Fallo fatal en NVS");

    // 2. LittleFS
    ESP_RETURN_ON_FALSE(LittleFS.begin(true), ESP_FAIL, TAG, "CRIT - Fallo montando LittleFS.");
    
    // Inicializar TinyML
    ESP_RETURN_ON_ERROR(AiMgr.begin(), TAG, "Failed to init AI");

    if (!psramInit()) {
        ESP_LOGW(TAG, "PSRAM no disponible - modo degradado activado");
    }

    // 3. Inicialización de TODOS los Mutexes
    sessionMutex = xSemaphoreCreateMutex(); 
    nvsMutex = xSemaphoreCreateMutex();
    
    // Validar que los mutex se crearon correctamente antes de lanzar tareas
    ESP_RETURN_ON_FALSE((sessionMutex != NULL && nvsMutex != NULL), ESP_ERR_NO_MEM, TAG, "CRIT - Fallo creando Mutex. RTOS inestable.");

    // Configuración global del Task Watchdog Timer (TWDT)
    // 30 segundos es seguro para operaciones largas como TLS Handshakes o rotación de LittleFS
    esp_task_wdt_init(30, true);
    esp_task_wdt_add(NULL); // Suscribir la tarea principal (loop)

    ESP_RETURN_ON_ERROR(TelemetryMgr.begin(), TAG, "Failed to init Telemetry");
    ESP_RETURN_ON_ERROR(DisplayMgr.begin(), TAG, "Failed to init Display");

    // 4. Inicialización de Módulos Externos
    ESP_RETURN_ON_ERROR(NotifMgr.begin(), TAG, "Failed to init Notifications"); // Inicializar el gestor de correos
    // 4. MÁQUINA DE ESTADOS
    ESP_RETURN_ON_ERROR(SecMgr.begin(), TAG, "Failed to init Security");

    if (!SecMgr.isProvisioned()) {
        ESP_LOGI(TAG, "SYS - Nodo sin aprovisionar. Modo OOBE y BLE Provisioning.");
        ESP_RETURN_ON_ERROR(NetMgr.startSecureProvisioning(), TAG, "Failed to start secure provisioning");
        // ESP_RETURN_ON_ERROR(NetMgr.startBLEProvisioningQR(), TAG, "Failed to start BLE provisioning");
        ESP_RETURN_ON_ERROR(ApiSrv.begin(true), TAG, "Failed to start API Server in OOBE mode");
        return ESP_OK;
    } else {
        ESP_LOGI(TAG, "SYS - Perfil encontrado. Iniciando red.");
        
        if (!NetMgr.connectToOperationalWiFi()) {
            ESP_LOGE(TAG, "NET - Fallo WiFi. Modo rescate.");
            ESP_RETURN_ON_ERROR(NetMgr.startSecureProvisioning(), TAG, "Failed to start secure provisioning in rescue mode");
            // ESP_RETURN_ON_ERROR(NetMgr.startBLEProvisioningQR(), TAG, "Failed to start BLE provisioning");
            ESP_RETURN_ON_ERROR(ApiSrv.begin(true), TAG, "Failed to start API Server in rescue mode");      
            return ESP_OK;
        }
        
        ESP_LOGI(TAG, "NET - Conexión exitosa. Levantando API.");
        ESP_RETURN_ON_ERROR(ApiSrv.begin(false), TAG, "Failed to start API Server");
    }
    if (WiFi.getMode() == WIFI_STA && WiFi.status() == WL_CONNECTED) {
        ESP_LOGI(TAG, "SYS - Red operativa lista. Cancelando Rollback si estaba pendiente.");
        esp_ota_mark_app_valid_cancel_rollback();
    }

    return ESP_OK;
}

// --- CICLO PRINCIPAL ---
void setup() {
    Serial.begin(115200);
    initSecureRNG();

    if (init_system() != ESP_OK) {
        ESP_LOGE(TAG, "CRIT - Inicialización fallida. Entrando en Failsafe y reiniciando en 5s...");
        
        for(int i = 0; i < 50; i++) {
            vTaskDelay(pdMS_TO_TICKS(100));
            esp_task_wdt_reset(); 
        }
        esp_restart();
    }
}
void loop() {
    NetMgr.handleLoop();    
    static unsigned long lastTelemetry = 0;
    if (millis() - lastTelemetry > 5000) {
        lastTelemetry = millis();
        JsonDocument doc; 
        doc["type"] = "telemetry";
        
        doc["temperature"] = TelemetryMgr.getTemperature(); 
        doc["humidity"] = TelemetryMgr.getHumidity(); 
        doc["battery_v"] = TelemetryMgr.getBatteryVoltage();
        doc["power_state"] = TelemetryMgr.getPowerState();
        doc["heap_free"] = ESP.getFreeHeap(); 
        doc["psram_free"] = ESP.getFreePsram(); 
        doc["heap_max_block"] = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL);
        doc["psram_max_block"] = psramFound() ? heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM) : 0;
        doc["ml_inference_us"] = AiMgr.getLastInferenceTime();
        doc["uptime"] = millis() / 1000;
        
        String jsonOutput; 
        serializeJson(doc, jsonOutput); 
        ApiSrv.broadcastTelemetry(jsonOutput);
    }
    
    ApiSrv.handleWebSocket(); 
    vTaskDelay(pdMS_TO_TICKS(10)); // Ceder control al RTOS
    esp_task_wdt_reset();

    if (pendingReboot) {
        if (millis() - rebootRequestTime >= REBOOT_DELAY_MS) {
            ApiSrv.cleanup();
            ESP_LOGI(TAG, "SYS - Reiniciando por solicitud del administrador..."); 
            Serial.flush(); 
            ESP.restart();
        }
    }
}