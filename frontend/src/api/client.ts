// src/api/client.ts
const API_BASE = "";

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("token"); // O desde context
  
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${endpoint}`, { ...options, headers });

  if (response.status === 401) {
    // Redirigir a login o limpiar sesión automáticamente
    window.dispatchEvent(new Event("auth-expired"));
  }

  return response;
};