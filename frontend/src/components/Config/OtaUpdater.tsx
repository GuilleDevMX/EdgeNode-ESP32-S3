import React, { useState } from 'react';
import { API_BASE_URL } from '../../api/client';

export default function OtaUpdater({ authToken }: { authToken: string | null; onLogout: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('uploading');
    setProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/system/ota`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        setStatus('success');
        setTimeout(() => window.location.reload(), 5000);
      } else {
        setStatus('error');
      }
    };

    xhr.onerror = () => {
      setStatus('error');
    };

    const formData = new FormData();
    formData.append('update', file);
    xhr.send(formData);
  };

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-6">
      <h3 className="text-lg font-bold text-navy-dark mb-1">Actualización de Firmware (OTA)</h3>
      <p className="text-sm text-gray-500 mb-6">Suba un archivo .bin para actualizar el ESP32 inalámbricamente.</p>

      <form onSubmit={handleUpload} className="flex flex-col space-y-4">
        <input 
          type="file" 
          accept=".bin" 
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          disabled={status === 'uploading'}
        />
        
        {status === 'uploading' && (
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
          </div>
        )}

        {status === 'success' && <p className="text-sm text-emerald-600 font-bold">¡Actualización Exitosa! Reiniciando en 5 segundos...</p>}
        {status === 'error' && <p className="text-sm text-red-600 font-bold">Fallo en la subida. Verifique el archivo y su conexión.</p>}

        <button 
          type="submit" 
          disabled={!file || status === 'uploading'} 
          className="self-start bg-navy-dark hover:bg-gray-800 text-white font-bold py-2 px-6 rounded transition-colors disabled:opacity-50"
        >
          {status === 'uploading' ? `Subiendo... ${progress}%` : 'Iniciar Actualización'}
        </button>
      </form>
    </div>
  );
}
