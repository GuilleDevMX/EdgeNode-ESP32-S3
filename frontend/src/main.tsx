// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { TelemetryProvider } from './context/TelemetryContext';
import { ThemeProvider } from './context/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <TelemetryProvider>
          <App />
        </TelemetryProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
