/**
 * @file ApiServer.h
 * @brief Manages the Async Web Server and API endpoints.
 * @author EdgeSecOps Team
 * @date 2026
 */

#ifndef APISERVER_H
#define APISERVER_H

#include <Arduino.h>
#include <ESPAsyncWebServer.h>

/**
 * @brief Class responsible for the HTTP/WebSocket API server.
 */
class ApiServer {
public:
    /**
     * @brief Initializes the API server and sets up routes.
     * @param oobeMode True if starting in Out-Of-Box Experience (OOBE) mode.
     * @return esp_err_t ESP_OK on success, or an error code on failure.
     */
    esp_err_t begin(bool oobeMode);

    /**
     * @brief Handles periodic WebSocket tasks (e.g., ping/pong, cleanup).
     */
    void handleWebSocket();

    /**
     * @brief Broadcasts telemetry data to all connected WebSocket clients.
     * @param jsonOutput The JSON string containing telemetry data.
     */
    void broadcastTelemetry(const String& jsonOutput);

    /**
     * @brief Gets the current number of connected WebSocket clients.
     * @return Number of active clients.
     */
    uint32_t getClientCount();

    /**
     * @brief Cleans up resources used by the API server.
     */
    void cleanup();
};

/**
 * @brief Global singleton instance of the ApiServer.
 */
extern ApiServer ApiSrv;

#endif // APISERVER_H
