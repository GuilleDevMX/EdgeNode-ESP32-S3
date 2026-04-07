#ifndef CRYPTO_UTILS_H
#define CRYPTO_UTILS_H

#include <Arduino.h>
#include <esp_system.h>
#include <esp_wifi.h>
#include <mbedtls/md.h>
#include <mbedtls/aes.h>

/**
 * @brief Genera hash SHA256 con validación de errores
 * @param payload Cadena a hashear
 * @return String con hash en hexadecimal, o "" si error
 */
String generateSHA256(const String& payload);

/**
 * @brief Genera string hexadecimal seguro usando TRNG del ESP32
 * @param length Longitud deseada del output en caracteres
 * @return String hexadecimal de longitud solicitada
 */
String generateRandomHex(size_t length);

/**
 * @brief Deriva clave AES-128 desde MAC del dispositivo
 * @param outKey Buffer de 16 bytes para la clave derivada
 */
void deriveKeyFromMAC(uint8_t* outKey);

/**
 * @brief Encripta credencial con AES-128-ECB para almacenamiento en NVS
 * @param plaintext Cadena a encriptar
 * @return String hexadecimal con dato encriptado
 */
String encryptCredential(const String& plaintext);

/**
 * @brief Desencripta credencial previamente encriptada con encryptCredential
 * @param encryptedHex String hexadecimal encriptado
 * @return Cadena original desencriptada, o "" si error
 */
String decryptCredential(const String& encryptedHex);

/**
 * @brief Sanitiza campo de email para prevenir header injection (\r\n)
 * @param input Cadena a sanitizar
 * @return Cadena limpia de caracteres de control
 */
String sanitizeEmailField(const String& input);

#endif // CRYPTO_UTILS_H