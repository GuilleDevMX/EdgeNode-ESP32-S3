#ifndef AI_MANAGER_H
#define AI_MANAGER_H

#include <Arduino.h>

class AiManager {
public:
    esp_err_t begin();
    bool isReady() const;
    bool detectAnomaly(float temperature, float humidity);
    float getLastMSE() const;

private:
    bool ml_ready = false;
    float last_mse = 0.0;
};

extern AiManager AiMgr;

#endif // AI_MANAGER_H