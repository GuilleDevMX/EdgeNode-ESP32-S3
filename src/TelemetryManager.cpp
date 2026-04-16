#include "TelemetryManager.h"
#include <WiFi.h>
#include <LittleFS.h>
#include <DHT.h>
#include <Preferences.h>
#include <esp_log.h>
#include "AiManager.h"
#include "NotificationManager.h"
#include "NetworkManager.h"
#include <esp_check.h>
#include <esp_adc_cal.h>
#include <esp_task_wdt.h>

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

esp_err_t TelemetryManager::begin() {
    pinMode(PIN_CARGANDO, INPUT_PULLUP);
    pinMode(PIN_LLENO, INPUT_PULLUP);

    sensorMutex = xSemaphoreCreateMutex();
    ESP_RETURN_ON_FALSE(sensorMutex != NULL, ESP_ERR_NO_MEM, TAG, "CRIT - Fallo creando Mutex de Sensores.");
    
    xTaskCreatePinnedToCore(sensorTask, "SensorTask", 16384, this, 1, NULL, 1);
    xTaskCreatePinnedToCore(dataLoggerTask, "DataLogger", 8192, this, 1, NULL, 0);
    
    return ESP_OK;
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
    
    // Suscribir la tarea de Data Logger al Task Watchdog Timer
    esp_task_wdt_add(NULL);
    
    vTaskDelay(pdMS_TO_TICKS(5000)); 

    for(;;) {
        esp_task_wdt_reset(); // Alimentar al perro guardián
        
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
        
        // En lugar de un delay largo que dispara el Watchdog, lo dividimos
        for (int i = 0; i < 60; i++) {
            vTaskDelay(pdMS_TO_TICKS(1000));
            esp_task_wdt_reset();
        }
    }
}

void TelemetryManager::sensorTask(void *parameter) {
    TelemetryManager* mgr = (TelemetryManager*)parameter;
    Preferences prefs;
    
    // Suscribir la tarea de Sensores al Task Watchdog Timer
    esp_task_wdt_add(NULL);
    
    // =========================================================
    // FASE 1: CONFIGURACIÓN INICIAL (Fuera del Bucle)
    // =========================================================
    prefs.begin("sen", true);
    int dhtPin = prefs.getInt("dht_pin", 4);
    int dhtType = prefs.getInt("dht_type", 22); 
    int adcPin = prefs.getInt("adc_pin", 5);
    int adcGndPin = prefs.getInt("adc_gnd_pin", -1);
    float r1 = prefs.getFloat("r1", 51000.0);
    float r2 = prefs.getFloat("r2", 51000.0);
    float tempOffset = prefs.getFloat("t_off", -0.5);
    float adcOffset = prefs.getFloat("adc_off", 0.3);
    float adcMult = prefs.getFloat("adc_mult", 0.5);
    int sleepMode = prefs.getInt("slp_mode", 0);
    int sleepTime = prefs.getInt("slp_time", 60);

    int pollRate = prefs.getInt("poll", 30000);
    if (pollRate < 2000) pollRate = 2000;
    prefs.end();

    if (adcGndPin >= 0) {
        pinMode(adcGndPin, INPUT); // Default a alta impedancia para no consumir energía
    }

    DHT dht(dhtPin, dhtType);
    dht.begin();
    
    // Configuracion de ADC Calibration (eFuses)
    esp_adc_cal_characteristics_t adc_chars;
    adc1_channel_t channel;
    
    // Mapeo simple de pin a canal (asumiendo ADC1 en ESP32-S3)
    if (adcPin == 1) channel = ADC1_CHANNEL_0;
    else if (adcPin == 2) channel = ADC1_CHANNEL_1;
    else if (adcPin == 3) channel = ADC1_CHANNEL_2;
    else if (adcPin == 4) channel = ADC1_CHANNEL_3;
    else if (adcPin == 5) channel = ADC1_CHANNEL_4;
    else if (adcPin == 6) channel = ADC1_CHANNEL_5;
    else if (adcPin == 7) channel = ADC1_CHANNEL_6;
    else if (adcPin == 8) channel = ADC1_CHANNEL_7;
    else if (adcPin == 9) channel = ADC1_CHANNEL_8;
    else channel = ADC1_CHANNEL_4; // default GPIO5

    esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_12, ADC_WIDTH_BIT_12, 0, &adc_chars);
    
    // Configurar canal via API nativa en lugar de Arduino
    adc1_config_width(ADC_WIDTH_BIT_12);
    adc1_config_channel_atten(channel, ADC_ATTEN_DB_12);

    for(;;) {
        // =========================================================
        // FASE 2: LECTURA DHT22 OPTIMIZADA
        // =========================================================
        float h = dht.readHumidity();
        float t = dht.readTemperature();
        
        if (!isnan(t)) t += tempOffset;

        // =========================================================
        // FASE 3: SOBREMUESTREO DEL ADC CON CALIBRACIÓN (eFuses)
        // =========================================================
        if (adcGndPin >= 0) {
            pinMode(adcGndPin, OUTPUT);
            digitalWrite(adcGndPin, LOW);
            vTaskDelay(pdMS_TO_TICKS(10)); // Tiempo para que el condensador bypass se estabilice
        }

        adc1_get_raw(channel); // Descartar primera lectura
        vTaskDelay(pdMS_TO_TICKS(2));

        uint32_t rawSum = 0;
        int validSamples = 64;
        for(int i = 0; i < validSamples; i++) {
            rawSum += adc1_get_raw(channel);
            vTaskDelay(pdMS_TO_TICKS(1)); 
        }
        
        if (adcGndPin >= 0) {
            pinMode(adcGndPin, INPUT); // Regresar a alta impedancia
        }

        uint32_t rawAvg = rawSum / validSamples;
        
        // Usar esp_adc_cal para convertir raw a milivoltios calibrados
        uint32_t cal_mv = esp_adc_cal_raw_to_voltage(rawAvg, &adc_chars);
        
        // Convertir milivoltios a voltios finales con ajuste fino
        float pinVoltage = (cal_mv / 1000.0) * adcMult + adcOffset; 
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

        // =========================================================
        // FASE 7: OPTIMIZACIÓN DE BATERÍA (SLEEP MODES)
        // =========================================================
        if (sleepMode == 1 && localPowerState == "Discharging") {
            ESP_LOGW(TAG, "PWR - Modo Batería: Iniciando Deep Sleep por %d segundos.", sleepTime);
            // Pequeño delay para permitir que el servidor WS envíe la telemetría antes de dormir
            vTaskDelay(pdMS_TO_TICKS(1000));
            esp_sleep_enable_timer_wakeup(sleepTime * 1000000ULL);
            esp_deep_sleep_start();
        }

        // Delay de lectura (Poll rate). Partirlo para alimentar WDT si es > 5s
        int chunks = pollRate / 1000;
        int remainder = pollRate % 1000;
        for (int i = 0; i < chunks; i++) {
            vTaskDelay(pdMS_TO_TICKS(1000));
            esp_task_wdt_reset();
        }
        if (remainder > 0) {
            vTaskDelay(pdMS_TO_TICKS(remainder));
        }
    }
}
