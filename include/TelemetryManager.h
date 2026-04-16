#pragma once

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <LittleFS.h>

extern fs::LittleFSFS LogFS;

class TelemetryManager {
private:
    SemaphoreHandle_t sensorMutex;
    float currentTemp;
    float currentHum;
    float currentBatVoltage;
    String currentPowerState;

    static void sensorTask(void *parameter);
    static void dataLoggerTask(void *parameter);

public:
    TelemetryManager();
    esp_err_t begin();
    
    void cleanupOldDatasets();

    float getTemperature();
    float getHumidity();
    float getBatteryVoltage();
    String getPowerState();
    int getBatteryPercentage(float voltage);
};

extern TelemetryManager TelemetryMgr;