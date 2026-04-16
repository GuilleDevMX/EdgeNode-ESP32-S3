// src/hooks/useTelemetry.ts
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Telemetry as TelemetryData } from '../interfaces/telemetry';

export const useTelemetry = () => {
  const { token, isAuthenticated } = useAuth();
  const [data, setData] = useState<TelemetryData | null>(null);
  const [status, setstatus] = useState<'connecting' | 'connected' | 'disconnected' | 'unauthorized'>('disconnected');
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    // En producción, el host es dinámico (el propio ESP32). En dev, puedes forzar la IP.
    const host = import.meta.env.DEV ? '192.168.1.196' : window.location.hostname;
    ws.current = new WebSocket(`ws://${host}/ws`);
    setstatus('connecting');

    ws.current.onopen = () => {
      // 🛡️ SecOps: Handshake de Autenticación Inmediato
      ws.current?.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.current.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        if (payload.type === 'status') {
          setstatus('connected');
        } else if (payload.type === 'error' && payload.message === 'invalid_token') {
          setstatus('unauthorized');
          ws.current?.close();
        } else if (payload.type === 'telemetry' && status === 'connected') {
          setData(payload);
        }
      } catch (error) {
        console.error("Error parseando telemetría:", error);
      }
    };

    ws.current.onclose = () => {
      if (status !== 'unauthorized') setstatus('disconnected');
    };

    // Cleanup al desmontar el componente
    return () => {
      if (ws.current?.readyState === WebSocket.OPEN) ws.current.close();
    };
  }, [token, isAuthenticated]);

  return { data, status };
};