/**
 * @file SecurityManager.h
 * @brief Manages authentication, authorization, and provisioning state.
 * @author EdgeSecOps Team
 * @date 2026
 */

#ifndef SECURITY_MANAGER_H
#define SECURITY_MANAGER_H

#include <Arduino.h>
#include <Preferences.h>
#include <freertos/semphr.h>

/**
 * @brief Manages authentication, authorization and provisioning state.
 * @note Global singleton accessible via SecMgr.
 * @warning Requires external nvsMutex for thread-safe access to NVS.
 */
class SecurityManagerClass {
private:
    bool provisioned; /**< Flag indicating if the device has been provisioned */
    
    /**
     * @brief Generates SHA256 hash of a password (internally uses CryptoUtils).
     * @deprecated Use hashPasswordWithSalt() for new implementation.
     * @param payload Password string to hash.
     * @return Hexadecimal string of the hash.
     */
    String hashPassword(String payload);
    
    /**
     * @brief Generates hash with salt stored in NVS.
     * @param password Plain text password.
     * @param namespaceName Preferences namespace where salt is looked up.
     * @param saltKey Key within the namespace for the salt.
     * @return Hexadecimal hash or "" if error.
     */
    String hashPasswordWithSalt(const String& password, const char* namespaceName, const char* saltKey);

public:
    /**
     * @brief Default constructor for SecurityManagerClass.
     */
    SecurityManagerClass();
    
    /**
     * @brief Initializes the security manager and checks provisioning state.
     * @return esp_err_t ESP_OK on success, or an error code on failure.
     */
    esp_err_t begin();

    /**
     * @brief Checks if the device is provisioned.
     * @return true if provisioned, false otherwise.
     */
    bool isProvisioned();
    
    /**
     * @brief Registers the Root/Admin account during OOBE or updates.
     * @param username The administrator username.
     * @param password The administrator password.
     * @return true if successful, false otherwise.
     */
    bool registerAdmin(const String& username, const String& password);

    /**
     * @brief Updates the administrator password.
     * @param newPassword The new password to set.
     */
    void updateAdminPass(const String& newPassword);
    
    /**
     * @brief Universal Authentication Engine.
     * @param username The username to authenticate.
     * @param password The password to authenticate.
     * @return true if authentication is successful, false otherwise.
     */
    bool authenticateUser(const String& username, const String& password);
    
    /**
     * @brief Utility to get user role (for Role-Based Access Control).
     * @param username The username to lookup.
     * @return String representing the user's role.
     */
    String getUserRole(const String& username);
};

/**
 * @brief Global singleton instance of the SecurityManagerClass.
 */
extern SecurityManagerClass SecMgr;

#endif // SECURITY_MANAGER_H
