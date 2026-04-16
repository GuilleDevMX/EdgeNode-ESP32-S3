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
        <h2 className="text-2xl font-bold text-text-primary">Configuración del Nodo</h2>
        <p className="text-text-secondary mt-1">Administra las alertas y parámetros de hardware.</p>
      </header>

      <div className="flex border-b border-border-color gap-6 overflow-x-auto custom-scrollbar hide-scrollbar-mobile">
        {['red', 'sensores', 'seguridad', 'nube', 'api', 'firmware', 'usuarios', 'whatsapp', 'datos', 'smtp'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-2 capitalize whitespace-nowrap transition-all border-b-2 font-medium ${
              activeTab === tab 
                ? 'border-accent text-accent' 
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-color'
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