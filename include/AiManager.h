/**
 * @file AiManager.h
 * @brief Manages TinyML operations for anomaly detection.
 * @author EdgeSecOps Team
 * @date 2026
 */

#ifndef AI_MANAGER_H
#define AI_MANAGER_H

#include <Arduino.h>

/**
 * @brief Class responsible for managing TinyML inference and anomaly detection.
 */
class AiManager {
public:
    /**
     * @brief Initializes the AI manager and loads the TinyML model.
     * @return esp_err_t ESP_OK on success, or an error code on failure.
     */
    esp_err_t begin();

    /**
     * @brief Checks if the Machine Learning model is loaded and ready.
     * @return true if ready, false otherwise.
     */
    bool isReady() const;

    /**
     * @brief Runs inference to detect anomalies based on sensor data.
     * @param temps Array of temperature readings.
     * @param hums Array of humidity readings.
     * @param battery Current battery voltage.
     * @return true if an anomaly is detected, false otherwise.
     */
    bool detectAnomaly(float temps[5], float hums[5], float battery);

    /**
     * @brief Gets the last calculated Mean Squared Error (MSE) from the autoencoder.
     * @return The last MSE value.
     */
    float getLastMSE() const;

    /**
     * @brief Gets the duration of the last inference operation.
     * @return The inference time in microseconds.
     */
    int32_t getLastInferenceTime() const;

private:
    bool ml_ready = false;                /**< Flag indicating if ML is initialized */
    float last_mse = 0.0;                 /**< Last recorded Mean Squared Error */
    int32_t last_inference_time_us = 0;   /**< Last inference duration in microseconds */
};

/**
 * @brief Global singleton instance of the AiManager.
 */
extern AiManager AiMgr;

#endif // AI_MANAGER_H
