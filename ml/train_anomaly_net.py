import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout
import matplotlib.pyplot as plt
import os

# =========================================================================
# CONFIGURACIÓN Y NORMALIZACIÓN (Debe coincidir con AiManager.cpp)
# =========================================================================
NORM_T_MIN = 10.0
NORM_T_MAX = 40.0
NORM_H_MIN = 20.0
NORM_H_MAX = 80.0
NORM_B_MIN = 3.0
NORM_B_MAX = 4.2

NUM_SAMPLES = 15000  # Cantidad de datos de entrenamiento (Dataset sintético)
MODEL_SAVE_PATH = "../data/www/anomaly_net.tflite"

def normalize_data(t, h, b):
    t_norm = (t - NORM_T_MIN) / (NORM_T_MAX - NORM_T_MIN)
    h_norm = (h - NORM_H_MIN) / (NORM_H_MAX - NORM_H_MIN)
    b_norm = (b - NORM_B_MIN) / (NORM_B_MAX - NORM_B_MIN)
    return np.clip(t_norm, 0, 1), np.clip(h_norm, 0, 1), np.clip(b_norm, 0, 1)

# =========================================================================
# 1. GENERACIÓN DE DATASET SINTÉTICO (Estado "Saludable")
# =========================================================================
print("Generando dataset sintético 'Saludable'...")

# Temperatura saludable: entre 20°C y 30°C (Ruido Gaussiano)
t_data = np.random.normal(loc=25.0, scale=2.5, size=(NUM_SAMPLES, 5))
# Humedad saludable: entre 40% y 60%
h_data = np.random.normal(loc=50.0, scale=5.0, size=(NUM_SAMPLES, 5))
# Batería saludable: Ciclo de descarga lento entre 3.2V y 4.2V
b_data = np.random.uniform(low=3.4, high=4.2, size=(NUM_SAMPLES, 1))

# Normalizar todos los datos
t_norm, h_norm, b_norm = normalize_data(t_data, h_data, b_data)

# Ensamblar el tensor de entrada (Shape: [NUM_SAMPLES, 11])
# Orden en AiManager.cpp: [T0..T4, H0..H4, B]
x_train = np.hstack((t_norm, h_norm, b_norm))

print(f"Shape del dataset: {x_train.shape}")

# =========================================================================
# 2. DEFINICIÓN DEL MODELO AUTOENCODER
# =========================================================================
# Un Autoencoder aprende a comprimir y descomprimir los datos sanos.
# Si recibe datos anómalos, el error de reconstrucción (MSE) será muy alto.

model = Sequential([
    Dense(8, activation='relu', input_shape=(11,)),
    Dense(4, activation='relu'),      # Cuello de botella (Latent Space)
    Dense(8, activation='relu'),
    Dense(11, activation='sigmoid')   # Salida entre 0 y 1
])

model.compile(optimizer='adam', loss='mse')
model.summary()

# =========================================================================
# 3. ENTRENAMIENTO
# =========================================================================
print("Entrenando el modelo...")
history = model.fit(
    x_train, x_train, # En Autoencoders, la entrada y salida deseada es la misma
    epochs=50,
    batch_size=32,
    validation_split=0.2,
    verbose=1
)

# =========================================================================
# 4. CONVERSIÓN A TENSORFLOW LITE (TinyML)
# =========================================================================
print(f"Convirtiendo modelo a TensorFlow Lite...")
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT] # Cuantización a 8-bits para reducir tamaño
tflite_model = converter.convert()

# Guardar directamente en la carpeta del filesystem del ESP32
os.makedirs(os.path.dirname(MODEL_SAVE_PATH), exist_ok=True)
with open(MODEL_SAVE_PATH, "wb") as f:
    f.write(tflite_model)

print(f"¡Modelo guardado exitosamente en: {MODEL_SAVE_PATH}!")
print(f"Tamaño del modelo TFLite: {len(tflite_model)} bytes")

# =========================================================================
# 5. (OPCIONAL) VISUALIZACIÓN DEL ENTRENAMIENTO
# =========================================================================
plt.figure(figsize=(10, 5))
plt.plot(history.history['loss'], label='Pérdida (Entrenamiento)')
plt.plot(history.history['val_loss'], label='Pérdida (Validación)')
plt.title('Entrenamiento del Autoencoder (TinyML)')
plt.xlabel('Época')
plt.ylabel('MSE Loss')
plt.legend()
plt.grid(True)
plt.savefig("training_history.png")
print("Gráfica de entrenamiento guardada en ml/training_history.png")

# Calcular el umbral empírico máximo de error (MSE) de los datos sanos
reconstructions = model.predict(x_train)
mse = np.mean(np.power(x_train - reconstructions, 2), axis=1)
print(f"\nMSE Máximo en datos sanos: {np.max(mse):.6f}")
print("Nota: El valor de umbral en AiManager.cpp (threshold) debería ser mayor a este número.")