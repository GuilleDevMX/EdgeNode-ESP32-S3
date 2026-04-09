import re
import sys
import os

def extract_block(text, start_pattern):
    match = re.search(start_pattern, text)
    if not match: return None, text
    
    start_idx = match.start()
    
    brace_idx = text.find('{', start_idx)
    if brace_idx == -1: return None, text
    
    count = 1
    end_idx = brace_idx + 1
    while count > 0 and end_idx < len(text):
        if text[end_idx] == '{': count += 1
        elif text[end_idx] == '}': count -= 1
        end_idx += 1
        
    extracted = text[start_idx:end_idx]
    new_text = text[:start_idx] + text[end_idx:]
    return extracted, new_text

with open('src/main.cpp', 'r') as f:
    text = f.read()

original_text = text

text = re.sub(r'String generateRandomHex\(size_t length\);\s*// Helper para salt/nonce\n', '', text)

extracted_pieces = []

# 1. LoginAttempt struct and globals
match = re.search(r'struct LoginAttempt \{.*?\};\n\nstd::map<String, LoginAttempt> loginAttempts;.*?LOGIN_WINDOW_MS = 300000;.*?\n\n', text, re.DOTALL)
if match:
    extracted_pieces.append(match.group(0))
    text = text[:match.start()] + text[match.end():]

# 2. Servers
match = re.search(r'// --- SERVIDORES WEB ---\nAsyncWebServer server\(80\);\nAsyncWebSocket ws\("/ws"\);\n\n', text)
if match:
    extracted_pieces.append(match.group(0))
    text = text[:match.start()] + text[match.end():]
else:
    match = re.search(r'AsyncWebServer server\(80\);\nAsyncWebSocket ws\("/ws"\);\n', text)
    if match:
        extracted_pieces.append(match.group(0))
        text = text[:match.start()] + text[match.end():]

functions_to_extract = [
    r'bool isRateLimited\(const String& clientIP\)',
    r'bool safeNvsRead\(const char\* ns, const char\* key, String& value, const String& defaultVal\)',
    r'bool safeNvsRead\(const char\* ns, const char\* key, int& value, int defaultVal\)',
    r'bool safeNvsRead\(const char\* ns, const char\* key, bool& value, bool defaultVal\)',
    r'bool safeNvsRead\(const char\* ns, const char\* key, float& value, float defaultVal\)',
    r'bool isIpAllowed\(AsyncWebServerRequest \*request\)',
    r'bool isAuthorized\(AsyncWebServerRequest \*request, String requiredRole\)',
    r'void addSecurityHeaders\(AsyncWebServerResponse \*response\)',
    r'void onWsEvent\(AsyncWebSocket \*server, AsyncWebSocketClient \*client, AwsEventType type, void \*arg, uint8_t \*data, size_t len\)',
    r'void cleanupWebServer\(\)',
    r'void writeAuditLog\(String severity, String user, String action\)',
    r'void setupWebServerAPI\(\)'
]

for pattern in functions_to_extract:
    ex, text = extract_block(text, pattern)
    if ex:
        if "setupWebServerAPI" in pattern:
            ex = ex.replace('void setupWebServerAPI() {', 'void ApiServer::begin(bool oobeMode) {\n    if (oobeMode) {\n        NetMgr.setupWebServerOOBE(&server);\n        return;\n    }\n')
        elif "cleanupWebServer" in pattern:
            ex = ex.replace('void cleanupWebServer() {', 'void ApiServer::cleanup() {')
        extracted_pieces.append(ex + "\n")

api_cpp_content = """#include "ApiServer.h"
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <AsyncJson.h>
#include <ArduinoJson.h>
#include "SecurityManager.h"
#include "NotificationManager.h"
#include "NetworkManager.h"
#include "TelemetryManager.h"
#include <Preferences.h>
#include <time.h>
#include <esp_log.h>
#include "CryptoUtils.h"
#include <map>
#include <nvs.h>

static const char *TAG = "ApiServer";

extern Preferences prefs;
extern SemaphoreHandle_t nvsMutex;
extern SemaphoreHandle_t sessionMutex;

extern String currentSessionToken;
extern String currentSessionRole;
extern time_t sessionExpirationEpoch;

extern bool pendingReboot;
extern unsigned long rebootRequestTime;
extern const unsigned long REBOOT_DELAY_MS;

"""

api_cpp_content += "\n".join(extracted_pieces)

api_cpp_content += """

void ApiServer::handleWebSocket() {
    ws.cleanupClients();
}

void ApiServer::broadcastTelemetry(const String& jsonOutput) {
    if(WiFi.getMode() == WIFI_STA && WiFi.status() == WL_CONNECTED && ws.count() > 0) {
        ws.textAll(jsonOutput);
    }
}

ApiServer ApiSrv;
"""

with open('src/ApiServer.cpp', 'w') as f:
    f.write(api_cpp_content)

api_h_content = """#ifndef APISERVER_H
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
"""
with open('include/ApiServer.h', 'w') as f:
    f.write(api_h_content)

# Now modify main_new.txt (which will be written to src/main.cpp)
if '#include "ApiServer.h"' not in text:
    text = text.replace('#include <Arduino.h>', '#include <Arduino.h>\n#include "ApiServer.h"')

# Setup modifications
text = text.replace('NetMgr.setupWebServerOOBE(&server);', 'ApiSrv.begin(true);')
text = text.replace('setupWebServerAPI();', 'ApiSrv.begin(false);')

# Cleanup modification
text = text.replace('cleanupWebServer();', 'ApiSrv.cleanup();')

# Loop WS telemetry logic modification
loop_ws_regex = r'if\s*\(WiFi\.getMode\(\) == WIFI_STA && WiFi\.status\(\) == WL_CONNECTED && ws\.count\(\) > 0\)\s*\{.*?ws\.textAll\(jsonOutput\);\s*\}\s*\}'
match = re.search(loop_ws_regex, text, re.DOTALL)
if match:
    replacement = """
    static unsigned long lastTelemetry = 0;
    if (millis() - lastTelemetry > 5000) {
        lastTelemetry = millis();
        JsonDocument doc; 
        doc["type"] = "telemetry";
        
        doc["temperature"] = TelemetryMgr.getTemperature(); 
        doc["humidity"] = TelemetryMgr.getHumidity(); 
        doc["battery_v"] = TelemetryMgr.getBatteryVoltage();
        doc["power_state"] = TelemetryMgr.getPowerState();
        doc["heap_free"] = ESP.getFreeHeap(); 
        doc["psram_free"] = ESP.getFreePsram(); 
        doc["uptime"] = millis() / 1000;
        
        String jsonOutput; 
        serializeJson(doc, jsonOutput); 
        ApiSrv.broadcastTelemetry(jsonOutput);
    }"""
    text = text[:match.start()] + replacement + text[match.end():]

# In loop(), replace ws.cleanupClients() with ApiSrv.handleWebSocket()
text = text.replace('ws.cleanupClients();', 'ApiSrv.handleWebSocket();')

with open('src/main.cpp', 'w') as f:
    f.write(text)

print("Refactoring done.")
