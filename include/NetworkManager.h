/**
 * @file NetworkManager.h
 * @brief Manages WiFi connections, provisioning, and web server setup.
 * @author EdgeSecOps Team
 * @date 2026
 */

#ifndef NETWORK_MANAGER_H
#define NETWORK_MANAGER_H

#include <Arduino.h>
#include <ESPAsyncWebServer.h>

/**
 * @brief Class responsible for network management.
 */
class NetworkManager {
public:
    /**
     * @brief Starts the secure provisioning process (e.g., Access Point mode).
     * @return esp_err_t ESP_OK on success, or an error code on failure.
     */
    esp_err_t startSecureProvisioning();

    /**
     * @brief Starts BLE-based provisioning and generates a QR code.
     * @return esp_err_t ESP_OK on success, or an error code on failure.
     */
    esp_err_t startBLEProvisioningQR();

    /**
     * @brief Connects to the operational WiFi network using stored credentials.
     * @return true if successfully connected, false otherwise.
     */
    bool connectToOperationalWiFi();

    /**
     * @brief Initializes Network Time Protocol (NTP) synchronization.
     * @return esp_err_t ESP_OK on success, or an error code on failure.
     */
    esp_err_t initNTP();

    /**
     * @brief Sets up the web server for the Out-Of-Box Experience (OOBE).
     * @param server Pointer to the AsyncWebServer instance.
     * @return esp_err_t ESP_OK on success, or an error code on failure.
     */
    esp_err_t setupWebServerOOBE(AsyncWebServer* server);

    /**
     * @brief Sets up the web server endpoints for Over-The-Air (OTA) updates.
     * @param server Pointer to the AsyncWebServer instance.
     * @return esp_err_t ESP_OK on success, or an error code on failure.
     */
    esp_err_t setupOTAEndpoints(AsyncWebServer* server);

    /**
     * @brief Main loop handler for network management tasks.
     */
    void handleLoop();
};

/**
 * @brief Global singleton instance of the NetworkManager.
 */
extern NetworkManager NetMgr;

#endif // NETWORK_MANAGER_H
