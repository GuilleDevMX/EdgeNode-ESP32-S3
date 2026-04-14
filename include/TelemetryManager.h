#pragma once

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

class TelemetryManager {
private:
    SemaphoreHandle_t sensorMutex;
    float currentTemp;
    float currentHum;
    float currentBatVoltage;
    String currentPowerState;

    static void sensorTask(void *parameter);
    void enforceDataRetention();
    static void dataLoggerTask(void *parameter);

public:
    TelemetryManager();
    esp_err_t begin();

    float getTemperature();
    float getHumidity();
    float getBatteryVoltage();
    String getPowerState();
    int getBatteryPercentage(float voltage);
};

extern TelemetryManager TelemetryMgr;