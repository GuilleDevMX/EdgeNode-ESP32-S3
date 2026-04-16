// src/views/Login.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';

export default function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const response = await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error de autenticación.');

      login(data.token, data.role);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Fallo de conexión.');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app p-4 font-sans animate-fade-in">
      <div className="max-w-md w-full bg-panel rounded-2xl shadow-xl overflow-hidden border border-border-color">
        <div className="bg-panel p-8 text-center relative overflow-hidden border-b border-border-color">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-lg">AI</div>
          </div>
          <h2 className="text-2xl font-bold text-primary tracking-wider">EdgeSecOps</h2>
          <p className="text-secondary text-sm mt-2">Control de Acceso IAM</p>
        </div>

        <div className="p-8">
          <form onSubmit={submitLogin} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="label-field">Usuario Administrador</label>
                <input 
                  type="text" 
                  name="username" 
                  placeholder="Ej. admin" 
                  value={formData.username} 
                  onChange={handleChange} 
                  required 
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Contraseña Segura</label>
                <input 
                  type="password" 
                  name="password" 
                  placeholder="••••••••" 
                  value={formData.password} 
                  onChange={handleChange} 
                  required 
                  className="input-field"
                />
              </div>
            </div>

            {status === 'error' && (
              <div className="bg-red-900/40 border-l-4 border-red-500 p-4 rounded-r-lg">
                <p className="text-sm text-red-200 font-medium">{errorMessage}</p>
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={status === 'loading'} 
              className="btn btn-primary w-full py-3 px-4 shadow-md"
            >
              {status === 'loading' ? 'Verificando...' : 'Acceder al Panel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
