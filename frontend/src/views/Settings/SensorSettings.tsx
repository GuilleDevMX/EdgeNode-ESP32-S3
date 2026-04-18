// src/views/Settings/SensorSettings.tsx
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import type { SensorConfig, DhtConfig } from "../../interfaces/sensor";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const SensorSettings = () => {
  const [sensorConfig, setSensorConfig] = useState<SensorConfig>({
    sensors: [
      { pin: 4, type: 22, t_off: -0.5 },
      { pin: 15, type: 22, t_off: -0.5 },
      { pin: 16, type: 22, t_off: -0.5 },
      { pin: 17, type: 22, t_off: -0.5 },
      { pin: 18, type: 22, t_off: -0.5 },
    ],
    adc_pin: 5,
    r1: 100000,
    r2: 100000,
    adc_offset: 0.0,
    adc_mult: 1.0,
    sleep_mode: 0,
    sleep_time: 60,
    polling_rate: 5000,
  });

  const [openAccordion, setOpenAccordion] = useState<number | null>(0);

  const { logout } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch('/api/config/sensors');
        const data = await res.json();
        setSensorConfig(data);
      } catch (error) {
        console.error('Error fetching sensor config:', error);
      }
    };
    fetchData();
  }, []);

  const handleSaveSensors = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch('/api/config/sensors', {
      method: 'POST',
      body: JSON.stringify(sensorConfig),
    });
    const data = await res.json();
    toast.success(data.message);
    handleLogout();
  };

  const handleLogout = () => {
    logout();
  };

  const updateSensor = (index: number, key: keyof DhtConfig, value: number) => {
    const newSensors = [...sensorConfig.sensors];
    if (newSensors[index]) {
      newSensors[index] = { ...newSensors[index], [key]: value };
      setSensorConfig({ ...sensorConfig, sensors: newSensors });
    }
  };

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-text-primary">
          Calibración de Hardware y Telemetría
        </h3>
        <span className="badge badge-warning flex items-center gap-1">
          <svg className="w-3 h-3" fill='currentColor' viewBox='0 0 20 20'>
            <path
              fillRule='evenodd'
              d='M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z'
              clipRule='evenodd'
            ></path>
          </svg>
          DSP: Activo
        </span>
      </div>

      <form className="space-y-8" onSubmit={handleSaveSensors}>
        {/* 1. SENSORES AMBIENTALES (Multi-Zona) */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-border-color pb-2">
            <svg
              className="w-5 h-5 text-blue-support"
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z'
              ></path>
            </svg>
            <h4 className="text-lg font-bold text-text-primary">
              Configuración Multi-Zona (DHT)
            </h4>
          </div>

          <div className="mb-6">
            <label className="label-field">
              Muestreo Global (Polling Rate)
            </label>
            <div className="flex w-full md:w-1/3">
              <input
                type='number'
                min='2000'
                step='500'
                value={sensorConfig.polling_rate}
                onChange={(e) =>
                  setSensorConfig({
                    ...sensorConfig,
                    polling_rate: parseInt(e.target.value) || 2000,
                  })
                }
                className="input-field rounded-l font-mono"
              />
              <span className="bg-app border border-l-0 border-border-color text-muted font-bold p-2 rounded-r flex items-center text-text-secondary">
                ms
              </span>
            </div>
            <p className="text-[10px] text-muted mt-1 font-bold">
              Mínimo seguro: 2000 ms. Afecta a todas las zonas.
            </p>
          </div>

          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={`sensor-${i}`} className="border border-border-color rounded-lg overflow-hidden bg-app">
                <button
                  type="button"
                  className="w-full flex justify-between items-center p-4 bg-panel hover:bg-app transition-colors"
                  onClick={() => setOpenAccordion(openAccordion === i ? null : i)}
                >
                  <span className="font-bold text-text-primary">Zona {i + 1}</span>
                  <svg
                    className={`w-5 h-5 text-text-secondary transform transition-transform ${openAccordion === i ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openAccordion === i && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border-color animate-fade-in">
                    <div>
                      <label className="label-field">Modelo</label>
                      <select
                        value={sensorConfig.sensors?.[i]?.type || 22}
                        onChange={(e) => updateSensor(i, 'type', parseInt(e.target.value))}
                        className="input-field"
                      >
                        <option value='0'>Desactivado</option>
                        <option value='11'>DHT11</option>
                        <option value='21'>DHT21</option>
                        <option value='22'>DHT22</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-field">Pin (GPIO)</label>
                      <input
                        type='number'
                        value={sensorConfig.sensors?.[i]?.pin || -1}
                        onChange={(e) => updateSensor(i, 'pin', parseInt(e.target.value))}
                        className="input-field font-mono"
                        disabled={sensorConfig.sensors?.[i]?.type === 0}
                      />
                    </div>
                    <div>
                      <label className="label-field">Offset Temp (°C)</label>
                      <input
                        type='number'
                        step='0.1'
                        value={sensorConfig.sensors?.[i]?.t_off || 0.0}
                        onChange={(e) => updateSensor(i, 't_off', parseFloat(e.target.value))}
                        className="input-field text-sm"
                        disabled={sensorConfig.sensors?.[i]?.type === 0}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 2. CALIBRACIÓN ADC Y ENERGÍA */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-border-color pb-2">
            <svg
              className="w-5 h-5 text-orange-accent"
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M13 10V3L4 14h7v7l9-11h-7z'
              ></path>
            </svg>
            <h4 className="text-lg font-bold text-text-primary">
              Calibración ADC y Energía
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label-field">
                Pin ADC Batería
              </label>
              <input
                type='number'
                value={sensorConfig.adc_pin}
                onChange={(e) =>
                  setSensorConfig({
                    ...sensorConfig,
                    adc_pin: parseInt(e.target.value),
                  })
                }
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="label-field">
                Resistencia R1 (Ohms)
              </label>
              <input
                type='number'
                value={sensorConfig.r1}
                onChange={(e) =>
                  setSensorConfig({
                    ...sensorConfig,
                    r1: parseFloat(e.target.value),
                  })
                }
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="label-field">
                Resistencia R2 (Ohms)
              </label>
              <input
                type='number'
                value={sensorConfig.r2}
                onChange={(e) =>
                  setSensorConfig({
                    ...sensorConfig,
                    r2: parseFloat(e.target.value),
                  })
                }
                className="input-field font-mono"
              />
            </div>

            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border-color mt-2">
              <div>
                <label className="label-field">
                  ADC Offset (V)
                </label>
                <input
                  type='number'
                  step='0.01'
                  value={sensorConfig.adc_offset || 0.0}
                  onChange={(e) =>
                    setSensorConfig({
                      ...sensorConfig,
                      adc_offset: parseFloat(e.target.value),
                    })
                  }
                  className="input-field text-sm"
                />
                <p className="text-xs text-muted">
                  Ajuste fino de voltaje.
                </p>
              </div>
              <div>
                <label className="label-field">
                  ADC Multiplicador
                </label>
                <input
                  type='number'
                  step='0.01'
                  value={sensorConfig.adc_mult || 1.0}
                  onChange={(e) =>
                    setSensorConfig({
                      ...sensorConfig,
                      adc_mult: parseFloat(e.target.value),
                    })
                  }
                  className="input-field text-sm"
                />
                <p className="text-xs text-muted">
                  Factor de corrección.
                </p>
              </div>
            </div>

            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border-color mt-2">
              <div>
                <label className="label-field">
                  Sleep Mode (Optimización Batería)
                </label>
                <select
                  value={sensorConfig.sleep_mode || 0}
                  onChange={(e) =>
                    setSensorConfig({
                      ...sensorConfig,
                      sleep_mode: parseInt(e.target.value),
                    })
                  }
                  className="input-field text-sm"
                >
                  <option value={0}>Siempre Encendido</option>
                  <option value={1}>Deep Sleep</option>
                </select>
                <p className="text-[10px] text-red-500 dark:text-red-400 font-bold mt-1">
                  Deep Sleep apaga el Servidor Web y REST API.
                </p>
              </div>
              <div>
                <label className="label-field">
                  Intervalo Deep Sleep (s)
                </label>
                <input
                  type='number'
                  value={sensorConfig.sleep_time || 60}
                  onChange={(e) =>
                    setSensorConfig({
                      ...sensorConfig,
                      sleep_time: parseInt(e.target.value),
                    })
                  }
                  className="input-field text-sm"
                />
              </div>
            </div>
          </div>
        </section>

        {/* CONTROLES DE ACCIÓN */}
        <div className="flex justify-end gap-4 pt-2">
          <button
            type='submit'
            className="btn btn-primary"
          >
            Guardar y Reiniciar Hardware
          </button>
        </div>
      </form>
    </div>
  );
};

export default SensorSettings;
