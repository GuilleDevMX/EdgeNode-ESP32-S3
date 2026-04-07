# Design Spec: EdgeSecOps Dashboard Redesign & Feature Completion

## Purpose & Goals
El objetivo es completar la interfaz de usuario (Dashboard) del nodo IoT (ESP32-S3), conectando los endpoints faltantes del backend (Seguridad, Sensores, IAM/Usuarios, API Keys, Sistema y OTA) mediante una experiencia de usuario fluida, segura y responsiva.

## Aesthetic Direction (Interface Design)
- **Tema:** Corporate Dashboard (Light mode dominante con fuertes contrastes en navy-dark).
- **Tipografía:** Sans-serif (`Inter` o `system-ui`) para limpieza de lectura técnica, usando `mono` (`monospace`) para valores técnicos, IPs y configuraciones críticas.
- **Paleta de Colores:** 
  - Superficies: `app-bg` (#F4F7F6) y `panel-bg` (#FFFFFF).
  - Estructura y Texto Primario: `navy-dark` (#1E1E2C).
  - Acentos y Llamadas a la Acción: `orange-accent` (#F29F67) y `teal-support` (#34B1AA).
- **Profundidad y Elevación:** Enfoque "Borders-only" con sombras (`shadow-sm`) sutiles exclusivas para los contenedores principales y dropdowns. Sin saltos dramáticos de superficie.

## Structural Architecture

### 1. Navegación Adaptativa (Responsiva)
- **Desktop (`md:flex`):** Barra lateral izquierda fija (Sidebar) en color `navy-dark`.
- **Mobile (`md:hidden`):** Bottom Navigation Bar fijado en la parte inferior de la pantalla con íconos para (Dashboard, Configuración, Salir). El header superior contendrá únicamente el logotipo y el estado de conectividad.

### 2. Agrupación de Configuraciones (Consolidada)
La pestaña "Configuraciones" se reestructurará en 3 grandes grupos lógicos (Tabs horizontales) para no abrumar al usuario:
- **Infraestructura:**
  - Red & WiFi (`NetworkForm.tsx`)
  - Configuración de Sensores (Hardware Pins, Polling Rate, Offsets)
- **Accesos (IAM & M2M):**
  - Seguridad Global (Expiración JWT, IP Allowlist)
  - Gestión de Usuarios (Crear/Eliminar operadores y visualizadores)
  - API Keys (Generación y revocación de tokens M2M)
- **Mantenimiento:**
  - Información del Sistema y Almacenamiento
  - Over-The-Air (OTA) Updates
  - Formateo de Datos y Factory Reset

### 3. Patrón de Formularios (Tarjetas Modulares)
Dentro de cada grupo (ej. *Accesos*), las opciones se presentarán como **Tarjetas Modulares Independientes (Sectioned Forms)**.
- Cada tarjeta tendrá su propio contexto de formulario y botón de acción (Ej. "Guardar Políticas", "Generar API Key").
- Esto previene el envío accidental de configuraciones masivas y sigue el principio de *Error Handling* de limitar el alcance del fallo.

## Technical & React Implementation (Vercel Best Practices)

- **Data Fetching (`client-swr-dedup`):** Utilizaremos `SWR` en los hooks personalizados para deduplicar llamadas al backend de la ESP32 (muy crítico por las limitaciones concurrentes del chip).
- **State Management:** Mantenemos la segregación actual (ej. `useConfig.ts`, `useTelemetry.ts`).
- **Error Handling:** 
  - Emplearemos el patrón *Result / Toast Notifications* temporales para la respuesta de las mutaciones, en lugar de alertas bloqueantes.
  - Degradación elegante: Si un endpoint del ESP32 falla (timeout), se mostrará un estado de "Módulo Inaccesible" a nivel de Tarjeta Modular, no tirando toda la vista.
- **Form Component Optimization (`rerender-memo` / `js-early-exit`):** Las tarjetas modulares complejas (como la tabla de usuarios) se extraerán a componentes funcionales separados para evitar re-renders innecesarios de la vista de Configuración completa cada vez que un usuario escriba en un `<input>`.

## Components to Create/Update

1.  **`App.tsx`:** Refactorizar la estructura principal para introducir el `BottomNavigation` en mobile. Actualizar el selector de `activeTab` para que coincida con los 3 Grupos Consolidados.
2.  **`components/Config/InfraGroup.tsx`:** Contendrá el actual `NetworkForm` y el nuevo `SensorsForm`.
3.  **`components/Config/AccessGroup.tsx`:** Contendrá los nuevos `SecurityForm`, `UsersManager` y `ApiKeysManager`.
4.  **`components/Config/MaintenanceGroup.tsx`:** Contendrá el actual `StorageManager`, `SystemInfo` y el componente de subida de archivos `OtaUpdater`.

## Verification Metrics
- [ ] La navegación móvil no requiere menús hamburguesa y es 100% utilizable a una mano.
- [ ] Modificar una política de seguridad no requiere re-guardar el SSID de la red.
- [ ] Se aplican los colores y espaciados dictados por el tema Corporativo de TailwindCSS.