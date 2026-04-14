#include <WiFi.h>
#include <esp_dpp.h>
#include <esp_wifi.h>
void dpp_enrollee_event_cb(esp_supp_dpp_event_t event, void *data) {
    if (event == ESP_SUPP_DPP_CFG_RECVD) {
        wifi_config_t *cfg = (wifi_config_t *)data;
    }
}
void setup() {}
void loop() {}
