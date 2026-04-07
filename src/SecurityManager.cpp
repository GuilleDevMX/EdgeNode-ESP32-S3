#include "SecurityManager.h"
#include "CryptoUtils.h"
#include <esp_log.h>
#include <nvs_flash.h>

// Logger tag
static const char* TAG = "SecMgr";

// Mutex externo para acceso seguro a NVS (declarado en main.cpp)
extern SemaphoreHandle_t nvsMutex;

// Instanciación del Singleton global
SecurityManagerClass SecMgr;

SecurityManagerClass::SecurityManagerClass() {
    provisioned = false;
}

// --- MOTOR CRIPTOGRÁFICO INTERNO (DEPRECADO - Mantenido para compatibilidad) ---
String SecurityManagerClass::hashPassword(String payload) {
    // Redirigir a CryptoUtils para consistencia
    return generateSHA256(payload);
}

// --- MOTOR CRIPTOGRÁFICO CON SALT (NUEVO) ---
String SecurityManagerClass::hashPasswordWithSalt(const String& password, 
                                                   const char* namespaceName, 
                                                   const char* saltKey) {
    Preferences prefs;
    
    // Obtener o generar salt
    String salt = "";
    if (xSemaphoreTake(nvsMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        if (prefs.begin(namespaceName, true)) {
            salt = prefs.getString(saltKey, "");
            prefs.end();
        }
        xSemaphoreGive(nvsMutex);
    }
    
    // Generar salt si no existe
    if (salt == "") {
        salt = generateRandomHex(16);
        if (xSemaphoreTake(nvsMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
            if (prefs.begin(namespaceName, false)) {
                prefs.putString(saltKey, salt);
                prefs.end();
            }
            xSemaphoreGive(nvsMutex);
        }
    }
    
    // Hash con salt
    return generateSHA256(password + salt);
}

// --- CICLO DE VIDA ---
void SecurityManagerClass::begin() {
    // Unificar namespace: "users" con prefijo "root_"
    if (xSemaphoreTake(nvsMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        Preferences prefs;
        if (prefs.begin("users", true)) {
            String rootUser = prefs.getString("root_name", "");
            String rootHash = prefs.getString("root_hash", "");
            prefs.end();
            
            // Provisionado si existen credenciales root válidas
            provisioned = (rootUser != "" && rootHash != "");
        } else {
            ESP_LOGE(TAG, "Error abriendo namespace 'users'");
            provisioned = false;
        }
        xSemaphoreGive(nvsMutex);
    } else {
        ESP_LOGE(TAG, "Timeout esperando mutex de NVS en begin()");
        provisioned = false;
    }
}

bool SecurityManagerClass::isProvisioned() {
    return provisioned;
}

// --- GESTIÓN DE CUENTA ROOT ---
bool SecurityManagerClass::registerAdmin(const String& username, const String& password) {
    if (username == "" || password == "") {
        ESP_LOGW(TAG, "Intento de registro con datos vacíos");
        return false;
    }
    
    if (xSemaphoreTake(nvsMutex, pdMS_TO_TICKS(100)) != pdTRUE) {
        ESP_LOGE(TAG, "Timeout esperando mutex de NVS en registerAdmin()");
        return false;
    }
    
    Preferences prefs;
    if (!prefs.begin("users", false)) {
        ESP_LOGE(TAG, "Error abriendo namespace 'users' para escritura");
        xSemaphoreGive(nvsMutex);
        return false;
    }
    
    // Evitar re-registro (idempotencia)
    if (prefs.getString("root_name", "") != "") {
        prefs.end();
        xSemaphoreGive(nvsMutex);
        ESP_LOGW(TAG, "Intento de re-registro de admin. Operación ignorada.");
        return false;
    }
    
    // Generar salt único y hash seguro
    String salt = generateRandomHex(16);
    String hashedPass = generateSHA256(password + salt);
    
    prefs.putString("root_name", username);
    prefs.putString("root_hash", hashedPass);
    prefs.putString("root_salt", salt);
    prefs.putString("root_role", "admin");  // Rol por defecto
    
    prefs.end();
    xSemaphoreGive(nvsMutex);
    
    provisioned = true;
    ESP_LOGI(TAG, "Admin registrado exitosamente: %s", username.c_str());
    return true;
}

void SecurityManagerClass::updateAdminPass(const String& newPassword) {
    if (newPassword == "") {
        ESP_LOGW(TAG, "Intento de actualizar contraseña con valor vacío");
        return;
    }
    
    if (xSemaphoreTake(nvsMutex, pdMS_TO_TICKS(100)) != pdTRUE) {
        ESP_LOGE(TAG, "Timeout esperando mutex de NVS en updateAdminPass()");
        return;
    }
    
    Preferences prefs;
    if (!prefs.begin("users", false)) {
        ESP_LOGE(TAG, "Error abriendo namespace 'users' para escritura");
        xSemaphoreGive(nvsMutex);
        return;
    }
    
    // Mantener salt existente, solo actualizar hash
    String existingSalt = prefs.getString("root_salt", "");
    if (existingSalt == "") {
        // Migración: generar salt si no existe (compatibilidad con versiones antiguas)
        existingSalt = generateRandomHex(16);
        prefs.putString("root_salt", existingSalt);
    }
    
    String newHash = generateSHA256(newPassword + existingSalt);
    prefs.putString("root_hash", newHash);
    
    prefs.end();
    xSemaphoreGive(nvsMutex);
    
    ESP_LOGI(TAG, "Contraseña de admin actualizada exitosamente");
}

// --- MOTOR DE AUTENTICACIÓN IAM ---
bool SecurityManagerClass::authenticateUser(const String& username, const String& password) {
    if (username == "" || password == "") return false;
    
    // Obtener salt para el usuario (root o regular)
    String salt = "";
    const char* namespaceName = "users";
    String saltKey = (username == "admin") ? "root_salt" : "u_salt_0";  // Simplificado
    
    if (xSemaphoreTake(nvsMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        Preferences prefs;
        if (prefs.begin(namespaceName, true)) {
            // Intentar obtener salt específico del usuario
            if (username == "admin") {
                salt = prefs.getString("root_salt", "");
            } else {
                // Buscar salt en slots de usuarios regulares
                for(int i = 0; i < 5; i++) {
                    String uName = prefs.getString(("u_name_" + String(i)).c_str(), "");
                    if (uName == username) {
                        salt = prefs.getString(("u_salt_" + String(i)).c_str(), "");
                        break;
                    }
                }
            }
            prefs.end();
        }
        xSemaphoreGive(nvsMutex);
    }
    
    // Fallback a salt por defecto si no se encontró
    if (salt == "") {
        salt = "legacy_salt_v1";  // Para compatibilidad con hashes antiguos
    }
    
    // Calcular hash del intento con salt
    String hashedInput = generateSHA256(password + salt);
    
    // Verificación con mutex para lectura consistente
    bool authenticated = false;
    if (xSemaphoreTake(nvsMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        Preferences prefs;
        if (prefs.begin("users", true)) {
            // 1. Verificar cuenta Root (admin)
            String rootUser = prefs.getString("root_name", "");
            String rootHash = prefs.getString("root_hash", "");
            if (username == rootUser && hashedInput == rootHash) {
                authenticated = true;
            }
            
            // 2. Verificar usuarios regulares (si no es admin)
            if (!authenticated && username != "admin") {
                for(int i = 0; i < 5; i++) {
                    String uName = prefs.getString(("u_name_" + String(i)).c_str(), "");
                    String uHash = prefs.getString(("u_hash_" + String(i)).c_str(), "");
                    if (uName != "" && uName == username && uHash == hashedInput) {
                        authenticated = true;
                        break;
                    }
                }
            }
            prefs.end();
        }
        xSemaphoreGive(nvsMutex);
    }
    
    if (authenticated) {
        ESP_LOGI(TAG, "Auth OK: %s", username.c_str());
    } else {
        ESP_LOGW(TAG, "Auth FALLIDO: %s", username.c_str());
    }
    
    return authenticated;
}

// --- UTILIDAD: Obtener rol de usuario para RBAC ---
String SecurityManagerClass::getUserRole(const String& username) {
    String role = "viewer";  // Rol por defecto
    
    if (xSemaphoreTake(nvsMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        Preferences prefs;
        if (prefs.begin("users", true)) {
            // Verificar si es admin root
            if (username == "admin" && prefs.getString("root_name", "") == username) {
                role = prefs.getString("root_role", "admin");
            } else {
                // Buscar en slots de usuarios regulares
                for(int i = 0; i < 5; i++) {
                    String uName = prefs.getString(("u_name_" + String(i)).c_str(), "");
                    if (uName == username) {
                        role = prefs.getString(("u_role_" + String(i)).c_str(), "viewer");
                        break;
                    }
                }
            }
            prefs.end();
        }
        xSemaphoreGive(nvsMutex);
    }
    
    return role;
}