#include "AiManager.h"
#include <LittleFS.h>
#include <esp_log.h>
#include <TensorFlowLite_ESP32.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"

static const char *TAG = "AiManager";

const float norm_t_min = 10.0;
const float norm_t_max = 40.0;
const float norm_h_min = 20.0;
const float norm_h_max = 80.0;
const float anomaly_threshold = 0.015;

const tflite::Model* ml_model = nullptr;
tflite::MicroInterpreter* ml_interpreter = nullptr;
TfLiteTensor* ml_input = nullptr;
TfLiteTensor* ml_output = nullptr;

constexpr int kTensorArenaSize = 8 * 1024;
uint8_t tensor_arena[kTensorArenaSize];
uint8_t* model_buffer = nullptr;

AiManager AiMgr;

void AiManager::begin() {
    if (!LittleFS.exists("/www/anomaly_net.tflite")) {
        ESP_LOGW(TAG, "TinyML - Modelo inactivo. Esperando archivo .tflite via OTA.");
        return;
    }

    File file = LittleFS.open("/www/anomaly_net.tflite", "r");
    if (!file) { ESP_LOGE(TAG, "TinyML - No se pudo abrir el modelo."); return; }
    
    size_t size = file.size();
    uint32_t caps = psramFound() ? (MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) : MALLOC_CAP_INTERNAL;
    
    model_buffer = (uint8_t*) heap_caps_malloc(size, caps);
    if (!model_buffer) {
        ESP_LOGE(TAG, "TinyML - Fallo al asignar %d bytes.", size);
        file.close(); return;
    }
    
    size_t bytesRead = file.read(model_buffer, size);
    file.close();
    
    if (bytesRead != size) {
        ESP_LOGE(TAG, "TinyML - Lectura incompleta: %d/%d bytes. Liberando buffer...", bytesRead, size);
        heap_caps_free(model_buffer); model_buffer = nullptr; return;
    }

    ml_model = tflite::GetModel(model_buffer);
    if (!ml_model || ml_model->version() != TFLITE_SCHEMA_VERSION) {
        ESP_LOGE(TAG, "TinyML - Modelo corrupto o versión incompatible.");
        heap_caps_free(model_buffer); model_buffer = nullptr; return;
    }

    constexpr size_t minArena = 16 * 1024;
    constexpr size_t maxArena = 64 * 1024;
    const size_t arenaSize = (kTensorArenaSize < minArena) ? minArena : 
                            (kTensorArenaSize > maxArena) ? maxArena : kTensorArenaSize;

    static tflite::AllOpsResolver resolver;
    static tflite::MicroInterpreter static_interpreter(ml_model, resolver, tensor_arena, arenaSize, nullptr);
    ml_interpreter = &static_interpreter;

    if (ml_interpreter->AllocateTensors() != kTfLiteOk) {
        ESP_LOGE(TAG, "TinyML - Fallo AllocateTensors(). Arena: %d bytes.", arenaSize);
        return;
    }

    ml_input = ml_interpreter->input(0);
    ml_output = ml_interpreter->output(0);
    ml_ready = true;
    ESP_LOGI(TAG, "TinyML - Autoencoder Activado (%d bytes).", size);
}

bool AiManager::isReady() const {
    return ml_ready;
}

float AiManager::getLastMSE() const {
    return last_mse;
}

bool AiManager::detectAnomaly(float temperature, float humidity) {
    if (!ml_ready || isnan(temperature) || isnan(humidity)) {
        return false;
    }

    float norm_t = (temperature - norm_t_min) / (norm_t_max - norm_t_min);
    float norm_h = (humidity - norm_h_min) / (norm_h_max - norm_h_min);
    
    if(norm_t < 0) norm_t = 0; if(norm_t > 1) norm_t = 1;
    if(norm_h < 0) norm_h = 0; if(norm_h > 1) norm_h = 1;

    ml_input->data.f[0] = norm_t;
    ml_input->data.f[1] = norm_h;

    if (ml_interpreter->Invoke() == kTfLiteOk) {
        float recon_t = ml_output->data.f[0];
        float recon_h = ml_output->data.f[1];

        last_mse = ((norm_t - recon_t) * (norm_t - recon_t) + 
                    (norm_h - recon_h) * (norm_h - recon_h)) / 2.0;

        return (last_mse > anomaly_threshold);
    }
    return false;
}