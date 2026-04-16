// src/views/Settings/index.tsx
import {useState } from 'react';
import SmtpSettings from './SmtpSettings';
import SensorSettings from './SensorSettings';
import RedSettings from './RedSettings';
import ApiSettings from './ApiSettings';
import FirmwareSettings from './FirmwareSettings';
import UserSettings from './UserSettings';
import CloudSettings from './CloudSettings';
import WhatsappSettings from './WhatsAppSettings';
import DataSettings from './DataSettings';
import SecuritySettings from './SecuritySettings';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('red');

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-primary">Configuración del Nodo</h2>
        <p className="text-secondary">Administra las alertas y parámetros de hardware.</p>
      </header>

      <div className="flex border-b border-border-color gap-6">
        {['smtp', 'sensores', 'seguridad', 'nube', 'api', 'firmware', 'usuarios', 'whatsapp', 'datos', 'red'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-1 capitalize transition-all ${
              activeTab === tab ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'smtp' && <SmtpSettings />}
        {activeTab === 'sensores' && <SensorSettings />}
        {activeTab === 'red' && <RedSettings />}
        {activeTab === 'nube' && <CloudSettings />}
        {activeTab === 'api' && <ApiSettings />}
        {activeTab === 'firmware' && <FirmwareSettings />}
        {activeTab === 'usuarios' && <UserSettings />}
        {activeTab === 'whatsapp' && <WhatsappSettings />}
        {activeTab === 'datos' && <DataSettings />}
        {activeTab === 'seguridad' && <SecuritySettings />}
      </div>
    </div>
  );
};

export default Settings;