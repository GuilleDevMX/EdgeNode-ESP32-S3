#ifndef NOTIFICATION_MANAGER_H
#define NOTIFICATION_MANAGER_H

#include <Arduino.h>
#include <ESP_Mail_Client.h>
#include <freertos/semphr.h>

/**
 * @brief Gestiona envío de notificaciones (Email, WhatsApp) y Sincronización Cloud
 * @note Usa CryptoUtils para encriptación de credenciales
 */
class NotificationManager {
private:
    SMTPSession smtp;
    Session_Config config;
    
    // Temporizadores de Rate-Limiting (Anti-Spam)
    unsigned long lastTempAlertTime = 0;
    unsigned long lastHumAlertTime = 0;
    unsigned long lastSecurityAlertTime = 0;
    const unsigned long ALERT_COOLDOWN_MS = 3600000; // 1 Hora de enfriamiento por defecto
    
    // Callbacks y Helpers
    static void smtpCallback(SMTP_Status status);
    void saveEncryptedCredential(const char* key, const String& value);
    String loadEncryptedCredential(const char* key, const String& defaultValue = "");

public:
    NotificationManager();
    
    // Inicialización
    esp_err_t begin();
    
    // Métodos de Comunicación Base
    bool sendEmail(String subject, String htmlMessage);
    void sendWhatsAppAlert(String message);
    void syncDataToCloud(String jsonPayload);
    
    // Casos de uso específicos (Disparadores)
    void checkSensorThresholds(float temp[5], float hum[5], float battery);
    void sendSecurityAlert(const String& eventDescription);
    void sendRecoveryToken(const String& adminEmail, const String& recoveryToken);
};

// Instancia global singleton
extern NotificationManager NotifMgr;

#endif // NOTIFICATION_MANAGER_H