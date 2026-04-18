#ifndef AI_MANAGER_H
#define AI_MANAGER_H

#include <Arduino.h>

class AiManager {
public:
    esp_err_t begin();
    bool isReady() const;
    bool detectAnomaly(float temps[5], float hums[5], float battery);
    float getLastMSE() const;
    int32_t getLastInferenceTime() const;

private:
    bool ml_ready = false;
    float last_mse = 0.0;
    int32_t last_inference_time_us = 0;
};

extern AiManager AiMgr;

#endif // AI_MANAGER_H