#include "NotificationManager.h"
#include "CryptoUtils.h"
#include "SecurityManager.h"
#include <esp_log.h>
#include <esp_wifi.h>
#include <HTTPClient.h>
#include <UrlEncode.h>
#include <Preferences.h>
#include <esp_check.h>

static const char *TAG = "NOTIF_MGR";

// Instancia global singleton
NotificationManager NotifMgr;

// Declarar la función externa de auditoría (ubicada en main.cpp)
extern void writeAuditLog(String severity, String user, String action);

// (Opcional) Declarar función externa de sanitización si existe en SecurityManager
extern String sanitizeEmailField(String input);

NotificationManager::NotificationManager() {}

void NotificationManager::smtpCallback(SMTP_Status status) {
    ESP_LOGI(TAG, "Estado SMTP: %s", status.info());
}

esp_err_t NotificationManager::begin() {
    MailClient.networkReconnect(true);
    smtp.callback(smtpCallback);
    ESP_LOGI(TAG, "NotificationManager inicializado");
    return ESP_OK;
}

// --- Helpers para credenciales encriptadas ---
void NotificationManager::saveEncryptedCredential(const char* key, const String& value) {
    if (value == "") return;
    String encrypted = encryptCredential(value);
    if (encrypted != "") {
        Preferences prefs;
        if (prefs.begin("smtp", false)) {
            prefs.putString(key, encrypted);
            prefs.end();
        }
    }
}

String NotificationManager::loadEncryptedCredential(const char* key, const String& defaultValue) {
    Preferences prefs;
    String result = defaultValue;
    if (prefs.begin("smtp", true)) {
        String encrypted = prefs.getString(key, "");
        prefs.end();
        if (encrypted != "") {
            String decrypted = decryptCredential(encrypted);
            if (decrypted != "") result = decrypted;
        }
    }
    return result;
}

// =========================================================================
// MÉTODOS DE COMUNICACIÓN BASE
// =========================================================================

