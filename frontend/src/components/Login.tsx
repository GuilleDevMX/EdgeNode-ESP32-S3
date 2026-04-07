import { useState } from 'react';
import { API_BASE_URL } from '../api/client';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error de autenticación.');

      sessionStorage.setItem('edge_user_role', data.role);
      onLoginSuccess(data.token);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Fallo de conexión.');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-bg p-4 font-sans animate-fade-in">
      <div className="max-w-md w-full bg-panel-bg rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-navy-dark p-8 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-orange-accent rounded-lg flex items-center justify-center font-bold text-navy-dark text-xl shadow-lg">AI</div>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-wider">EdgeSecOps</h2>
          <p className="text-gray-400 text-sm mt-2">Control de Acceso IAM</p>
        </div>

        <div className="p-8">
          <form onSubmit={submitLogin} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Usuario Administrador</label>
                <input 
                  type="text" 
                  name="username" 
                  placeholder="Ej. admin" 
                  value={formData.username} 
                  onChange={handleChange} 
                  required 
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-orange-accent focus:border-transparent outline-none transition-all text-navy-dark"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Contraseña Segura</label>
                <input 
                  type="password" 
                  name="password" 
                  placeholder="••••••••" 
                  value={formData.password} 
                  onChange={handleChange} 
                  required 
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-orange-accent focus:border-transparent outline-none transition-all text-navy-dark"
                />
              </div>
            </div>

            {status === 'error' && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                <p className="text-sm text-red-700 font-medium">{errorMessage}</p>
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={status === 'loading'} 
              className={`w-full py-3 px-4 flex justify-center items-center rounded-lg font-bold text-navy-dark transition-all shadow-md
                ${status === 'loading' ? 'bg-orange-300 cursor-not-allowed' : 'bg-orange-accent hover:bg-[#E08D55]'}`}
            >
              {status === 'loading' ? 'Verificando...' : 'Acceder al Panel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
