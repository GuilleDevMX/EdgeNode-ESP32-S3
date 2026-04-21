/**
 * @file TelemetryManager.h
 * @brief Manages sensor data acquisition, processing, and logging.
 * @author EdgeSecOps Team
 * @date 2026
 */

#pragma once

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <LittleFS.h>

/**
 * @brief External reference to the LittleFS filesystem object for logs.
 */
extern fs::LittleFSFS LogFS;

/**
 * @brief Class responsible for managing telemetry and sensor data.
 */
class TelemetryManager {
private:
    SemaphoreHandle_t sensorMutex;  /**< Mutex for thread-safe access to sensor data */
    float currentTemp[5];           /**< Array of current temperature readings */
    float currentHum[5];            /**< Array of current humidity readings */
    float currentBatVoltage;        /**< Current battery voltage reading */
    String currentPowerState;       /**< Current power state string (e.g. "Battery", "Mains") */

    /**
     * @brief FreeRTOS task for reading sensor data periodically.
     * @param parameter Pointer to task parameters.
     */
    static void sensorTask(void *parameter);

    /**
     * @brief FreeRTOS task for logging sensor data to LittleFS.
     * @param parameter Pointer to task parameters.
     */
    static void dataLoggerTask(void *parameter);

public:
    /**
     * @brief Default constructor for TelemetryManager.
     */
    TelemetryManager();

    /**
     * @brief Initializes sensors, Mutexes, and FreeRTOS tasks.
     * @return esp_err_t ESP_OK on success, or an error code on failure.
     */
    esp_err_t begin();
    
    /**
     * @brief Cleans up old datasets to prevent storage full errors.
     */
    void cleanupOldDatasets();

    /**
     * @brief Gets the temperature at the specified index.
     * @param index The sensor index (default is 0).
     * @return The temperature reading.
     */
    float getTemperature(int index = 0);

    /**
     * @brief Gets the humidity at the specified index.
     * @param index The sensor index (default is 0).
     * @return The humidity reading.
     */
    float getHumidity(int index = 0);

    /**
     * @brief Gets the average temperature across all valid sensors.
     * @return The average temperature reading.
     */
    float getAverageTemperature();

    /**
     * @brief Gets the average humidity across all valid sensors.
     * @return The average humidity reading.
     */
    float getAverageHumidity();

    /**
     * @brief Gets the current battery voltage.
     * @return The battery voltage reading.
     */
    float getBatteryVoltage();

    /**
     * @brief Gets the current power state.
     * @return A string representing the power state.
     */
    String getPowerState();

    /**
     * @brief Calculates battery percentage based on voltage.
     * @param voltage The battery voltage.
     * @return The estimated battery percentage (0-100).
     */
    int getBatteryPercentage(float voltage);
};

/**
 * @brief Global singleton instance of the TelemetryManager.
 */
extern TelemetryManager TelemetryMgr;
