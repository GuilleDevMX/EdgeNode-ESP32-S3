#ifndef NETWORK_MANAGER_H
#define NETWORK_MANAGER_H

#include <Arduino.h>
#include <ESPAsyncWebServer.h>

class NetworkManager {
public:
    void startSecureProvisioning();
    bool connectToOperationalWiFi();
    void initNTP();
    void setupWebServerOOBE(AsyncWebServer* server);
    void setupOTAEndpoints(AsyncWebServer* server);
    void handleLoop();
};

extern NetworkManager NetMgr;

#endif // NETWORK_MANAGER_H