bool NotificationManager::sendEmail(String subject, String htmlMessage) {
    // subject = sanitizeEmailField(subject); // Descomentar si implementaste sanitizeEmailField
    
    Preferences prefs;
    prefs.begin("smtp", true);
    bool enabled = prefs.getBool("enabled", false);
    String host = prefs.getString("host", "smtp.gmail.com");
    int port = prefs.getInt("port", 465);
    String user = prefs.getString("user", "");
    String pass = loadEncryptedCredential("pass_enc", "");
    String recipient = prefs.getString("dest", "");
    prefs.end();
    
    if (!enabled || user == "" || pass == "" || recipient == "") return false;
    
    config.server.host_name = host.c_str();
    config.server.port = port;
    config.login.email = user.c_str();
    config.login.password = pass.c_str();
    config.login.user_domain = "";
    
    SMTP_Message message;
    message.sender.name = "EdgeSecOps Node";
    message.sender.email = user.c_str();
    message.subject = subject.c_str();
    message.addRecipient("Admin", recipient.c_str());
    
    String fullHtml = "<div style='font-family: Arial, sans-serif; padding: 20px; border-left: 5px solid #F29F67; background-color: #f9f9f9;'>"
                      "<h2 style='color: #1E1E2C; margin-top: 0;'>Alerta de Sistema EdgeSecOps</h2>"
                      "<p style='line-height: 1.6;'>" + htmlMessage + "</p>"
                      "<hr style='border: 0; border-top: 1px solid #ccc; margin: 20px 0;' />"
                      "<p style='font-size: 11px; color: #666;'>Generado por ESP32 Node.</p></div>";
    
    message.html.content = fullHtml.c_str();
    message.text.content = htmlMessage.c_str(); 
    
    const uint8_t MAX_RETRIES = 2;
    for(uint8_t attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (smtp.connect(&config) && MailClient.sendMail(&smtp, &message)) {
            ESP_LOGI(TAG, "Email enviado a %s", recipient.c_str());
            smtp.closeSession();
            return true;
        }
        smtp.closeSession();
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
    return false;
}

void NotificationManager::sendWhatsAppAlert(String message) {
    if (WiFi.status() != WL_CONNECTED) return;
    
    Preferences p;
    p.begin("smtp", true); // Asumiendo que todo se guarda en el namespace "smtp"
    bool wa_en = p.getBool("wa_en", false);
    String phone = p.getString("wa_phone", "");
    String apiKey = p.getString("wa_api", "");
    p.end();

    if (!wa_en || phone == "" || apiKey == "") return;

    String url = "https://api.callmebot.com/whatsapp.php?phone=" + phone + "&text=" + urlEncode(message) + "&apikey=" + apiKey;
    
    HTTPClient http;
    http.begin(url);
    int httpResponseCode = http.GET();
    
    if (httpResponseCode == 200) {
        ESP_LOGI(TAG, "WhatsApp enviado exitosamente.");
        writeAuditLog("INFO", "system", "Alerta WhatsApp enviada");
    } else {
        ESP_LOGW(TAG, "Error enviando WhatsApp: %d", httpResponseCode);
    }
    http.end();
}

void NotificationManager::syncDataToCloud(String jsonPayload) {
    if (WiFi.status() != WL_CONNECTED) return;
    
    Preferences p;
    p.begin("smtp", true);
    bool cloud_en = p.getBool("cloud_en", false);
    String url = p.getString("cloud_url", "");
    String token = p.getString("cloud_auth", "");
    p.end();

    if (!cloud_en || url == "") return;

    HTTPClient http;
    http.begin(url); 
    http.addHeader("Content-Type", "application/json");
    if (token != "") http.addHeader("Authorization", "Bearer " + token);

    int httpResponseCode = http.POST(jsonPayload);
    
    if (httpResponseCode >= 200 && httpResponseCode < 300) {
        ESP_LOGD(TAG, "Sincronización Cloud exitosa.");
    } else {
        ESP_LOGW(TAG, "Fallo en sincronización Cloud: %d", httpResponseCode);
    }
    http.end();
}

// =========================================================================
// MOTORES DE EVALUACIÓN Y DISPARO
// =========================================================================

void NotificationManager::checkSensorThresholds(float temps[5], float hums[5], float battery) {
    if (WiFi.getMode() != WIFI_STA || WiFi.status() != WL_CONNECTED) return;
    
    Preferences prefs;
    prefs.begin("smtp", true);
    float t_max = prefs.getFloat("t_max", 35.0);
    float t_min = prefs.getFloat("t_min", 10.0);
    float h_max = prefs.getFloat("h_max", 70.0);
    float h_min = prefs.getFloat("h_min", 20.0);
    float b_min = prefs.getFloat("b_min", 3.2);
    bool a_temp = prefs.getBool("a_temp", true);
    bool a_hum = prefs.getBool("a_hum", true);
    bool a_sec = prefs.getBool("a_sec", true);
    unsigned long cooldown_ms = prefs.getInt("cooldown", 60) * 60000UL;
    prefs.end();
    
    unsigned long now = millis();
    
    // 1. TEMPERATURA
    if (a_temp && (now - lastTempAlertTime > cooldown_ms || lastTempAlertTime == 0)) {
        for (int i = 0; i < 5; i++) {
            if (!isnan(temps[i]) && temps[i] > t_max) {
                String emailMsg = "<b>🔥 ALERTA TÉRMICA: SOBRECALENTAMIENTO</b><br><br>El sensor " + String(i) + " registró <b>" + String(temps[i], 1) + " °C</b>.";
                String waMsg = "🔥 ALERTA TÉRMICA\nEl sensor " + String(i) + " registró " + String(temps[i], 1) + " °C, superando el máximo de " + String(t_max, 1) + " °C.";
                
                sendWhatsAppAlert(waMsg); // Dispara WhatsApp
                if(sendEmail("🔥 ALERTA: Alta Temperatura", emailMsg)) lastTempAlertTime = now;
                break;
            }
        }
    }
    
    // 2. HUMEDAD
    if (a_hum && (now - lastHumAlertTime > cooldown_ms || lastHumAlertTime == 0)) {
        for (int i = 0; i < 5; i++) {
            if (!isnan(hums[i]) && hums[i] > h_max) {
                String emailMsg = "<b>💧 ALERTA: EXCESO DE HUMEDAD</b><br><br>El sensor " + String(i) + " registró <b>" + String(hums[i], 1) + " %</b>.";
                String waMsg = "💧 ALERTA DE HUMEDAD\nEl sensor " + String(i) + " registró " + String(hums[i], 1) + " %, superando el límite de " + String(h_max, 1) + " %.";
                
                sendWhatsAppAlert(waMsg);
                if(sendEmail("💧 ALERTA: Humedad Peligrosa", emailMsg)) lastHumAlertTime = now;
                break;
            }
        }
    }
    
    // 3. ENERGÍA
    if (a_sec && (now - lastSecurityAlertTime > cooldown_ms || lastSecurityAlertTime == 0)) {
        if (battery < b_min && battery > 1.0) { 
            String emailMsg = "<b>🔋 ALERTA: BATERÍA CRÍTICA</b><br><br>Voltaje del nodo: <b>" + String(battery, 2) + " V</b>.";
            String waMsg = "🔋 BATERÍA CRÍTICA\nEl voltaje del nodo ha caído a " + String(battery, 2) + " V. Conecte alimentación.";
            
            sendWhatsAppAlert(waMsg);
            if(sendEmail("🔋 ALERTA: Falla de Energía", emailMsg)) lastSecurityAlertTime = now;
        }
    }
}

void NotificationManager::sendSecurityAlert(const String& eventDescription) {
    String emailMsg = "<b>🛡️ ALERTA DE SEGURIDAD</b><br><br>Evento detectado: " + eventDescription;
    String waMsg = "🛡️ ALERTA DE SEGURIDAD\nEvento: " + eventDescription + "\nRevise el panel de EdgeSecOps.";
    
    sendWhatsAppAlert(waMsg);
    sendEmail("🛡️ ALERTA: Evento de Seguridad", emailMsg);
}

void NotificationManager::sendRecoveryToken(const String& adminEmail, const String& recoveryToken) {
    String emailMsg = "<b>🔑 Token de Recuperación</b><br><br>Su token es:<br><code>" + recoveryToken + "</code>";
    // Por seguridad, los tokens de recuperación usualmente SOLO se envían por correo, no por WhatsApp.
    sendEmail("🔑 Recuperación de Cuenta - EdgeSecOps", emailMsg);
}