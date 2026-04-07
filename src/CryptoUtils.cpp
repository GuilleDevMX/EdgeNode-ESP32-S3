#include "CryptoUtils.h"
#include <esp_log.h>

static const char* TAG = "CryptoUtils";

String generateSHA256(const String& payload) {
    mbedtls_md_context_t ctx;
    mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
    const size_t payloadLength = payload.length();
    byte shaResult[32];
    
    mbedtls_md_init(&ctx);
    
    if (mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 0) != 0) {
        ESP_LOGE(TAG, "Error inicializando contexto SHA256");
        mbedtls_md_free(&ctx);
        return "";
    }
    
    if (mbedtls_md_starts(&ctx) != 0) {
        ESP_LOGE(TAG, "Error en md_starts");
        mbedtls_md_free(&ctx);
        return "";
    }
    
    if (mbedtls_md_update(&ctx, (const unsigned char *)payload.c_str(), payloadLength) != 0) {
        ESP_LOGE(TAG, "Error en md_update");
        mbedtls_md_free(&ctx);
        return "";
    }
    
    if (mbedtls_md_finish(&ctx, shaResult) != 0) {
        ESP_LOGE(TAG, "Error en md_finish");
        mbedtls_md_free(&ctx);
        return "";
    }
    
    mbedtls_md_free(&ctx);
    
    String hashStr = "";
    hashStr.reserve(64);  // Pre-alloc para evitar fragmentación
    for(int i = 0; i < 32; i++) {
        char buf[3];
        sprintf(buf, "%02x", shaResult[i]);
        hashStr += buf;
    }
    return hashStr;
}

String generateRandomHex(size_t length) {
    String result = "";
    result.reserve(length);
    for(size_t i = 0; i < length; i += 2) {
        uint32_t val = esp_random();  // TRNG hardware
        char buf[9];
        sprintf(buf, "%08lx", val);
        result += String(buf).substring(0, min((size_t)8, length - i));
    }
    return result;
}

void deriveKeyFromMAC(uint8_t* outKey) {
    uint8_t mac[6];
    esp_wifi_get_mac(WIFI_IF_STA, mac);
    // Expandir 6 bytes a 16 con mezcla determinística + entropía
    for(int i = 0; i < 16; i++) {
        outKey[i] = mac[i % 6] ^ (i * 0x9E) ^ (esp_random() & 0xFF);
    }
}

String encryptCredential(const String& plaintext) {
    if (plaintext.length() == 0) return "";
    
    uint8_t key[16];
    deriveKeyFromMAC(key);
    
    mbedtls_aes_context aes;
    mbedtls_aes_init(&aes);
    
    if (mbedtls_aes_setkey_enc(&aes, key, 128) != 0) {
        ESP_LOGE(TAG, "Error configurando clave AES");
        mbedtls_aes_free(&aes);
        return "";
    }
    
    // Padding PKCS7
    size_t len = plaintext.length();
    size_t paddedLen = ((len + 15) / 16) * 16;
    uint8_t* buffer = new uint8_t[paddedLen];
    if (!buffer) {
        ESP_LOGE(TAG, "Fallo al asignar memoria para encriptación");
        mbedtls_aes_free(&aes);
        return "";
    }
    
    memset(buffer, 0, paddedLen);
    memcpy(buffer, plaintext.c_str(), len);
    
    // Encriptar bloque por bloque (ECB mode)
    for(size_t i = 0; i < paddedLen; i += 16) {
        if (mbedtls_aes_crypt_ecb(&aes, MBEDTLS_AES_ENCRYPT, buffer + i, buffer + i) != 0) {
            ESP_LOGE(TAG, "Error en encriptación AES");
            delete[] buffer;
            mbedtls_aes_free(&aes);
            return "";
        }
    }
    
    // Convertir a hex para almacenamiento en NVS
    String result = "";
    result.reserve(paddedLen * 2);
    for(size_t i = 0; i < paddedLen; i++) {
        char buf[3];
        sprintf(buf, "%02x", buffer[i]);
        result += buf;
    }
    
    delete[] buffer;
    mbedtls_aes_free(&aes);
    return result;
}

String decryptCredential(const String& encryptedHex) {
    if (encryptedHex.length() == 0 || encryptedHex.length() % 2 != 0) return "";
    
    size_t encryptedLen = encryptedHex.length() / 2;
    uint8_t* buffer = new uint8_t[encryptedLen];
    if (!buffer) {
        ESP_LOGE(TAG, "Fallo al asignar memoria para desencriptación");
        return "";
    }
    
    // Convertir hex a bytes
    for(size_t i = 0; i < encryptedLen; i++) {
        char byteStr[3] = {encryptedHex[i*2], encryptedHex[i*2+1], 0};
        buffer[i] = strtoul(byteStr, NULL, 16);
    }
    
    uint8_t key[16];
    deriveKeyFromMAC(key);
    
    mbedtls_aes_context aes;
    mbedtls_aes_init(&aes);
    
    if (mbedtls_aes_setkey_dec(&aes, key, 128) != 0) {
        ESP_LOGE(TAG, "Error configurando clave AES para desencriptar");
        delete[] buffer;
        mbedtls_aes_free(&aes);
        return "";
    }
    
    // Desencriptar bloque por bloque
    for(size_t i = 0; i < encryptedLen; i += 16) {
        if (mbedtls_aes_crypt_ecb(&aes, MBEDTLS_AES_DECRYPT, buffer + i, buffer + i) != 0) {
            ESP_LOGE(TAG, "Error en desencriptación AES");
            delete[] buffer;
            mbedtls_aes_free(&aes);
            return "";
        }
    }
    
    // Remover padding PKCS7
    uint8_t padding = buffer[encryptedLen - 1];
    if (padding > 16 || padding == 0) {
        ESP_LOGW(TAG, "Padding PKCS7 inválido");
        delete[] buffer;
        mbedtls_aes_free(&aes);
        return "";
    }
    
    size_t originalLen = encryptedLen - padding;
    String result = String((char*)buffer, originalLen);
    
    delete[] buffer;
    mbedtls_aes_free(&aes);
    return result;
}

String sanitizeEmailField(const String& input) {
    String sanitized = input;
    // Eliminar caracteres de control que permiten header injection
    sanitized.replace("\r", "");
    sanitized.replace("\n", "");
    sanitized.replace("%0d", "");
    sanitized.replace("%0a", "");
    sanitized.replace("%0D", "");
    sanitized.replace("%0A", "");
    return sanitized;
}