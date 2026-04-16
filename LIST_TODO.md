# 📋 EdgeSecOps - Lista de Tareas Pendientes (ESP-IDF APIs)

Este documento detalla las APIs nativas de ESP-IDF que se implementarán progresivamente para elevar el proyecto a un estándar de grado industrial, enfocándose en **Seguridad**, **Eficiencia Energética** y **Confiabilidad**.

## 🔋 Fase 1: Eficiencia Energética y Hardware
- [x] **Analog to Digital Converter (ADC) Calibration Driver:** Reemplazar la calibración manual por la lectura de eFuses grabados de fábrica para obtener lecturas precisas del voltaje de la batería en milivoltios.
- [ ] **Ultra Low Power (ULP) Coprocessor:** Programar el coprocesador ULP para realizar lecturas de sensores (DHT22/ADC) mientras el procesador principal (y el WiFi) están en Deep Sleep, despertando al sistema principal solo ante anomalías (TinyML) o umbrales críticos.
- [x] **Power Management (Dynamic Frequency Scaling):** Implementar el escalado dinámico de frecuencia de la CPU (ej. 240MHz -> 80MHz) basándose en la carga del sistema (conexiones activas al Web Server / WebSocket).

## ⚙️ Fase 2: RTOS y Confiabilidad
- [x] **Watchdogs Avanzados (Task WDT & Interrupt WDT):** Configurar y suscribir explícitamente cada tarea de FreeRTOS (`SensorTask`, `DataLoggerTask`, Servidor Web) al Task Watchdog Timer. Asegurar que si ocurre un *deadlock* (ej. en un Mutex de LittleFS o NVS) el sistema se recupere automáticamente.
- [x] **Performance Monitor / Heap Memory Debugging:** Implementar trazabilidad para medir el tiempo exacto de inferencia del modelo TensorFlow Lite y monitorear la fragmentación de la memoria Heap y PSRAM a lo largo del tiempo.

## 🛡️ Fase 3: Seguridad (Core EdgeSecOps)
- [ ] **NVS Encryption:** Cifrar la partición NVS utilizando las llaves de hardware del ESP32-S3 para proteger credenciales (SSID, contraseñas, tokens JWT, API Keys) contra extracciones físicas de la memoria Flash.
- [ ] **Mbed TLS / HTTPS Server:** Migrar el servidor web local (`ESPAsyncWebServer`) o implementar un proxy TLS inverso para servir el dashboard React de forma segura (HTTPS) en la red local.
- [ ] **ESP HTTPS OTA:** Reemplazar el mecanismo actual de actualización OTA por la API nativa de ESP-IDF que verifica firmas de certificados TLS y soporta *Rollback* automático si el nuevo firmware falla en el primer arranque.

## 🌐 Fase 4: Conectividad Avanzada
- [x] **Wi-Fi Easy Connect™ (DPP) / Unified Provisioning:** Añadir soporte para el aprovisionamiento de red mediante escaneo de código QR en una pantalla OLED (GM009605V4-I2C-OLED), eliminando la necesidad de conectarse manualmente a la red WiFi abierta del OOBE.
- [ ] **Thread / ESP-BLE-MESH (Opcional):** Explorar la comunicación entre múltiples nodos EdgeSecOps sin depender de un router WiFi central.

## 📊 Fase 5: Manejo de Datos (Time-Series Data)
- [ ] **Almacenamiento Histórico Diario:** Segmentar la escritura de datos CSV (telemetría) en archivos por día (`YYYY-MM-DD.csv`) para optimizar el Wear Leveling del LittleFS y mejorar la eficiencia de lectura.
- [ ] **Retención Automática (Data Retention):** Crear una política dinámica de borrado en C++ (limpiador de espacio) configurada por el usuario (ej. retención de 1 a 3 meses) que elimine el historial más antiguo para prevenir desbordamientos de Flash.
- [ ] **Calendario Interactivo en Frontend (React):** Implementar un calendario (ej. `react-calendar` o `react-day-picker`) en el Dashboard Operacional para seleccionar, visualizar y graficar en tiempo real datasets históricos.
- [ ] **Nuevos Endpoints RESTful:** Agregar `/api/datasets` (listar fechas disponibles), refactorizar `/api/dataset?date=...` y agregar `/api/config/storage` (configurar meses de retención).