import { useState, useEffect, useRef } from 'react';

export interface Telemetry {
  heap_free: number;
  psram_free: number;
  uptime: number;
  temperature?: number;
  humidity?: number;
  battery_v?: number;
}

export interface ChartDataPoint {
  time: string;
  Temperatura: number | undefined;
  Humedad: number | undefined;
}

export function useTelemetry(isProvisioned: boolean | null, authToken: string | null) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [wsStatus, setWsStatus] = useState<string>('Desconectado');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (isProvisioned === true && authToken) {
      const baseUrl = import.meta.env.DEV ? '192.168.1.171' : window.location.hostname;
      const wsUrl = `ws://${baseUrl}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: authToken }));
      ws.onclose = () => setWsStatus('Conexión Cerrada');
      ws.onerror = () => setWsStatus('Error');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'telemetry') {
            setTelemetry({
              heap_free: data.heap_free,
              psram_free: data.psram_free,
              uptime: data.uptime,
              temperature: data.temperature,
              humidity: data.humidity,
              battery_v: data.battery_v
            });

            setChartData(prevData => {
              const now = new Date();
              const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
              
              const newDataPoint = {
                time: timeString,
                Temperatura: data.temperature,
                Humedad: data.humidity
              };

              const newBuffer = [...prevData, newDataPoint];
              if (newBuffer.length > 30) newBuffer.shift(); 
              return newBuffer;
            });
            
          } else if (data.type === 'status') {
            setWsStatus(`Conectado (Secure Channel) - ${data.message}`);
          }
        } catch (e) {
          console.error("[SecOps] Fallo de parseo en payload:", e);
        }
      };
      return () => { if (ws.readyState === 1) ws.close(); };
    }
  }, [isProvisioned, authToken]);

  return { telemetry, wsStatus, chartData };
}
