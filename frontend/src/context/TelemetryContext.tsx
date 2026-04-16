// src/context/TelemetryContext.tsx
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { useAuth } from './AuthContext';
import type { Telemetry } from '../interfaces/telemetry';
import toast from 'react-hot-toast';

interface TelemetryState {
  data: Telemetry | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'unauthorized';
  wsStatusStr: string;
}

const TelemetryContext = createContext<TelemetryState | null>(null);

export const TelemetryProvider = ({ children }: { children: React.ReactNode }) => {
  const { token, isAuthenticated, logout } = useAuth();
  const [data, setData] = useState<Telemetry | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'unauthorized'>('disconnected');
  const [wsStatusStr, setWsStatusStr] = useState<string>('Desconectado');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      return;
    }

    let ws: WebSocket;
    let pingInterval: any;
    let reconnectTimeout: any;
    let isIntentionalClose = false;

    const connectWs = () => {
      const host = import.meta.env.DEV ? '192.168.1.196' : window.location.hostname;
      ws = new WebSocket(`ws://${host}/ws`);
      wsRef.current = ws;
      setStatus('connecting');
      setWsStatusStr('Conectando (Verificando JWT)...');

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token }));
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === 'status') {
            setStatus('connected');
            setWsStatusStr(`Conectado (Secure Channel) - ${payload.message}`);
          } else if (payload.type === 'error' && payload.message === 'invalid_token') {
            setStatus('unauthorized');
            setWsStatusStr('Token inválido');
            isIntentionalClose = true;
            ws.close();
            toast.error('🔒 Token JWT expirado o revocado. Ingrese nuevamente.', { id: 'session_ws_expired' });
            logout();
          } else if (payload.type === 'telemetry') {
            setData(payload);
          }
        } catch (error) {
          console.error("Error parseando telemetría:", error);
        }
      };

      ws.onerror = () => {
        setWsStatusStr('Fallo de Enlace');
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        if (!isIntentionalClose) {
          setStatus('disconnected');
          setWsStatusStr('Conexión Perdida. Reconectando...');
          reconnectTimeout = setTimeout(connectWs, 3000);
        } else {
          setStatus('disconnected');
          setWsStatusStr('Desconectado.');
        }
      };
    };

    connectWs();

    return () => {
      isIntentionalClose = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [token, isAuthenticated, logout]);

  return (
    <TelemetryContext.Provider value={{ data, status, wsStatusStr }}>
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetryContext = () => {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error('useTelemetryContext must be used within TelemetryProvider');
  return ctx;
};
