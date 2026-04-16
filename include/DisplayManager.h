#pragma once

#include <Arduino.h>

class DisplayManager {
public:
    esp_err_t begin();
    void showQR(const char* payload);
    void showMessage(const char* title, const char* message);
    void updateDashboard(float temp, float hum, float bat, String powerState, String ip, float mse);
private:
    static void displayTask(void *parameter);
    bool _isOobeMode = false;
};

extern DisplayManager DisplayMgr;