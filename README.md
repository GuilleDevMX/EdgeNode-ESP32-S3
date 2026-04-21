# EdgeSecOps (Node Edge M2M + TinyML)

![EdgeSecOps Banner](https://via.placeholder.com/1200x300.png?text=EdgeSecOps+-+IoT+Security+%26+Telemetry)

EdgeSecOps es un proyecto integral de IoT (Internet of Things) y Edge Computing diseñado para el microcontrolador ESP32-S3. Funciona como un nodo *Edge* seguro que proporciona telemetría en tiempo real, detección de anomalías locales basada en Inteligencia Artificial (TinyML) y un panel de administración web moderno y responsivo servido directamente desde el dispositivo.

## 🚀 Arquitectura del Proyecto

El proyecto está dividido en dos componentes principales:

1.  **Backend C++ (PlatformIO / ESP-IDF):** Un firmware basado en RTOS que gestiona de manera concurrente los sensores, la red, el almacenamiento interno, la seguridad criptográfica y un modelo de TensorFlow Lite.
2.  **Frontend React (Vite / TypeScript):** Una Single Page Application (SPA) que actúa como *Dashboard* alojada en la memoria Flash (LittleFS) del ESP32. Se comunica con el backend mediante WebSockets y una API RESTful.

---

## 🛠️ Características Principales

### 🔒 Seguridad Industrial Integrada
- **Autenticación mTLS (Mutual TLS):** Soporte para Certificados de Cliente X.509, garantizando conexiones cifradas e identidades verificadas hacia servidores en la nube.
- **Cifrado de Hardware (AES-256-GCM):** Todas las credenciales sensibles (claves Wi-Fi, JWTs, llaves privadas mTLS, contraseñas) se almacenan cifradas en la memoria (NVS) utilizando un vector de inicialización único por dispositivo derivado de su MAC Address.
- **Tokens de Sesión (Bearer JWT):** El acceso a la API RESTful y al WebSocket está protegido por tokens de sesión dinámicos y Role-Based Access Control (RBAC).

### 📡 Telemetría y Edge Computing
- **Soporte Multi-Sensor (DHT22):** Lectura concurrente y *Thread-Safe* de hasta 5 zonas simultáneas (Temperatura y Humedad) con calibración y offsets independientes por zona.
- **Lectura Precisa de Batería (ADC):** Utiliza la calibración por hardware nativa del ESP32 (eFuses) y sobremuestreo de ruido para medir el voltaje real de baterías de LiPo.
- **TinyML (TensorFlow Lite):** Un modelo Autoencoder pre-entrenado que evalúa las 11 variables ambientales de entrada (5x Temperaturas, 5x Humedades y Voltaje de Batería) para detectar y predecir anomalías térmicas o fallos energéticos localmente, sin depender de la nube.

### 🚀 Integración y Despliegue Continuo (CI/CD)
- **GitHub Actions:** Compilación automatizada en cada Pull Request o Push tanto del firmware C++ (PlatformIO) como del Dashboard React (Node.js/Vite).
- **Auto-Releases:** Generación y publicación automática de binarios de distribución (`firmware.bin` y `littlefs.bin`) en cada nuevo Release (Tag) del repositorio.

### 🌐 Conectividad
- **Portal Cautivo (OOBE):** Modo Access Point automático si el dispositivo pierde la conexión o arranca por primera vez, permitiendo la configuración fácil desde el móvil.
- **mDNS Resolver:** Accesible en red local a través de `http://edgenode.local` de forma predeterminada (modificable por el usuario).
- **Webhooks y Notificaciones:** Envío de alertas a WhatsApp (CallMeBot), Email (SMTP nativo) y sincronización con bases de datos en la nube (HTTP/HTTPS Webhooks).

---

## 📦 Estructura del Repositorio

```text
├── .github/workflows/  # Pipelines de CI/CD (Compilación y Releases Automáticos)
├── src/                # Código fuente principal del Backend C++ (PlatformIO)
├── include/            # Cabeceras (.h) del Backend
├── data/               # Sistema de Archivos LittleFS (Binarios del frontend pre-compilados y modelo TFLite)
├── frontend/           # Proyecto completo de React / Vite (Código fuente del Dashboard)
├── ml/                 # Scripts en Python para entrenamiento del modelo de IA (TinyML)
├── platformio.ini      # Configuración de compilación para el ESP32-S3
├── custom_16MB.csv     # Esquema de partición de memoria Flash personalizado
└── LIST_TODO.md        # Roadmap y seguimiento del proyecto
```

---

## ⚙️ Configuración y Despliegue

### Requisitos Previos
*   [PlatformIO IDE](https://platformio.org/) (Extensión de VSCode recomendada).
*   Placa **ESP32-S3** (Específicamente el modelo `esp32-s3-devkitc-1-n16r8v` o similares con al menos 16MB Flash y 8MB PSRAM).
*   Node.js v20+ (Solo si planeas modificar el Frontend).

### 1. Compilar y Subir el Firmware Base (Backend)
1. Abre el directorio principal en VSCode con PlatformIO.
2. Conecta tu ESP32-S3 mediante USB.
3. Ejecuta la tarea `Upload` (o en la terminal: `pio run -t upload`).
4. Abre el Monitor Serie (`pio device monitor`) a `115200` baudios para ver los registros del sistema.

### 2. Subir la Aplicación Web (Frontend a LittleFS)
El firmware C++ requiere que los archivos HTML/JS/CSS del panel de control existan en su memoria.
1. Ejecuta la tarea `Build Filesystem Image` (`pio run -t buildfs`).
2. Ejecuta la tarea `Upload Filesystem Image` (`pio run -t uploadfs`).

> **Nota para Desarrolladores Front-end:** Si deseas hacer cambios en el diseño web, consulta el archivo `frontend/README.md` para ver las instrucciones de desarrollo con React.

### 3. Entrenar el Modelo de Inteligencia Artificial (Opcional)
El proyecto incluye un modelo de TinyML (Autoencoder) pre-entrenado. Si deseas re-entrenarlo o ajustar los umbrales ambientales:
1. Asegúrate de tener Python 3.9+ instalado.
2. Navega al directorio de Machine Learning: `cd ml/`
3. Instala las dependencias: `pip install -r requirements.txt`
4. Ejecuta el script de entrenamiento: `python train_anomaly_net.py`
5. El nuevo modelo se guardará automáticamente en `data/www/anomaly_net.tflite`. Deberás repetir el paso 2 (Subir a LittleFS) para que el ESP32 lo comience a utilizar.

---

## 📝 Documentación Adicional
*   [Guía de Desarrollo del Frontend React](frontend/README.md)
*   **Documentación de Código (Doxygen):** El código base C++ (ESP-IDF/PlatformIO) se encuentra completamente documentado. La documentación en formato HTML se genera en la carpeta `docs/` (Abre `docs/html/index.html` en tu navegador).

---

## 📜 Licencia
Este proyecto es privado/cerrado, diseñado para integraciones industriales específicas.
