// src/api/client.ts
import { api } from '../middleware/apiMiddleware';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_EDGE_API_URL || (import.meta.env.DEV ? 'http://192.168.1.196' : '');

// 1. Interceptor de Peticiones (Request)
api.useRequest((url, options) => {
  const token = sessionStorage.getItem("esp32_token") || sessionStorage.getItem("edge_auth_token");
  const headers = new Headers(options.headers);
  
  // Agregar Content-Type por defecto si no existe
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  
  // Inyectar Token IAM
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  // Resolver la ruta completa si es relativa
  const finalUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  
  return { url: finalUrl, options: { ...options, headers } };
});

// 2. Interceptor de Respuestas (Response)
api.useResponse(async (response) => {
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event("auth-expired"));
      toast.error("Sesión expirada. Por favor, inicia sesión nuevamente.", { id: 'unauthorized' });
    }
    
    // Intentar extraer el mensaje de error del backend
    let errorText = `Error ${response.status}`;
    try {
      const data = await response.clone().json(); // clone() para no consumir el body
      errorText = data.error || data.message || errorText;
    } catch (e) {
      const text = await response.clone().text();
      errorText = text || errorText;
    }
    
    throw new Error(errorText);
  }
  
  return response;
});

// 3. Interceptor Global de Errores
api.useError((error) => {
  console.error("[API Middleware Error]:", error);
  // Mostrar Toast genérico solo si es un error de conexión pura (fetch failed) o abort
  if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
    toast.error("Error de conexión con el nodo Edge. Reintentando...", { id: 'network_error' });
  } else if (error.message) {
    toast.error(error.message); // Mostrar el error del backend
  } else {
    toast.error("Error de conexión. Intenta de nuevo.", { id: 'generic_error' });
  }
  return error;
});

// Exportar la función original para retrocompatibilidad en toda la SPA
const getCache = new Map<string, any>();

export const apiFetch = async (endpoint: string, options: RequestInit = {}, bypassCache: boolean = false) => {
  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  
  // Limpiar caché si es POST/PUT/DELETE
  if (!isGet) {
    if (endpoint.startsWith('/api/config') || endpoint.startsWith('/api/users') || endpoint.startsWith('/api/keys') || endpoint.startsWith('/api/system')) {
      getCache.clear();
    }
  }

  // Verificar caché para peticiones GET
  if (isGet && !bypassCache && getCache.has(endpoint)) {
    const cachedData = getCache.get(endpoint);
    return new Response(JSON.stringify(cachedData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Ahora api.fetch envuelve toda la lógica y pasa a través de los middlewares
  const response = await api.fetch(endpoint, options);
  
  // Guardar en caché si fue un GET exitoso y es JSON
  if (isGet && response.ok && response.headers.get('content-type')?.includes('application/json')) {
    // Evitar cachear endpoints volátiles
    if (!endpoint.includes('/health') && !endpoint.includes('/telemetry') && !endpoint.includes('/dataset') && !endpoint.includes('/oobe')) {
      const clonedRes = response.clone();
      try {
        const data = await clonedRes.json();
        getCache.set(endpoint, data);
      } catch (e) {}
    }
  }

  return response;
};
