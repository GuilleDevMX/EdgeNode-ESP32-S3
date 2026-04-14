#include "OtaManager.h"
#include <esp_log.h>
#include <esp_https_ota.h>
#include <esp_crt_bundle.h>

static const char* TAG = "OtaMgr";

OtaManager OtaMgr;

void OtaManager::ota_task(void *pvParameter) {
    OtaManager* mgr = (OtaManager*)pvParameter;
    
    ESP_LOGI(TAG, "Iniciando HTTPS OTA Task hacia: %s", mgr->_url.c_str());
    
    esp_http_client_config_t config = {};
    config.url = mgr->_url.c_str();
    config.crt_bundle_attach = arduino_esp_crt_bundle_attach;
    config.timeout_ms = 30000;
    config.keep_alive_enable = true;

    esp_err_t ret = esp_https_ota(&config);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "HTTPS OTA Exitosa. Listo para reiniciar.");
        mgr->setStatus(OTA_SUCCESS);
    } else {
        ESP_LOGE(TAG, "HTTPS OTA Falló: %s", esp_err_to_name(ret));
        mgr->setStatus(OTA_FAILED);
    }
    
    vTaskDelete(NULL);
}

void OtaManager::begin(const char* url) {
    if (_status == OTA_START) {
        ESP_LOGW(TAG, "OTA ya está en progreso");
        return;
    }
    _url = url;
    _status = OTA_START;
    
    xTaskCreate(&OtaManager::ota_task, "ota_task", 8192, this, 5, NULL);
}

OtaStatus OtaManager::getStatus() {
    return _status;
}

void OtaManager::setStatus(OtaStatus status) {
    _status = status;
}
