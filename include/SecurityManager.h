#ifndef SECURITY_MANAGER_H
#define SECURITY_MANAGER_H

#include <Arduino.h>
#include <Preferences.h>
#include <freertos/semphr.h>

/**
 * @brief Gestiona autenticación, autorización y estado de aprovisionamiento
 * @note Singleton global accesible vía SecMgr
 * @warning Requiere nvsMutex externo para acceso thread-safe a NVS
 */
class SecurityManagerClass {
private:
    bool provisioned;
    
    /**
     * @brief Genera hash SHA256 de contraseña (internamente usa CryptoUtils)
     * @deprecated Usar hashPasswordWithSalt() para nueva implementación
     */
    String hashPassword(String payload);
    
    /**
     * @brief Genera hash con salt almacenado en NVS
     * @param password Contraseña en texto plano
     * @param namespaceName Namespace de Preferences donde buscar salt
     * @param saltKey Clave dentro del namespace para el salt
     * @return Hash hexadecimal o "" si error
     */
    String hashPasswordWithSalt(const String& password, const char* namespaceName, const char* saltKey);

public:
    SecurityManagerClass();
    
    // Ciclo de vida
    esp_err_t begin();
    bool isProvisioned();
    
    // Gestión de cuenta Root (OOBE y Actualizaciones)
    bool registerAdmin(const String& username, const String& password);
    void updateAdminPass(const String& newPassword);
    
    // Motor de Autenticación Universal
    bool authenticateUser(const String& username, const String& password);
    
    // Utilidad para obtener rol de usuario (para RBAC)
    String getUserRole(const String& username);
};

// Declaración de la instancia global (Singleton)
extern SecurityManagerClass SecMgr;

#endif // SECURITY_MANAGER_H