/**
 * @file DisplayManager.h
 * @brief Manages the display and UI updates for the ESP32-S3.
 * @author EdgeSecOps Team
 * @date 2026
 */

#pragma once

#include <Arduino.h>

/**
 * @brief Class responsible for handling the physical display.
 */
class DisplayManager {
public:
    /**
     * @brief Initializes the display manager.
     * @return esp_err_t ESP_OK on success, or an error code on failure.
     */
    esp_err_t begin();

    /**
     * @brief Displays a QR code with the given payload.
     * @param payload The string payload to encode in the QR code.
     */
    void showQR(const char* payload);

    /**
     * @brief Displays a simple message with a title.
     * @param title The title of the message.
     * @param message The body of the message.
     */
    void showMessage(const char* title, const char* message);

    /**
     * @brief Updates the main dashboard view with telemetry data.
     * @param temp Current temperature.
     * @param hum Current humidity.
     * @param bat Current battery voltage or percentage.
     * @param powerState Current power state (e.g., "Battery", "Mains").
     * @param ip The current IP address of the device.
     * @param mse The Mean Squared Error from the AI anomaly detection.
     */
    void updateDashboard(float temp, float hum, float bat, String powerState, String ip, float mse);

private:
    /**
     * @brief FreeRTOS task for handling display updates.
     * @param parameter Pointer to task parameters.
     */
    static void displayTask(void *parameter);

    bool _isOobeMode = false; /**< Flag indicating if the device is in Out-Of-Box Experience mode */
};

/**
 * @brief Global singleton instance of the DisplayManager.
 */
extern DisplayManager DisplayMgr;
