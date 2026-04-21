/**
 * @file TelemetryManager.cpp
 * @brief Implementation file for TelemetryManager handling sensors, battery, and AI triggering.
 * @author EdgeSecOps Team
 * @date 2026
 */
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

/** @brief TAG for ESP-IDF logging. */
static const char *TAG = "TelemetryMgr";

// --- DEFINICIÓN DE PINES ---
/** @brief GPIO pin for reading battery charging state. */
const int PIN_CARGANDO = 13;
/** @brief GPIO pin for reading battery full state. */
const int PIN_LLENO = 14;

/** @brief Global singleton instance of TelemetryManager. */
TelemetryManager TelemetryMgr;

/**
 * @brief Constructor for TelemetryManager. Initializes arrays to NAN.
 */
TelemetryManager::TelemetryManager() {
    for (int i = 0; i < 5; i++) {
        currentTemp[i] = NAN;
        currentHum[i] = NAN;
    }
    currentBatVoltage = 0.0;
    currentPowerState = "Discharging";
    sensorMutex = NULL;
}

/**
 * @brief Initializes the telemetry system, setting up pins, mutexes, and tasks.
 * @return ESP_OK on success, or an error code.
 */
esp_err_t TelemetryManager::begin() {
    pinMode(PIN_CARGANDO, INPUT_PULLUP);
    pinMode(PIN_LLENO, INPUT_PULLUP);

    sensorMutex = xSemaphoreCreateMutex();
    ESP_RETURN_ON_FALSE(sensorMutex != NULL, ESP_ERR_NO_MEM, TAG, "CRIT - Fallo creando Mutex de Sensores.");
    
    xTaskCreatePinnedToCore(sensorTask, "SensorTask", 16384, this, 1, NULL, 1);
    xTaskCreatePinnedToCore(dataLoggerTask, "DataLogger", 8192, this, 1, NULL, 0);
    
    return ESP_OK;
}

/**
 * @brief Gets the last temperature reading for a specific sensor.
 */
float TelemetryManager::getTemperature(int index) {
    if (index < 0 || index >= 5) return NAN;
    float val = NAN;
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
        val = currentTemp[index];
        xSemaphoreGive(sensorMutex);
    }
    return val;
}

/**
 * @brief Gets the last humidity reading for a specific sensor.
 */
float TelemetryManager::getHumidity(int index) {
    if (index < 0 || index >= 5) return NAN;
    float val = NAN;
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
        val = currentHum[index];
        xSemaphoreGive(sensorMutex);
    }
    return val;
}

/**
 * @brief Gets the average temperature across all valid sensors.
 * @return Average temperature in Celsius, or NAN if none valid.
 */
float TelemetryManager::getAverageTemperature() {
    float sum = 0;
    int count = 0;
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
        for (int i = 0; i < 5; i++) {
            if (!isnan(currentTemp[i])) {
                sum += currentTemp[i];
                count++;
            }
        }
        xSemaphoreGive(sensorMutex);
    }
    return count > 0 ? (sum / count) : NAN;
}

/**
 * @brief Gets the average humidity across all valid sensors.
 * @return Average humidity percentage, or NAN if none valid.
 */
float TelemetryManager::getAverageHumidity() {
    float sum = 0;
    int count = 0;
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
        for (int i = 0; i < 5; i++) {
            if (!isnan(currentHum[i])) {
                sum += currentHum[i];
                count++;
            }
        }
        xSemaphoreGive(sensorMutex);
    }
    return count > 0 ? (sum / count) : NAN;
}

/**
 * @brief Gets the current battery voltage.
 * @return Battery voltage in Volts.
 */
float TelemetryManager::getBatteryVoltage() {
    float val = 0.0;
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
        val = currentBatVoltage;
        xSemaphoreGive(sensorMutex);
    }
    return val;
}

/**
 * @brief Gets the current power state string.
 * @return Power state (e.g., "Charging", "Discharging", "Charged").
 */
String TelemetryManager::getPowerState() {
    String val = "Discharging";
    if (xSemaphoreTake(sensorMutex, portMAX_DELAY) == pdTRUE) {
        val = currentPowerState;
        xSemaphoreGive(sensorMutex);
    }
    return val;
}

/**
 * @brief Calculates the battery percentage from voltage.
 */
