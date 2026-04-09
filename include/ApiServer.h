#ifndef APISERVER_H
#define APISERVER_H

#include <Arduino.h>
#include <ESPAsyncWebServer.h>

class ApiServer {
public:
    void begin(bool oobeMode);
    void handleWebSocket();
    void broadcastTelemetry(const String& jsonOutput);
    void cleanup();
};

extern ApiServer ApiSrv;

#endif // APISERVER_H
