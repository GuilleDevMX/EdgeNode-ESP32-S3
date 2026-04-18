#ifndef APISERVER_H
#define APISERVER_H

#include <Arduino.h>
#include <ESPAsyncWebServer.h>

class ApiServer {
public:
    esp_err_t begin(bool oobeMode);
    void handleWebSocket();
    void broadcastTelemetry(const String& jsonOutput);
    uint32_t getClientCount();
    void cleanup();
};

extern ApiServer ApiSrv;

#endif // APISERVER_H
