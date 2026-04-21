/**
 * @file NotificationManager.h
 * @brief Manages notification delivery (Email, WhatsApp) and cloud sync.
 * @author EdgeSecOps Team
 * @date 2026
 */

#ifndef NOTIFICATION_MANAGER_H
#define NOTIFICATION_MANAGER_H

#include <Arduino.h>
#include <ESP_Mail_Client.h>
#include <freertos/semphr.h>

/**
 * @brief Manages sending notifications (Email, WhatsApp) and Cloud Synchronization.
 * @note Uses CryptoUtils for credential encryption.
 */
class NotificationManager {
private:
    SMTPSession smtp;     /**< SMTP session object for email delivery */
    Session_Config config; /**< SMTP session configuration */
    
    unsigned long lastTempAlertTime = 0;     /**< Last time a temperature alert was sent */
    unsigned long lastHumAlertTime = 0;      /**< Last time a humidity alert was sent */
    unsigned long lastSecurityAlertTime = 0; /**< Last time a security alert was sent */
    
    /**< Cooldown period for alerts (Anti-Spam), 1 Hour by default */
    const unsigned long ALERT_COOLDOWN_MS = 3600000; 
    
    /**
     * @brief Callback function for SMTP status updates.
     * @param status The current SMTP status.
     */
    static void smtpCallback(SMTP_Status status);

public:
    /**
     * @brief Default constructor for NotificationManager.
     */
    NotificationManager();
    
    /**
     * @brief Initializes the notification manager.
     * @return esp_err_t ESP_OK on success, or an error code on failure.
     */
    esp_err_t begin();
    
    /**
     * @brief Sends an email with the specified subject and HTML message.
     * @param subject The email subject.
     * @param htmlMessage The email body in HTML format.
     * @return true if the email was queued/sent successfully, false otherwise.
     */
    bool sendEmail(String subject, String htmlMessage);

    /**
     * @brief Sends a WhatsApp alert message.
     * @param message The alert text to send via WhatsApp.
     */
    void sendWhatsAppAlert(String message);

    /**
     * @brief Synchronizes JSON payload data to the cloud via webhook.
     * @param jsonPayload The JSON data to synchronize.
     */
    void syncDataToCloud(String jsonPayload);
    
    /**
     * @brief Checks sensor readings against thresholds and triggers alerts if necessary.
     * @param temps Array of temperature readings.
     * @param hums Array of humidity readings.
     * @param battery Current battery voltage.
     */
    void checkSensorThresholds(float temps[5], float hums[5], float battery);

    /**
     * @brief Sends a security alert notification.
     * @param eventDescription Description of the security event.
     */
    void sendSecurityAlert(const String& eventDescription);

    /**
     * @brief Sends a password recovery token to the administrator's email.
     * @param adminEmail The email address of the admin.
     * @param recoveryToken The recovery token to send.
     */
    void sendRecoveryToken(const String& adminEmail, const String& recoveryToken);
};

/**
 * @brief Global singleton instance of the NotificationManager.
 */
extern NotificationManager NotifMgr;

#endif // NOTIFICATION_MANAGER_H
