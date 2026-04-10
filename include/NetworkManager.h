#ifndef NETWORK_MANAGER_H
#define NETWORK_MANAGER_H

#include <Arduino.h>
#include <ESPAsyncWebServer.h>

class NetworkManager {
public:
    esp_err_t startSecureProvisioning();
    esp_err_t startBLEProvisioningQR();
    bool connectToOperationalWiFi();
    esp_err_t initNTP();
    esp_err_t setupWebServerOOBE(AsyncWebServer* server);
    esp_err_t setupOTAEndpoints(AsyncWebServer* server);
    void handleLoop();

    static void displayQRCode(const char* payload);
};

extern NetworkManager NetMgr;

#endif // NETWORK_MANAGER_H
