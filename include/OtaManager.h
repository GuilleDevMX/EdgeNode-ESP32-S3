/**
 * @file OtaManager.h
 * @brief Over-The-Air (OTA) update management for the ESP32-S3.
 * @author EdgeSecOps Team
 * @date 2026
 */

#ifndef OTA_MANAGER_H
#define OTA_MANAGER_H

#include <Arduino.h>

/**
 * @brief Enumeration of possible OTA update states.
 */
enum OtaStatus {
    OTA_IDLE,    /**< OTA process is idle / not started */
    OTA_START,   /**< OTA process has started */
    OTA_SUCCESS, /**< OTA process completed successfully */
    OTA_FAILED   /**< OTA process failed */
};

/**
 * @brief Class responsible for managing OTA updates.
 */
class OtaManager {
public:
    /**
     * @brief Initializes the OTA update process with a given URL.
     * @param url The URL from which to download the firmware update.
     */
    void begin(const char* url);

    /**
     * @brief Gets the current status of the OTA update.
     * @return The current OtaStatus.
     */
    OtaStatus getStatus();

    /**
     * @brief Sets the current status of the OTA update.
     * @param status The new OtaStatus to set.
     */
    void setStatus(OtaStatus status);

private:
    OtaStatus _status = OTA_IDLE; /**< Current OTA status */
    String _url;                  /**< URL for the firmware update */
    
    /**
     * @brief FreeRTOS task handling the OTA update process.
     * @param pvParameter Pointer to task parameters.
     */
    static void ota_task(void *pvParameter);
};

/**
 * @brief Global singleton instance of the OtaManager.
 */
extern OtaManager OtaMgr;

#endif