int TelemetryManager::getBatteryPercentage(float voltage) {
    if (voltage >= 4.2) return 100;
    if (voltage <= 3.2) return 0;
    return (int)(((voltage - 3.2) / (4.2 - 3.2)) * 100.0);
}

/**
 * @brief Cleans up old telemetry CSV datasets from LittleFS based on retention policy.
 */
void TelemetryManager::cleanupOldDatasets() {
    Preferences prefs;
    prefs.begin("data", true);
    int retentionMonths = prefs.getInt("retention", 1); // default 1 month
    prefs.end();

    int retentionDays = retentionMonths * 30;
    
    time_t now;
    time(&now);
    if (now < 1600000000LL) return; // NTP not synced
    
    File root = LogFS.open("/");
    if (!root || !root.isDirectory()) return;

    File file = root.openNextFile();
    while (file) {
        String fileName = file.name();
        // check if it matches dataset_YYYY-MM-DD.csv
        if (fileName.startsWith("dataset_") && fileName.endsWith(".csv")) {
            String dateStr = fileName.substring(8, 18); // "YYYY-MM-DD"
            struct tm fileTime;
            memset(&fileTime, 0, sizeof(struct tm));
            if (strptime(dateStr.c_str(), "%Y-%m-%d", &fileTime) != NULL) {
                time_t fileEpoch = mktime(&fileTime);
                double diff = difftime(now, fileEpoch);
                if (diff > retentionDays * 86400.0) {
                    ESP_LOGI(TAG, "FS - Borrando log antiguo: %s", fileName.c_str());
                    String fullPath = "/" + fileName;
                    LogFS.remove(fullPath.c_str());
                }
            }
        }
        file = root.openNextFile();
    }
}

/**
 * @brief FreeRTOS task for logging telemetry data to CSV on LittleFS.
 */
void TelemetryManager::dataLoggerTask(void *parameter) {
    TelemetryManager* mgr = (TelemetryManager*)parameter;
    
    // Suscribir la tarea de Data Logger al Task Watchdog Timer
    esp_task_wdt_add(NULL);
    
    vTaskDelay(pdMS_TO_TICKS(5000)); 

    // Limpieza inicial
    mgr->cleanupOldDatasets();

    int loopCount = 0;

    for(;;) {
        esp_task_wdt_reset(); // Alimentar al perro guardián
        
        if (WiFi.getMode() == WIFI_STA && WiFi.status() == WL_CONNECTED) {
            float b = mgr->getBatteryVoltage();

            time_t now; 
            time(&now);
            String timeStampStr;
            String fileName = "/dataset.csv"; // fallback
            
            if (now > 1600000000LL) {
                struct tm timeinfo;
                localtime_r(&now, &timeinfo);
                char bufTime[30];
                strftime(bufTime, sizeof(bufTime), "%Y-%m-%d %H:%M:%S", &timeinfo);
                timeStampStr = String(bufTime);
                
                char bufDate[30];
                strftime(bufDate, sizeof(bufDate), "/dataset_%Y-%m-%d.csv", &timeinfo);
                fileName = String(bufDate);
            } else {
                timeStampStr = String(millis() / 1000); 
            }

            File file = LogFS.open(fileName.c_str(), "a");
            if (file) {
                if (file.size() == 0) {
                    file.println("timestamp,t0,h0,t1,h1,t2,h2,t3,h3,t4,h4,battery_v");
                }
                String csvLine = timeStampStr;
                for (int i = 0; i < 5; i++) {
                    float t_val = mgr->getTemperature(i);
                    float h_val = mgr->getHumidity(i);
                    csvLine += ",";
                    if (isnan(t_val)) csvLine += "NaN";
                    else csvLine += String(t_val, 2);
                    csvLine += ",";
                    if (isnan(h_val)) csvLine += "NaN";
                    else csvLine += String(h_val, 2);
                }
                csvLine += "," + String(b, 2);
                file.println(csvLine);
                file.close();
            } else {
                ESP_LOGE(TAG, "FS - Imposible abrir %s para escritura.", fileName.c_str());
            }
        }
        
        // Ejecutar limpieza cada ~1 hora
        loopCount++;
        if (loopCount >= 60) {
            loopCount = 0;
            mgr->cleanupOldDatasets();
        }
        
        // En lugar de un delay largo que dispara el Watchdog, lo dividimos
        for (int i = 0; i < 60; i++) {
            vTaskDelay(pdMS_TO_TICKS(1000));
            esp_task_wdt_reset();
        }
    }
}

