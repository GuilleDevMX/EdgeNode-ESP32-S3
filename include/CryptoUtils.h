/**
 * @file CryptoUtils.h
 * @brief Cryptographic utilities for secure operations and NVS storage.
 * @author EdgeSecOps Team
 * @date 2026
 */

#ifndef CRYPTO_UTILS_H
#define CRYPTO_UTILS_H

#include <Arduino.h>
#include <esp_system.h>
#include <esp_wifi.h>
#include <mbedtls/md.h>
#include <mbedtls/aes.h>

#include <Preferences.h>

/**
 * @brief Generates SHA256 hash with error validation.
 * @param payload String to hash.
 * @return String with hexadecimal hash, or "" if error.
 */
String generateSHA256(const String& payload);

/**
 * @brief Generates secure hexadecimal string using ESP32 TRNG.
 * @param length Desired output length in characters.
 * @return Hexadecimal string of requested length.
 */
String generateRandomHex(size_t length);

/**
 * @brief Derives AES-128 key from device MAC address.
 * @param outKey 16-byte buffer for the derived key.
 */
void deriveKeyFromMAC(uint8_t* outKey);

/**
 * @brief Encrypts credential with AES-128-ECB for NVS storage.
 * @param plaintext String to encrypt.
 * @return Hexadecimal string with encrypted data.
 */
String encryptCredential(const String& plaintext);

/**
 * @brief Decrypts credential previously encrypted with encryptCredential.
 * @param encryptedHex Encrypted hexadecimal string.
 * @return Original decrypted string, or "" if error.
 */
String decryptCredential(const String& encryptedHex);

/**
 * @brief Sanitizes email field to prevent header injection (\\r\\n).
 * @param input String to sanitize.
 * @return String clean of control characters.
 */
String sanitizeEmailField(const String& input);

/**
 * @brief Loads a credential by decrypting it. If not encrypted, returns plain text (fallback).
 * @param prefs Already opened Preferences object.
 * @param key NVS key.
 * @param defaultVal Default value.
 * @return Plain text string.
 */
String loadEncryptedCredential(Preferences& prefs, const char* key, const char* defaultVal = "");

/**
 * @brief Encrypts and saves a credential in NVS.
 * @param prefs Already opened Preferences object.
 * @param key NVS key.
 * @param plaintext Plain text to save.
 */
void saveEncryptedCredential(Preferences& prefs, const char* key, const String& plaintext);

#endif // CRYPTO_UTILS_H
