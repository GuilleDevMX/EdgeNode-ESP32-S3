#include "TelemetryManager.h"
#include <WiFi.h>
#include <LittleFS.h>
#include <DHT.h>
#include <Preferences.h>
#include <esp_log.h>
#include "AiManager.h"
#include "NotificationManager.h"
#include "NetworkManager.h"

static const char *TAG = "TelemetryMgr";

// --- DEFINICIÓN DE PINES ---
const int PIN_CARGANDO = 13;
const int PIN_LLENO = 14;

TelemetryManager TelemetryMgr;

TelemetryManager::TelemetryManager() {
    currentTemp = 0.0;
    currentHum = 0.0;
    currentBatVoltage = 0.0;
    currentPowerState = "Discharging";
    sensorMutex = NULL;
}

void TelemetryManager::begin() {
    pinMode(PIN_CARGANDO, INPUT_PULLUP);
    pinMode(PIN_LLENO, INPUT_PULLUP);

    sensorMutex = xSemaphoreCreateMutex();
    if (sensorMutex != NULL) {
        xTaskCreatePinnedToCore(sensorTask, "SensorTask", 16384, this, 1, NULL, 1);
        xTaskCreatePinnedToCore(dataLoggerTask, "DataLogger", 8192, this, 1, NULL, 0);
    } else {
        ESP_LOGE(TAG, "CRIT - Fallo creando Mutex de Sensores.");
    }
}

float TelemetryManager::getTemperature() {
    float val = 0.0;
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
        val = currentTemp;
        xSemaphoreGive(sensorMutex);
    }
    return val;
}

float TelemetryManager::getHumidity() {
    float val = 0.0;
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
        val = currentHum;
        xSemaphoreGive(sensorMutex);
    }
    return val;
}

float TelemetryManager::getBatteryVoltage() {
    float val = 0.0;
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
        val = currentBatVoltage;
        xSemaphoreGive(sensorMutex);
    }
    return val;
}

String TelemetryManager::getPowerState() {
    String val = "Discharging";
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
        val = currentPowerState;
        xSemaphoreGive(sensorMutex);
    }
    return val;
}

int TelemetryManager::getBatteryPercentage(float voltage) {
    if (voltage >= 4.2) return 100;
    if (voltage <= 3.2) return 0;
    return (int)(((voltage - 3.2) / (4.2 - 3.2)) * 100.0);
}

void TelemetryManager::dataLoggerTask(void *parameter) {
    TelemetryManager* mgr = (TelemetryManager*)parameter;
    vTaskDelay(pdMS_TO_TICKS(5000)); 

    for(;;) {
        if (WiFi.getMode() == WIFI_STA && WiFi.status() == WL_CONNECTED) {
            float t = mgr->getTemperature();
            float h = mgr->getHumidity();
            float b = mgr->getBatteryVoltage();

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

void TelemetryManager::sensorTask(void *parameter) {
    TelemetryManager* mgr = (TelemetryManager*)parameter;
    Preferences prefs;
    
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
        if (xSemaphoreTake(mgr->sensorMutex, portMAX_DELAY) == pdTRUE) {
            if (!isnan(t)) mgr->currentTemp = t;
            if (!isnan(h)) mgr->currentHum = h;
            mgr->currentBatVoltage = batVoltage;
            mgr->currentPowerState = localPowerState; 
            xSemaphoreGive(mgr->sensorMutex);
        }

        // =========================================================
        // FASE 6: ALERTAS Y TINYML
        // =========================================================
        NotifMgr.checkSensorThresholds(t, h, batVoltage);

        if (AiMgr.detectAnomaly(t, h)) {
            float mse = AiMgr.getLastMSE();
            ESP_LOGW(TAG, "🤖 TinyML - ¡ANOMALÍA DETECTADA! MSE: %f", mse);
            
            static unsigned long lastAiAlertTime = 0;
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

        vTaskDelay(pdMS_TO_TICKS(pollRate));
    }
}
