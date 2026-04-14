#ifndef OTA_MANAGER_H
#define OTA_MANAGER_H

#include <Arduino.h>

enum OtaStatus {
    OTA_IDLE,
    OTA_START,
    OTA_SUCCESS,
    OTA_FAILED
};

class OtaManager {
public:
    void begin(const char* url);
    OtaStatus getStatus();
    void setStatus(OtaStatus status);
private:
    OtaStatus _status = OTA_IDLE;
    String _url;
    
    static void ota_task(void *pvParameter);
};

extern OtaManager OtaMgr;

#endif
