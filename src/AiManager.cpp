/**
 * @file AiManager.cpp
 * @brief Implementation of the AI Manager for TinyML anomaly detection.
 * @author EdgeSecOps Team
 * @date 2026
 */
#include "AiManager.h"
#include <LittleFS.h>
#include <esp_log.h>
#include <TensorFlowLite_ESP32.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include <esp_check.h>

/**
 * @brief TAG used for ESP-IDF logging.
 */
static const char *TAG = "AiManager";

/** @brief Minimum normalization value for temperature. */
const float norm_t_min = 10.0;
/** @brief Maximum normalization value for temperature. */
const float norm_t_max = 40.0;
/** @brief Minimum normalization value for humidity. */
const float norm_h_min = 20.0;
/** @brief Maximum normalization value for humidity. */
const float norm_h_max = 80.0;
/** @brief Minimum normalization value for battery voltage. */
const float norm_b_min = 3.0;
/** @brief Maximum normalization value for battery voltage. */
const float norm_b_max = 4.2;
/** @brief Threshold for anomaly detection based on MSE. */
const float anomaly_threshold = 0.015;

/** @brief Pointer to the loaded TensorFlow Lite model. */
const tflite::Model* ml_model = nullptr;
/** @brief Pointer to the TensorFlow Lite Micro interpreter. */
tflite::MicroInterpreter* ml_interpreter = nullptr;
/** @brief Pointer to the model's input tensor. */
TfLiteTensor* ml_input = nullptr;
/** @brief Pointer to the model's output tensor. */
TfLiteTensor* ml_output = nullptr;

/** @brief Size of the tensor arena in bytes. */
constexpr int kTensorArenaSize = 8 * 1024;
/** @brief Memory buffer for the tensor arena. */
uint8_t tensor_arena[kTensorArenaSize];
/** @brief Dynamically allocated buffer for holding the model data. */
uint8_t* model_buffer = nullptr;

/**
 * @brief Global instance of the AiManager.
 */
AiManager AiMgr;

/**
 * @brief Initializes the AI Manager, loading the model from LittleFS.
 * @return ESP_OK on success, or an error code on failure.
 */
esp_err_t AiManager::begin() {
    if (!LittleFS.exists("/www/anomaly_net.tflite")) {
        ESP_LOGW(TAG, "TinyML - Modelo inactivo. Esperando archivo .tflite via OTA.");
        return ESP_OK;
    }

    File file = LittleFS.open("/www/anomaly_net.tflite", "r");
    ESP_RETURN_ON_FALSE(file, ESP_FAIL, TAG, "TinyML - No se pudo abrir el modelo.");
    
    size_t size = file.size();
    uint32_t caps = psramFound() ? (MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) : MALLOC_CAP_INTERNAL;
    
    model_buffer = (uint8_t*) heap_caps_malloc(size, caps);
    if (!model_buffer) {
        file.close();
        ESP_RETURN_ON_FALSE(false, ESP_ERR_NO_MEM, TAG, "TinyML - Fallo al asignar memoria.");
    }
    
    size_t bytesRead = file.read(model_buffer, size);
    file.close();
    
    if (bytesRead != size) {
        heap_caps_free(model_buffer); model_buffer = nullptr;
        ESP_RETURN_ON_FALSE(false, ESP_FAIL, TAG, "TinyML - Lectura incompleta. Liberando buffer...");
    }

    ml_model = tflite::GetModel(model_buffer);
    if (!ml_model || ml_model->version() != TFLITE_SCHEMA_VERSION) {
        heap_caps_free(model_buffer); model_buffer = nullptr;
        ESP_RETURN_ON_FALSE(false, ESP_FAIL, TAG, "TinyML - Modelo corrupto o versión incompatible.");
    }

    constexpr size_t minArena = 16 * 1024;
    constexpr size_t maxArena = 64 * 1024;
    const size_t arenaSize = (kTensorArenaSize < minArena) ? minArena : 
                            (kTensorArenaSize > maxArena) ? maxArena : kTensorArenaSize;

    static tflite::AllOpsResolver resolver;
    static tflite::MicroInterpreter static_interpreter(ml_model, resolver, tensor_arena, arenaSize, nullptr);
    ml_interpreter = &static_interpreter;

    ESP_RETURN_ON_FALSE(ml_interpreter->AllocateTensors() == kTfLiteOk, ESP_FAIL, TAG, "TinyML - Fallo AllocateTensors().");

    ml_input = ml_interpreter->input(0);
    ml_output = ml_interpreter->output(0);
    ml_ready = true;
    ESP_LOGI(TAG, "TinyML - Autoencoder Activado (%d bytes).", size);
    return ESP_OK;
}

/**
 * @brief Checks if the AI model is loaded and ready for inference.
 * @return True if ready, false otherwise.
 */
bool AiManager::isReady() const {
    return ml_ready;
}

/**
 * @brief Retrieves the Mean Squared Error (MSE) from the last inference.
 * @return The last calculated MSE value.
 */
float AiManager::getLastMSE() const {
    return last_mse;
}

/**
 * @brief Retrieves the duration of the last inference in microseconds.
 * @return Time in microseconds taken for the last inference.
 */
int32_t AiManager::getLastInferenceTime() const {
    return last_inference_time_us;
}

/**
 * @brief Runs anomaly detection inference on provided telemetry data.
 */
bool AiManager::detectAnomaly(float temps[5], float hums[5], float battery) {
    if (!ml_ready) {
        return false;
    }

    float norm_input[11];
    
    for (int i=0; i<5; i++) {
        float t = temps[i];
        float h = hums[i];
        
        // Rellenar variables faltantes con valores medios
        if (isnan(t)) t = 25.0; 
        if (isnan(h)) h = 50.0;

        norm_input[i] = (t - norm_t_min) / (norm_t_max - norm_t_min);
        norm_input[i+5] = (h - norm_h_min) / (norm_h_max - norm_h_min);
    }
    
    // Normalizar batería
    norm_input[10] = (battery - norm_b_min) / (norm_b_max - norm_b_min);

    // Aplicar clipping y asignar al tensor de entrada
    for (int i=0; i<11; i++) {
        if(norm_input[i] < 0) norm_input[i] = 0;
        if(norm_input[i] > 1) norm_input[i] = 1;
        ml_input->data.f[i] = norm_input[i];
    }

    int64_t start_time = esp_timer_get_time();
    if (ml_interpreter->Invoke() == kTfLiteOk) {
        int64_t end_time = esp_timer_get_time();
        last_inference_time_us = (int32_t)(end_time - start_time);

        float mse_sum = 0;
        for (int i=0; i<11; i++) {
            float recon = ml_output->data.f[i];
            mse_sum += (norm_input[i] - recon) * (norm_input[i] - recon);
        }

        last_mse = mse_sum / 11.0;

        return (last_mse > anomaly_threshold);
    }
    return false;
}
