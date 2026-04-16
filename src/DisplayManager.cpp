#include "DisplayManager.h"
#include <Wire.h>
#include "SSD1306Wire.h"
#include "my_qrcode.h"
#include <esp_log.h>
#include "TelemetryManager.h"
#include "AiManager.h"
#include <WiFi.h>

static const char *TAG = "DisplayMgr";

SSD1306Wire display(0x3c, 8, 9);
DisplayManager DisplayMgr;

esp_err_t DisplayManager::begin() {
    Wire.begin(8, 9);
    display.init();
    display.flipScreenVertically();
    display.clear();
    display.display();
    
    // Start the display update task
    xTaskCreatePinnedToCore(displayTask, "DisplayTask", 4096, this, 1, NULL, 1);
    return ESP_OK;
}

void DisplayManager::showQR(const char* payload) {
    _isOobeMode = true;
    display.clear();
    
    QRCode qrcode;
    uint8_t qrcodeData[qrcode_getBufferSize(4)]; // QR versión 4 (33x33)
    qrcode_initText(&qrcode, qrcodeData, 4, 0, payload);
    
    int scale = 1; 
    int offsetX = (128 - (qrcode.size * scale)) / 2;
    int offsetY = ((64 - (qrcode.size * scale)) / 2) + 5;
    
    display.setColor(WHITE);
    display.fillRect(offsetX - 2, offsetY - 2, (qrcode.size * scale) + 4, (qrcode.size * scale) + 4);
    
    display.setColor(BLACK);
    for (uint8_t y = 0; y < qrcode.size; y++) {
        for (uint8_t x = 0; x < qrcode.size; x++) {
            if (qrcode_getModule(&qrcode, x, y)) {
                display.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
            }
        }
    }
    
    display.setColor(WHITE);
    display.setFont(ArialMT_Plain_10);
    display.drawString(offsetX - 10, 0, "Scan (ESP BLE Prov)");
    display.display();
}

void DisplayManager::showMessage(const char* title, const char* message) {
    _isOobeMode = true;
    display.clear();
    display.setFont(ArialMT_Plain_16);
    display.drawString(0, 0, title);
    display.setFont(ArialMT_Plain_10);
    display.drawStringMaxWidth(0, 20, 128, message);
    display.display();
}

void DisplayManager::updateDashboard(float temp, float hum, float bat, String powerState, String ip, float mse) {
    display.clear();
    
    // Header: IP and Anomaly Status
    display.setFont(ArialMT_Plain_10);
    display.drawString(0, 0, ip.isEmpty() ? "No IP" : ip);
    if (mse > 0.05) { // Simple threshold for UI alert
        display.drawString(90, 0, "ALERT");
    } else {
        display.drawString(100, 0, "OK");
    }
    
    // Draw line
    display.drawHorizontalLine(0, 12, 128);

    // Body: Temp, Hum, Bat
    display.setFont(ArialMT_Plain_16);
    display.drawString(0, 16, String(temp, 1) + "C");
    display.drawString(64, 16, String(hum, 1) + "%");
    
    display.setFont(ArialMT_Plain_10);
    display.drawString(0, 36, "Bat: " + String(bat, 2) + "V");
    display.drawString(64, 36, powerState);
    
    // Uptime
    long uptime = millis() / 1000;
    display.drawString(0, 50, "Up: " + String(uptime / 60) + "m");
    
    display.display();
}

void DisplayManager::displayTask(void *parameter) {
    DisplayManager* mgr = (DisplayManager*)parameter;
    
    for(;;) {
        if (!mgr->_isOobeMode && WiFi.getMode() == WIFI_STA && WiFi.status() == WL_CONNECTED) {
            float temp = TelemetryMgr.getTemperature();
            float hum = TelemetryMgr.getHumidity();
            float bat = TelemetryMgr.getBatteryVoltage();
            String power = TelemetryMgr.getPowerState();
            String ip = WiFi.localIP().toString();
            float mse = AiMgr.getLastMSE();
            mgr->updateDashboard(temp, hum, bat, power, ip, mse);
        }
        
        vTaskDelay(pdMS_TO_TICKS(5000)); // Update every 5 seconds
    }
}