/**
 * @brief FreeRTOS task for reading sensors, calculating battery voltage, and detecting anomalies.
 */
void TelemetryManager::sensorTask(void *parameter) {
    TelemetryManager* mgr = (TelemetryManager*)parameter;
    Preferences prefs;
    
    // Suscribir la tarea de Sensores al Task Watchdog Timer
    esp_task_wdt_add(NULL);
    
    // =========================================================
    // FASE 1: CONFIGURACIÓN INICIAL (Fuera del Bucle)
    // =========================================================
    prefs.begin("sen", true);
    int dhtPins[5];
    int dhtTypes[5];
    float tempOffsets[5];
    int defaultPins[5] = {4, 15, 16, 17, 18};
    for (int i = 0; i < 5; i++) {
        dhtPins[i] = prefs.getInt(("dht_pin_" + String(i)).c_str(), defaultPins[i]);
        dhtTypes[i] = prefs.getInt(("dht_type_" + String(i)).c_str(), 22);
        tempOffsets[i] = prefs.getFloat(("t_off_" + String(i)).c_str(), -0.5);
    }
    int adcPin = prefs.getInt("adc_pin", 5);
    int adcGndPin = prefs.getInt("adc_gnd_pin", -1);
    float r1 = prefs.getFloat("r1", 51000.0);
    float r2 = prefs.getFloat("r2", 51000.0);
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

    DHT* dhts[5];
    for (int i = 0; i < 5; i++) {
        if (dhtPins[i] >= 0) {
            dhts[i] = new DHT(dhtPins[i], dhtTypes[i]);
            dhts[i]->begin();
        } else {
            dhts[i] = nullptr;
        }
    }
    
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
        float h_vals[5] = {NAN, NAN, NAN, NAN, NAN};
        float t_vals[5] = {NAN, NAN, NAN, NAN, NAN};
        
        for (int i = 0; i < 5; i++) {
            if (dhts[i] != nullptr) {
                h_vals[i] = dhts[i]->readHumidity();
                t_vals[i] = dhts[i]->readTemperature();
                if (!isnan(t_vals[i])) t_vals[i] += tempOffsets[i];
                vTaskDelay(pdMS_TO_TICKS(500)); // Delay per sensor to avoid brownouts
                esp_task_wdt_reset();
            }
        }

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
            for (int i = 0; i < 5; i++) {
                mgr->currentTemp[i] = t_vals[i];
                mgr->currentHum[i] = h_vals[i];
            }
            mgr->currentBatVoltage = batVoltage;
            mgr->currentPowerState = localPowerState; 
            xSemaphoreGive(mgr->sensorMutex);
        }

        // =========================================================
        // FASE 6: ALERTAS Y TINYML
        // =========================================================
        NotifMgr.checkSensorThresholds(t_vals, h_vals, batVoltage);
        
        float avg_t = mgr->getAverageTemperature();
        float avg_h = mgr->getAverageHumidity();

        if (AiMgr.detectAnomaly(t_vals, h_vals, batVoltage)) {
            float mse = AiMgr.getLastMSE();
            ESP_LOGW(TAG, "🤖 TinyML - ¡ANOMALÍA DETECTADA! MSE: %f", mse);
            
            static unsigned long lastAiAlertTime = 0;
            unsigned long now = millis();
            if (now - lastAiAlertTime > 3600000 || lastAiAlertTime == 0) { 
                String aiMsg = "<b>¡ALERTA PREDICTIVA DE IA (AUTOENCODER)!</b><br><br>"
                               "El modelo de 11 variables ha detectado un patrón anómalo (sensores o energía).<br><br>"
                               "<b>Temperatura Media:</b> " + String(avg_t, 1) + " °C<br>"
                               "<b>Humedad Media:</b> " + String(avg_h, 1) + " %<br>"
                               "<b>Voltaje Sistema:</b> " + String(batVoltage, 2) + " V<br>"
                               "<b>Nivel de Anomalía (MSE):</b> " + String(mse, 4) + "<br><br>"
                               "<i>Inspección física requerida inmediatamente.</i>";
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
