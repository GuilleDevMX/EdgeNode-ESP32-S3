import React, { useState, useEffect, useRef, useMemo } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ScatterChart, Scatter, ZAxis,
} from "recharts";
import SetupWizard from "./components/SetupWizard";
import Login from "./components/Login";

interface Telemetry {
  heap_free: number;
  psram_free: number;
  heap_max_block?: number;
  psram_max_block?: number;
  ml_inference_us?: number;
  uptime: number;
  temperature?: number;
  humidity?: number;
  battery_v?: number;
  power_state?: string;
}

export default function App() {
  // =====================================================================
  // 1. ESTADOS DE SESIÓN Y UI (Navegación)
  // =====================================================================
  const [isProvisioned, setIsProvisioned] = useState<boolean | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(sessionStorage.getItem("edge_auth_token"));
  const userRole = sessionStorage.getItem('edge_user_role') || 'viewer';

  const [activeMenu,  setActiveMenu] = useState<"dashboard" | "config" | "logs">(() => {
    return (localStorage.getItem("edge_active_menu") as any) || "dashboard";
  });
  const [activeTab, setActiveTab] = useState<"red" | "seguridad" | "usuarios" | "sensores" | "api" | "datos" | "firmware" | "smtp" | "whatsapp" | "cloud" >(() => {
    return (localStorage.getItem("edge_active_tab") as any) || "red";
  });

  // =====================================================================
  // 2. ESTADOS DE TELEMETRÍA Y TIEMPO REAL (WebSockets & Reloj)
  // =====================================================================
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [wsStatus, setWsStatus] = useState<string>("Desconectado");
  const wsRef = useRef<WebSocket | null>(null);
  const [sysTime, setSysTime] = useState(new Date());

  // =====================================================================
  // 3. ESTADOS DE DATA OBSERVABILITY (Gráficos)
  // =====================================================================
  const [chartData, setChartData] = useState<any[]>([]);
  const [timeWindow, setTimeWindow] = useState<number>(60); // 60 pts = 5 min

  // =====================================================================
  // 4. ESTADOS DE AUDITORÍA Y SISTEMA
  // =====================================================================
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isClearLogsModalOpen, setIsClearLogsModalOpen] = useState(false);
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [storageMetrics, setStorageMetrics] = useState({ fs_total: 0, fs_used: 0, nvs_total: 0, nvs_used: 0 });
  const [sysInfo, setSysInfo] = useState({ chip_model: "Cargando...", cores: 2, sdk_version: "...", fw_version: "...", build_date: "...", ml_status: "..." });

  // =====================================================================
  // 5. ESTADOS DE CONFIGURACIÓN (Formularios)
  // =====================================================================
  const [netConfig, setNetConfig] = useState({ ssid: "", pass: "", dhcp: true, ip: "", subnet: "", gateway: "", dns: "", ap_ssid: "", ap_pass: "", ap_hide: false, mdns: "edgenode", ntp: "time.google.com", tz: "CST6CDT,M4.1.0,M10.5.0" });
  const [sensorConfig, setSensorConfig] = useState({ dht_pin: 4, dht_type: 22, adc_pin: 5, r1: 100000, r2: 100000, temp_offset: -0.5, adc_offset: 0.0, adc_mult: 1.0, sleep_mode: 0, sleep_time: 60, polling_rate: 5000 });
  const [secConfig, setSecConfig] = useState({ current_pass: "", new_pass: "", confirm_pass: "", jwt_exp: "15", allowlist_enabled: false, allowlist: "" });
  const [smtpConfig, setSmtpConfig] = useState({ enabled: false, host: "smtp.gmail.com", port: 465, user: "", pass: "", dest: "", t_max: 35.0, t_min: 10.0, h_max: 60.0, h_min: 20.0, b_min: 3.2, cooldown: 60, alert_temp: true, alert_hum: true, alert_sec: true });
  const [waConfig, setWaConfig] = useState({ enabled: false, phone: "", api_key: "" });
  const [cloudConfig, setCloudConfig] = useState({ enabled: false, url: "", token: "" });

  const [usersList, setUsersList] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "viewer" });
  
  const [newApiKey, setNewApiKey] = useState({ name: "", expiration: "30" });
  const [apiKeysList, setApiKeysList] = useState<any[]>([]);
  // Estado para el menú móvil
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  // =====================================================================
  // 6. ESTADOS DERIVADOS (Métricas Calculadas al Vuelo)
  // =====================================================================
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const visibleData = chartData.slice(-timeWindow);
    const temps = visibleData.map((d) => d.Temperatura).filter((t) => t !== undefined);
    const hums = visibleData.map((d) => d.Humedad).filter((h) => h !== undefined);

    if (temps.length === 0 || hums.length === 0) return null;

    return {
      t_mean: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
      t_max: Math.max(...temps).toFixed(1),
      t_min: Math.min(...temps).toFixed(1),
      h_mean: (hums.reduce((a, b) => a + b, 0) / hums.length).toFixed(1),
      h_max: Math.max(...hums).toFixed(1),
      h_min: Math.min(...hums).toFixed(1),
    };
  }, [chartData, timeWindow]);


  // =====================================================================
  // 7. CICLO DE VIDA E INICIALIZACIÓN (Efectos Base)
  // =====================================================================
  
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileMenuOpen(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // 7.1 Reloj del Sistema
  useEffect(() => {
    const timer = setInterval(() => setSysTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 7.2 Persistencia de Navegación UI
  useEffect(() => { localStorage.setItem("edge_active_menu", activeMenu); }, [activeMenu]);
  useEffect(() => { localStorage.setItem("edge_active_tab", activeTab); }, [activeTab]);

  // 7.3 Determinación de Estado OOBE
  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname === "192.168.4.1") setIsProvisioned(false);
    else setIsProvisioned(true);
  }, []);


  // =====================================================================
  // 8. COMUNICACIÓN EN TIEMPO REAL (WebSocket)
  // =====================================================================
  useEffect(() => {
    if (isProvisioned === true && authToken) {
      const wsUrl = import.meta.env.DEV ? "ws://192.168.1.171/ws" : `ws://${window.location.hostname}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token: authToken }));
      ws.onclose = () => setWsStatus("Conexión Cerrada");
      ws.onerror = () => setWsStatus("Error");
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "telemetry") {
            setTelemetry({
              heap_free: data.heap_free, psram_free: data.psram_free, uptime: data.uptime,
              heap_max_block: data.heap_max_block, psram_max_block: data.psram_max_block, ml_inference_us: data.ml_inference_us,
              temperature: data.temperature, humidity: data.humidity, battery_v: data.battery_v, power_state: data.power_state,
            });

            setChartData((prevData) => {
              const now = new Date();
              const timeString = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
              const newDataPoint = { time: timeString, Temperatura: data.temperature, Humedad: data.humidity, Voltaje: data.battery_v };
              const newBuffer = [...prevData, newDataPoint];
              if (newBuffer.length > 360) newBuffer.shift();
              return newBuffer;
            });
          } else if (data.type === "status") {
            setWsStatus(`Conectado (Secure Channel) - ${data.message}`);
          }
        } catch (e) {
          console.error("[SecOps] Fallo de parseo en payload:", e);
        }
      };
      return () => { if (ws.readyState === 1) ws.close(); };
    }
  }, [isProvisioned, authToken]);


  // =====================================================================
  // 9. LECTURA DE DATOS - FETCHERS (Arranque en frío y Configs)
  // =====================================================================
  
  const refreshStorageMetrics = async () => {
    if (!authToken) return;
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL;
      const res = await apiFetch(`${baseUrl}/api/system/storage`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) setStorageMetrics(await res.json());
    } catch (error) { console.error("[SecOps] Error actualizando métricas", error); }
  };

  const loadHistoricalData = async () => {
    if (!authToken) return;
    try {
      const apiUrl = import.meta.env.DEV ? "http://192.168.1.171/api/dataset" : "/api/dataset";
      const response = await apiFetch(apiUrl, { method: "GET", headers: { Authorization: `Bearer ${authToken}` }});
      if (!response.ok) throw new Error("Dataset no disponible");

      const csvText = await response.text();
      const rows = csvText.trim().split("\n");
      const dataRows = rows.slice(1).slice(-60);

      const historicalBuffer = dataRows.map((row) => {
          const [ts, temp, hum, bat] = row.split(",");
          if (!ts || !temp) return null;
          let dateObj = /^\d+$/.test(ts) ? new Date(parseInt(ts) * 1000) : new Date(ts.replace(" ", "T"));
          const timeString = `${dateObj.getHours().toString().padStart(2, "0")}:${dateObj.getMinutes().toString().padStart(2, "0")}:${dateObj.getSeconds().toString().padStart(2, "0")}`;
          return { time: timeString, Temperatura: parseFloat(temp), Humedad: parseFloat(hum), Voltaje: parseFloat(bat) };
        }).filter((item) => item !== null);

      setChartData(historicalBuffer as any[]);
      toast.success("Historial cargado exitosamente.", { icon: "📊", id: "history_toast" });
    } catch (error) { console.log("Arranque en frío limpio."); }
  };

  const fetchAuditLogs = async () => {
    if (!authToken) return;
    try {
      const apiUrl = import.meta.env.DEV ? "http://192.168.1.171/api/system/logs" : "/api/system/logs";
      const response = await apiFetch(apiUrl, { headers: { Authorization: `Bearer ${authToken}` } });
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.reverse());
      }
    } catch (e) { console.error("No se pudieron cargar los logs"); }
  };

  // Efectos Re-Fetch basados en Navegación UI
  useEffect(() => { if (authToken && activeMenu === "dashboard") loadHistoricalData(); }, [authToken, activeMenu]);
  useEffect(() => { if (activeMenu === "logs") fetchAuditLogs(); }, [activeMenu, authToken]);
  
  useEffect(() => {
    if (!authToken || activeMenu !== "config") return;
    const loadConfigData = async () => {
      try {
        const baseUrl = import.meta.env.VITE_EDGE_API_URL;
        const headers = { Authorization: `Bearer ${authToken}` };

        if (activeTab === "red") {
          const res = await apiFetch(`${baseUrl}/api/config/network`, { headers });
          if (res.ok) { const data = await res.json(); setNetConfig((prev) => ({ ...prev, ...data, pass: "" })); }
        } else if (activeTab === "sensores") {
          const res = await apiFetch(`${baseUrl}/api/config/sensors`, { headers });
          if (res.ok) setSensorConfig(await res.json());
        } else if (activeTab === "seguridad") {
          const res = await apiFetch(`${baseUrl}/api/config/security`, { headers });
          if (res.ok) {
            const data = await res.json();
            setSecConfig((prev) => ({ ...prev, jwt_exp: data.jwt_exp, allowlist_enabled: data.allowlist_enabled, allowlist: data.allowlist }));
          }
        } else if (activeTab === "usuarios") {
          const res = await apiFetch(`${baseUrl}/api/users`, { headers });
          if (res.ok) setUsersList(await res.json());
        } else if (activeTab === "api") {
          const res = await apiFetch(`${baseUrl}/api/keys`, { headers });
          if (res.ok) setApiKeysList(await res.json());
        } else if (activeTab === "datos") {
          await refreshStorageMetrics();
        } else if (activeTab === "firmware") {
          const res = await apiFetch(`${baseUrl}/api/system/info`, { headers });
          if (res.ok) setSysInfo(await res.json());
        } else if (activeTab === "smtp") {
          const res = await apiFetch(`${baseUrl}/api/config/smtp`, { headers });
          if (res.ok) setSmtpConfig(await res.json());
        } else if (activeTab === "whatsapp") {
          const res = await apiFetch(`${baseUrl}/api/config/whatsapp`, { headers });
          if (res.ok) setWaConfig(await res.json());
        } else if (activeTab === "cloud") {
          const res = await apiFetch(`${baseUrl}/api/config/cloud`, { headers });
          if (res.ok) setCloudConfig(await res.json());
        }
        
      } catch (error) { console.error(`[SecOps] Error en pestaña ${activeTab}:`, error); }
    };
    loadConfigData();
  }, [activeTab, activeMenu, authToken]);


  // =====================================================================
  // 10. CONTROLADORES DE ACCIÓN Y ESCRITURA (Handlers)
  // =====================================================================
  
  // -- Configuración --
  const handleSaveWA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = import.meta.env.DEV ? 'http://192.168.1.171' : '';
      const res = await apiFetch(`${baseUrl}/api/config/whatsapp`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify(waConfig) });
      if (res.ok) toast.success("Configuración de WhatsApp guardada."); else toast.error("Error al guardar WhatsApp.");
    } catch (err) { toast.error("Error de conexión."); }
  };

  const handleSaveCloud = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = import.meta.env.DEV ? 'http://192.168.1.171' : '';
      const res = await apiFetch(`${baseUrl}/api/config/cloud`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify(cloudConfig) });
      if (res.ok) toast.success("Webhook Cloud guardado."); else toast.error("Error al guardar Webhook.");
    } catch (err) { toast.error("Error de conexión."); }
  };

  // -- Auth Handlers --
  const handleLoginSuccess = (token: string) => {
    sessionStorage.setItem("edge_auth_token", token);
    setAuthToken(token);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("edge_auth_token");
    setAuthToken(null);
    setTelemetry(null);
    if (wsRef.current) wsRef.current.close();
  };

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, options);
    if (res.status === 401) {
      handleLogout();
      toast.error("🔒 Su sesión ha expirado por seguridad. Ingrese nuevamente.", { id: 'session_expired' });
      throw new Error("HTTP_401_UNAUTHORIZED");
    }
    return res;
  };

  // -- Archivos y OTA --
  const downloadDataset = async () => {
    if (!authToken) return;
    try {
      const apiUrl = import.meta.env.DEV ? "http://192.168.1.171/api/dataset" : "/api/dataset";
      const response = await apiFetch(apiUrl, { method: "GET", headers: { Authorization: `Bearer ${authToken}` } });
      if (!response.ok) throw new Error("Fallo en extracción del servidor Edge.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `edgenode_telemetry_${new Date().getTime()}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (error: any) { toast.error(`[SecOps] Bloqueo de descarga: ${error.message}`); }
  };

  const handleOtaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authToken) return;
    if (!file.name.endsWith(".bin") && !file.name.endsWith(".tflite")) return toast.error("[SecOps] Solo .bin o .tflite.");

    const formData = new FormData(); formData.append("firmware", file);
    try {
      setWsStatus("Flasheando Firmware (No desconectar)...");
      const apiUrl = import.meta.env.DEV ? "http://192.168.1.171/api/system/ota" : "/api/system/ota";
      const response = await apiFetch(apiUrl, { method: "POST", headers: { Authorization: `Bearer ${authToken}` }, body: formData });
      if (!response.ok) throw new Error("Error fatal durante el flasheo.");
      
      toast.success("Actualización Exitosa. El panel perderá conexión momentáneamente.");
      handleLogout();
    } catch (error: any) {
      toast.error(`[SecOps] Abortado: ${error.message}`);
      setWsStatus("Conectado");
    }
  };

  // -- Config Updates --
  const handleSaveNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL;
      const res = await apiFetch(`${baseUrl}/api/config/network`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify(netConfig) });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); handleLogout(); } else { toast.error(`Error: ${data.error}`); }
    } catch (err) { toast.error("Fallo de conexión."); }
  };

  const handleSaveSensors = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL;
      const res = await apiFetch(`${baseUrl}/api/config/sensors`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify(sensorConfig) });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); handleLogout(); } else { toast.error(`Error: ${data.error}`); }
    } catch (err) { toast.error("Fallo de conexión."); }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (secConfig.new_pass !== secConfig.confirm_pass) return toast.error("Las contraseñas nuevas no coinciden.");
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL;
      const res = await apiFetch(`${baseUrl}/api/config/security`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ current_pass: secConfig.current_pass, new_pass: secConfig.new_pass, jwt_exp: secConfig.jwt_exp, allowlist_enabled: secConfig.allowlist_enabled, allowlist: secConfig.allowlist }) });
      if (res.ok) {
        toast.success("Políticas de seguridad actualizadas.");
        setSecConfig((prev) => ({ ...prev, current_pass: "", new_pass: "", confirm_pass: "" }));
      } else { toast.error("Error al guardar seguridad."); }
    } catch (err) { toast.error("Fallo de conexión."); }
  };

  const handleSaveSMTP = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL;
      const res = await apiFetch(`${baseUrl}/api/config/smtp`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify(smtpConfig) });
      if (res.ok) toast.success("Configuración SMTP Guardada."); else toast.error("Fallo al guardar SMTP.");
    } catch (err) { toast.error("Error de conexión."); }
  };

  const handleTestEmail = async () => {
    if (!smtpConfig.enabled || !smtpConfig.user || !smtpConfig.pass) return toast.error("Habilite y configure credenciales.");
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL;
      const res = await apiFetch(`${baseUrl}/api/system/test_email`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) toast.success("Correo de prueba enviado."); else toast.error("Fallo al enviar correo.");
    } catch (err) { toast.error("Error de conexión."); }
  };

  // -- Identity & IAM --
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL;
      const res = await apiFetch(`${baseUrl}/api/users`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify(newUser) });
      if (res.ok) {
        toast.success("Usuario aprovisionado con éxito.");
        setNewUser({ username: "", password: "", role: "viewer" });
        setUsersList((prev) => [...prev, { ...newUser, last_login: "Nunca" }]);
      } else { toast.error("Error aprovisionando usuario."); }
    } catch (err) { toast.error("Fallo de conexión."); }
  };

  const handleGenerateApiKey = async () => {
    if (!newApiKey.name) return toast.error("Asigne un nombre a la integración.");
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL;
      const res = await apiFetch(`${baseUrl}/api/keys`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify(newApiKey) });
      const data = await res.json();
      if (res.ok) {
        toast.success(`¡API Key Generada!\n\n${data.token}\n\nCÓPIELO AHORA.`);
        setNewApiKey({ name: "", expiration: "30" });
        const listRes = await apiFetch(`${baseUrl}/api/keys`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (listRes.ok) setApiKeysList(await listRes.json());
      } else { toast.error(`Error: ${data.error}`); }
    } catch (err) { toast.error("Fallo generando token."); }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!window.confirm("¿Seguro que desea revocar este token?")) return;
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL || (import.meta.env.DEV ? "http://192.168.1.171" : "");
      const res = await apiFetch(`${baseUrl}/api/keys?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        setApiKeysList((prev) => prev.filter((key) => key.id !== id));
        toast.success("Token revocado con éxito.");
      } else { toast.error("Fallo al revocar."); }
    } catch (err) { toast.error("Fallo de conexión."); }
  };

  const handleRotateKey = async () => {
    if (!window.confirm("⚠️ ADVERTENCIA: Invalidará tokens activos. ¿Continuar?")) return;
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL;
      const res = await apiFetch(`${baseUrl}/api/system/rotate_key`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) { toast.success("Llave rotada. Sesión terminada."); handleLogout(); } else { toast.error("Fallo al rotar."); }
    } catch (err) { toast.error("Fallo de conexión."); }
  };

  // -- Acciones Destructivas y Auditoría --
  const handleClearLogs = async () => {
    if (!adminPasswordConfirm) return toast.error("Ingrese su contraseña.");
    const apiUrl = import.meta.env.DEV ? "http://192.168.1.171/api/system/logs/clear" : "/api/system/logs/clear";
    try {
      const response = await apiFetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ password: adminPasswordConfirm }) });
      if (!response.ok) throw new Error("Contraseña incorrecta");
      toast.success("Audit Trail borrado permanentemente.");
      setIsClearLogsModalOpen(false); setAdminPasswordConfirm(""); fetchAuditLogs();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDownloadLogs = () => {
    let csvContent = "data:text/csv;charset=utf-8,Timestamp,Severidad,Usuario,Accion\n";
    auditLogs.forEach((row) => { csvContent += `${row.timestamp},${row.severity},${row.user},"${row.action}"\n`; });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `EdgeSecOps_Audit_${new Date().getTime()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleFactoryReset = async () => {
    if (!window.confirm("⚠️ ADVERTENCIA: Borrado total a estado de fábrica. ¿Proceder?")) return;
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL;
      await apiFetch(`${baseUrl}/api/system/factory_reset`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
      toast("Borrado Criptográfico iniciado..."); handleLogout();
    } catch (err) { toast.error("Fallo en destrucción."); }
  };

  const handleFormatLogs = async () => {
    if (!window.confirm("⚠️ ADVERTENCIA: Se eliminará dataset.csv. ¿Proceder?")) return;
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL;
      const res = await apiFetch(`${baseUrl}/api/system/format_logs`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) { toast.success("Historial purgado."); await refreshStorageMetrics(); } else { toast.error("Error al purgar."); }
    } catch (err) { toast.error("Fallo enviando comando."); }
  };

  const handleSystemReboot = async () => {
    if (!window.confirm("¿Forzar reinicio del hardware?")) return;
    try {
      const baseUrl = import.meta.env.VITE_EDGE_API_URL;
      await apiFetch(`${baseUrl}/api/system/reboot`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
      toast("Reinicio iniciado..."); handleLogout();
    } catch (err) { toast.error("Error en reinicio."); }
  };


  // =====================================================================
  // 11. RENDERIZADO CONDICIONAL Y FSM
  // =====================================================================
  if (isProvisioned === null) {
    return (
      <div className="bg-navy-dark h-screen flex items-center justify-center text-white text-lg font-bold">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-teal-400 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        Auditando hardware criptográfico...
      </div>
    );
  }
  
  if (!isProvisioned) return <SetupWizard onComplete={() => setIsProvisioned(true)} />;
  if (!authToken) return <Login onLoginSuccess={handleLoginSuccess} />;

  // --- COMPONENTES UI INTERNOS ---

  // Vista 1: Dashboard Principal (Inteligencia Operacional)
  const renderDashboard = () => {
    const isTempCritical = telemetry?.temperature && telemetry.temperature > 35.0;
    const isBatCritical = telemetry?.battery_v && telemetry.battery_v < 3.2;
    const visibleData = chartData.slice(-timeWindow);

    return (
      <div className="space-y-6 animate-fade-in">
        {/* BANNER DE ALERTAS DINÁMICAS */}
        {(isTempCritical || isBatCritical) && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm flex items-start gap-4 animate-pulse">
            <svg className="w-6 h-6 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <div>
              <h3 className="text-red-800 font-bold">Intervención Requerida</h3>
              <p className="text-red-700 text-sm mt-1">
                {isTempCritical && "🔥 Sobrecalentamiento detectado en el nodo. "}
                {isBatCritical && "🔋 Batería en nivel crítico. Conecte alimentación. "}
              </p>
            </div>
          </div>
        )}

        {/* TOOLBAR DE ANÁLISIS */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="font-bold text-navy-dark flex items-center gap-2">
            <svg
              className="w-5 h-5 text-teal-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              ></path>
            </svg>
            Centro de Inteligencia Operacional
          </h3>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-gray-500">Ventana de Análisis:</span>
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(Number(e.target.value))}
              className="border border-gray-300 rounded px-3 py-1 text-navy-dark focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer bg-gray-50"
            >
              <option value={60}>Últimos 5 Minutos</option>
              <option value={180}>Últimos 15 Minutos</option>
              <option value={360}>Últimos 30 Minutos</option>
            </select>
          </div>
        </div>

        {/* KPIs Superiores + Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* KPI Temperatura */}
          <div className="bg-panel-bg p-5 rounded-lg border-l-4 border-orange-accent shadow-sm relative overflow-hidden group">
            <p className="text-gray-500 text-sm font-semibold">
              T_DHT22 (Temperatura)
            </p>
            <div className="flex items-end gap-3 mt-2">
              <p className="text-3xl font-bold text-navy-dark">
                {telemetry?.temperature?.toFixed(1) || "--"}{" "}
                <span className="text-lg">°C</span>
              </p>
              {stats && (
                <span className="text-xs font-bold text-gray-400 mb-1">
                  Media: {stats.t_mean}°C
                </span>
              )}
            </div>
            {/* Mini-Stats Hover */}
            <div className="absolute inset-x-0 bottom-0 bg-orange-50 h-0 group-hover:h-8 transition-all flex items-center justify-around px-2 opacity-0 group-hover:opacity-100 text-[10px] font-bold text-orange-800">
              <span>MAX: {stats?.t_max || "--"}°C</span>
              <span>MIN: {stats?.t_min || "--"}°C</span>
            </div>
          </div>

          {/* KPI Humedad */}
          <div className="bg-panel-bg p-5 rounded-lg border-l-4 border-blue-support shadow-sm relative overflow-hidden group">
            <p className="text-gray-500 text-sm font-semibold">
              H_DHT22 (Humedad)
            </p>
            <div className="flex items-end gap-3 mt-2">
              <p className="text-3xl font-bold text-navy-dark">
                {telemetry?.humidity?.toFixed(1) || "--"}{" "}
                <span className="text-lg">%</span>
              </p>
              {stats && (
                <span className="text-xs font-bold text-gray-400 mb-1">
                  Media: {stats.h_mean}%
                </span>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-blue-50 h-0 group-hover:h-8 transition-all flex items-center justify-around px-2 opacity-0 group-hover:opacity-100 text-[10px] font-bold text-blue-800">
              <span>MAX: {stats?.h_max || "--"}%</span>
              <span>MIN: {stats?.h_min || "--"}%</span>
            </div>
          </div>

          {/* Tarjeta de Energía Dinámica */}
          <div
            className={`bg-panel-bg p-5 rounded-lg border-l-4 shadow-sm transition-colors ${
              telemetry?.power_state === "Charging"
                ? "border-orange-500 bg-orange-50/30"
                : telemetry?.power_state === "Charged"
                  ? "border-green-500 bg-green-50/30"
                  : "border-yellow-support"
            }`}
          >
            <div className="flex justify-between items-start">
              <p className="text-gray-500 text-sm font-semibold">
                V_BAT (TP4056)
              </p>
              <span className="text-xl">
                {telemetry?.power_state === "Charging"
                  ? "⚡"
                  : telemetry?.power_state === "Charged"
                    ? "🔌"
                    : "🔋"}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-3xl font-bold text-navy-dark">
                {telemetry?.battery_v?.toFixed(2) || "--"}{" "}
                <span className="text-lg">V</span>
              </p>
              <p
                className={`text-[10px] uppercase font-bold ${
                  telemetry?.power_state === "Charging"
                    ? "text-orange-600 animate-pulse"
                    : telemetry?.power_state === "Charged"
                      ? "text-green-600"
                      : "text-gray-500"
                }`}
              >
                {telemetry?.power_state === "Charging"
                  ? "Cargando"
                  : telemetry?.power_state === "Charged"
                    ? "Full"
                    : "Batería"}
              </p>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden shadow-inner">
              <div
                className={`h-1.5 rounded-full transition-all duration-1000 ${
                  telemetry?.power_state === "Charging"
                    ? "bg-orange-500"
                    : telemetry?.power_state === "Charged"
                      ? "bg-green-500"
                      : (telemetry?.battery_v || 0) < 3.4
                        ? "bg-red-500"
                        : "bg-yellow-support"
                }`}
                style={{
                  width: `${Math.max(0, Math.min(100, (((telemetry?.battery_v || 0) - 3.2) / 1.0) * 100))}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Estado del Sistema */}
          <div className="bg-panel-bg p-5 rounded-lg shadow-sm bg-navy-dark text-white flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <p className="text-gray-400 text-sm font-semibold">
                Estado del Enlace WS
              </p>
              <span className="text-xs font-mono text-gray-500">Up: {telemetry?.uptime || 0}s</span>
            </div>
            <p
              className="text-sm font-bold text-teal-support truncate mt-1"
              title={wsStatus}
            >
              {wsStatus}
            </p>
            
            {/* INFERENCE AND FRAGMENTATION */}
            <div className="border-t border-gray-700 mt-3 pt-3 grid grid-cols-2 gap-2 text-xs font-mono text-gray-400">
                <div>
                  <p>Inferencia ML:</p>
                  <p className="text-teal-400 font-bold text-sm">{telemetry?.ml_inference_us ? (telemetry.ml_inference_us / 1000).toFixed(1) : '--'} ms</p>
                </div>
                <div>
                  <p>Heap Free / Max:</p>
                  <p className="text-teal-400 font-bold text-sm">
                    {((telemetry?.heap_free || 0) / 1024).toFixed(0)} / {((telemetry?.heap_max_block || 0) / 1024).toFixed(0)} KB
                  </p>
                </div>
            </div>
          </div>
        </div>

        {/* ÁREA DE GRÁFICOS AVANZADOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GRÁFICO 1: Clima (Doble Eje Y) */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col lg:col-span-2">
            <h4 className="text-sm font-bold text-gray-700 mb-4 border-b pb-2 uppercase tracking-wider">
              Tendencia Termodinámica
            </h4>
            <div className="flex-1 min-h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={visibleData}
                  margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0f0f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    stroke="#9ca3af"
                    fontSize={10}
                    tickMargin={10}
                    minTickGap={30}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#F29F67"
                    fontSize={10}
                    domain={["dataMin - 2", "dataMax + 2"]}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#3B8FF3"
                    fontSize={10}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1E1E2C",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                      border: "none",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="Temperatura"
                    stroke="#F29F67"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Humedad"
                    stroke="#3B8FF3"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICO 2: Descarga de Batería */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col">
            <h4 className="text-sm font-bold text-gray-700 mb-4 border-b pb-2 uppercase tracking-wider flex justify-between">
              <span>Análisis de Consumo (V_BAT)</span>
              {visibleData.length > 0 && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    (visibleData[visibleData.length - 1]?.Voltaje || 0) <
                    (visibleData[0]?.Voltaje || 0)
                      ? "bg-red-50 text-red-600"
                      : "bg-green-50 text-green-600"
                  }`}
                >
                  Tendencia:{" "}
                  {(visibleData[visibleData.length - 1]?.Voltaje || 0) <
                  (visibleData[0]?.Voltaje || 0)
                    ? "↓ Descargando"
                    : "↑ Estable/Carga"}
                </span>
              )}
            </h4>
            <div className="flex-1 min-h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={visibleData}
                  margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0f0f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    stroke="#9ca3af"
                    fontSize={10}
                    tickMargin={10}
                    minTickGap={30}
                  />
                  <YAxis
                    stroke="#8B5CF6"
                    fontSize={10}
                    domain={[3.0, 4.3]}
                    tickCount={6}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1E1E2C",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                      border: "none",
                    }}
                    formatter={(value: any) => [
                      `${Number(value || 0).toFixed(2)} V`,
                      "Voltaje",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="Voltaje"
                    name="Voltaje Batería"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: "#8B5CF6" }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICO 3: Histograma (Scatter) de Dispersión */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col">
            <h4 className="text-sm font-bold text-gray-700 mb-4 border-b pb-2 uppercase tracking-wider flex justify-between items-center">
              <span>Dispersión Ambiental (TinyML View)</span>
              <span className="text-[10px] text-gray-400 font-normal normal-case">
                Temp vs Humedad
              </span>
            </h4>
            <div className="flex-1 min-h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  {/* Eje X: Temperatura */}
                  <XAxis
                    type="number"
                    dataKey="Temperatura"
                    name="Temp"
                    unit="°C"
                    stroke="#9ca3af"
                    fontSize={10}
                    domain={["dataMin - 1", "dataMax + 1"]}
                    tickCount={5}
                  />
                  {/* Eje Y: Humedad */}
                  <YAxis
                    type="number"
                    dataKey="Humedad"
                    name="Humedad"
                    unit="%"
                    stroke="#9ca3af"
                    fontSize={10}
                    domain={["dataMin - 5", "dataMax + 5"]}
                  />
                  {/* ZAxis controla el tamaño del punto. Lo mantenemos fijo o dependiente del tiempo */}
                  <ZAxis type="number" range={[20, 20]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      backgroundColor: "#1E1E2C",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                      border: "none",
                    }}
                  />
                  <Scatter
                    name="Lecturas"
                    data={visibleData}
                    fill="#14B8A6"
                    opacity={0.6}
                    isAnimationActive={false}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-center text-gray-500 mt-2">
              Este gráfico ayuda a visualizar los "clústeres" de comportamiento
              normal que el modelo TinyML (Autoencoder) ha aprendido. Los puntos
              atípicos (lejos de la nube principal) podrían generar alertas de
              anomalía.
            </p>
          </div>
        </div>
      </div>
    );
  };
  // Vista 2: Registro de Auditoría (Audit Trail)
  const renderLogs = () => {
    const userRole = sessionStorage.getItem("edge_user_role") || "viewer";

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div>
            <h3 className="font-bold text-navy-dark text-lg">
              Registro de Auditoría (Audit Trail)
            </h3>
            <p className="text-gray-500 text-sm">
              Visualizando eventos según su nivel de autorización ({userRole}).
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDownloadLogs}
              className="px-4 py-2 bg-blue-50 text-blue-700 font-bold rounded shadow-sm hover:bg-blue-100 transition-colors flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                ></path>
              </svg>
              Descargar CSV
            </button>
            {userRole === "admin" && (
              <button
                onClick={() => setIsClearLogsModalOpen(true)}
                className="px-4 py-2 bg-red-50 text-red-700 font-bold rounded shadow-sm hover:bg-red-100 transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  ></path>
                </svg>
                Purgar Logs
              </button>
            )}
          </div>
        </div>

        {/* TABLA DE AUDITORÍA */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                <tr>
                  <th className="p-4">Marca de Tiempo</th>
                  <th className="p-4">Nivel</th>
                  <th className="p-4">Usuario (Actor)</th>
                  <th className="p-4">Acción Registrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      No hay registros de auditoría disponibles.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-mono text-gray-500">
                        {log.timestamp}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            log.severity === "CRIT"
                              ? "bg-red-100 text-red-800"
                              : log.severity === "WARN"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-gray-700">
                        {log.user}
                      </td>
                      <td className="p-4 text-gray-600">{log.action}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL DE CONFIRMACIÓN PARA BORRAR LOGS */}
        {isClearLogsModalOpen && (
          <div className="fixed inset-0 bg-navy-dark/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in border-t-4 border-red-500">
              <h3 className="text-xl font-bold text-navy-dark mb-2">
                Peligro: Destrucción de Auditoría
              </h3>
              <p className="text-gray-600 mb-6 text-sm">
                Está a punto de borrar irremediablemente el historial de eventos
                del sistema. Esta acción quedará registrada en el nuevo log.
                <strong> Requiere firma de seguridad.</strong>
              </p>

              <label className="block text-sm font-bold text-gray-700 mb-2">
                Contraseña de Administrador (Root)
              </label>
              <input
                type="password"
                value={adminPasswordConfirm}
                onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-6 focus:ring-2 focus:ring-red-500 outline-none"
              />

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsClearLogsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClearLogs}
                  className="px-4 py-2 bg-red-600 text-white font-bold rounded shadow hover:bg-red-700"
                >
                  Confirmar Destrucción
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  // Vista 3: Configuración Avanzada del Nodo
  const renderConfig = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[500px] flex flex-col md:flex-row overflow-hidden">
      {/* Tab Navigation */}
      <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 flex flex-row md:flex-col overflow-x-auto shrink-0 custom-scrollbar">
        <button onClick={() => setActiveTab('red')} className={`whitespace-nowrap p-4 text-left font-bold transition-colors ${activeTab === 'red' ? 'bg-white text-teal-600 md:border-l-4 border-b-4 md:border-b-0 border-teal-600' : 'text-gray-600 hover:bg-gray-100'}`}>🌐 Red WiFi</button>
        {userRole === 'admin' && <button onClick={() => setActiveTab('seguridad')} className={`whitespace-nowrap p-4 text-left font-bold transition-colors ${activeTab === 'seguridad' ? 'bg-white text-teal-600 md:border-l-4 border-b-4 md:border-b-0 border-teal-600' : 'text-gray-600 hover:bg-gray-100'}`}>🛡️ Seguridad</button>}
        {userRole === 'admin' && <button onClick={() => setActiveTab('usuarios')} className={`whitespace-nowrap p-4 text-left font-bold transition-colors ${activeTab === 'usuarios' ? 'bg-white text-teal-600 md:border-l-4 border-b-4 md:border-b-0 border-teal-600' : 'text-gray-600 hover:bg-gray-100'}`}>👥 Usuarios</button>}
        {(userRole === 'admin' || userRole === 'operator') && <button onClick={() => setActiveTab('sensores')} className={`whitespace-nowrap p-4 text-left font-bold transition-colors ${activeTab === 'sensores' ? 'bg-white text-teal-600 md:border-l-4 border-b-4 md:border-b-0 border-teal-600' : 'text-gray-600 hover:bg-gray-100'}`}>🎛️ Sensores</button>}
        {userRole === 'admin' && <button onClick={() => setActiveTab('api')} className={`whitespace-nowrap p-4 text-left font-bold transition-colors ${activeTab === 'api' ? 'bg-white text-teal-600 md:border-l-4 border-b-4 md:border-b-0 border-teal-600' : 'text-gray-600 hover:bg-gray-100'}`}>🔑 API Keys</button>}
        {userRole === 'admin' && <button onClick={() => setActiveTab('smtp')} className={`whitespace-nowrap p-4 text-left font-bold transition-colors ${activeTab === 'smtp' ? 'bg-white text-teal-600 md:border-l-4 border-b-4 md:border-b-0 border-teal-600' : 'text-gray-600 hover:bg-gray-100'}`}>📧 Alertas SMTP</button>}
        {userRole === 'admin' && <button onClick={() => setActiveTab('datos')} className={`whitespace-nowrap p-4 text-left font-bold transition-colors ${activeTab === 'datos' ? 'bg-white text-teal-600 md:border-l-4 border-b-4 md:border-b-0 border-teal-600' : 'text-gray-600 hover:bg-gray-100'}`}>💾 Sistema</button>}
        {userRole === 'admin' && <button onClick={() => setActiveTab('firmware')} className={`whitespace-nowrap p-4 text-left font-bold transition-colors ${activeTab === 'firmware' ? 'bg-white text-teal-600 md:border-l-4 border-b-4 md:border-b-0 border-teal-600' : 'text-gray-600 hover:bg-gray-100'}`}>⚡ Firmware OTA</button>}
        {userRole === 'admin' && <button onClick={() => setActiveTab('whatsapp')} className={`whitespace-nowrap p-4 text-left font-bold transition-colors ${activeTab === 'whatsapp' ? 'bg-white text-teal-600 md:border-l-4 border-b-4 md:border-b-0 border-teal-600' : 'text-gray-600 hover:bg-gray-100'}`}>💬 WhatsApp</button>}
        {userRole === 'admin' && <button onClick={() => setActiveTab('cloud')} className={`whitespace-nowrap p-4 text-left font-bold transition-colors ${activeTab === 'cloud' ? 'bg-white text-teal-600 md:border-l-4 border-b-4 md:border-b-0 border-teal-600' : 'text-gray-600 hover:bg-gray-100'}`}>☁️ Cloud Sync</button>}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "red" && (
          <div className="max-w-4xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-navy-dark">
                Configuración de Red y Conectividad
              </h3>
              <span className="bg-teal-50 text-teal-700 border border-teal-200 text-xs px-3 py-1 rounded-full font-semibold">
                Estado Actual: Conectado (STA)
              </span>
            </div>

            <form className="space-y-8" onSubmit={handleSaveNetwork}>
              {/* 1. RED OPERATIVA (STA) */}
              <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                  <svg
                    className="w-5 h-5 text-blue-support"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-navy-dark">
                    Red Operativa (Cliente WiFi)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      SSID Corporativo
                    </label>
                    <input
                      type="text"
                      value={netConfig.ssid}
                      onChange={(e) =>
                        setNetConfig({ ...netConfig, ssid: e.target.value })
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Contraseña WPA2/WPA3
                    </label>
                    <input
                      type="password"
                      placeholder="•••••••• (Dejar en blanco para mantener actual)"
                      value={netConfig.pass}
                      onChange={(e) =>
                        setNetConfig({ ...netConfig, pass: e.target.value })
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none"
                    />
                  </div>

                  {/* Selector DHCP vs Estática */}
                  <div className="md:col-span-2 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={netConfig.dhcp}
                        onChange={(e) =>
                          setNetConfig({ ...netConfig, dhcp: e.target.checked })
                        }
                        className="w-4 h-4 text-orange-accent rounded focus:ring-orange-accent"
                      />
                      <span className="text-sm font-semibold text-gray-700">
                        Usar Asignación Dinámica (DHCP)
                      </span>
                    </label>
                  </div>

                  {/* CAMPOS DE IP ESTÁTICA CONDICIONALES */}
                  {!netConfig.dhcp && (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-5 bg-white border border-gray-200 rounded shadow-inner animate-fade-in">
                      <div className="md:col-span-2 border-b border-gray-100 pb-2 mb-2">
                        <h5 className="text-sm font-bold text-navy-dark">
                          Parámetros TCP/IP Manuales
                        </h5>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                          Dirección IP Estática
                        </label>
                        <input
                          type="text"
                          placeholder="192.168.1.200"
                          value={netConfig.ip}
                          onChange={(e) =>
                            setNetConfig({ ...netConfig, ip: e.target.value })
                          }
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none font-mono text-sm bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                          Máscara de Subred
                        </label>
                        <input
                          type="text"
                          placeholder="255.255.255.0"
                          value={netConfig.subnet}
                          onChange={(e) =>
                            setNetConfig({
                              ...netConfig,
                              subnet: e.target.value,
                            })
                          }
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none font-mono text-sm bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                          Puerta de Enlace (Gateway)
                        </label>
                        <input
                          type="text"
                          placeholder="192.168.1.1"
                          value={netConfig.gateway}
                          onChange={(e) =>
                            setNetConfig({
                              ...netConfig,
                              gateway: e.target.value,
                            })
                          }
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none font-mono text-sm bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                          Servidor DNS Principal
                        </label>
                        <input
                          type="text"
                          placeholder="8.8.8.8"
                          value={netConfig.dns}
                          onChange={(e) =>
                            setNetConfig({ ...netConfig, dns: e.target.value })
                          }
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none font-mono text-sm bg-gray-50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* 2. RED DE RESCATE (SoftAP) */}
              <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                  <svg
                    className="w-5 h-5 text-orange-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-navy-dark">
                    Red de Rescate (Access Point Zero-Trust)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      SSID de Rescate
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. EdgeNode_Admin"
                      value={netConfig.ap_ssid}
                      onChange={(e) =>
                        setNetConfig({ ...netConfig, ap_ssid: e.target.value })
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Dejar en blanco para usar nombre por defecto (MAC).
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Contraseña de Rescate
                    </label>
                    <input
                      type="password"
                      placeholder="•••••••• (En blanco = Default)"
                      value={netConfig.ap_pass}
                      onChange={(e) =>
                        setNetConfig({ ...netConfig, ap_pass: e.target.value })
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-6 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={netConfig.ap_hide}
                        onChange={(e) =>
                          setNetConfig({
                            ...netConfig,
                            ap_hide: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-orange-accent rounded"
                      />
                      <span className="text-sm font-semibold text-gray-700">
                        Ocultar SSID (Hidden Network)
                      </span>
                    </label>
                  </div>
                </div>
              </section>

              {/* 3. SERVICIOS AVANZADOS */}
              <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                  <svg
                    className="w-5 h-5 text-navy-dark"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-navy-dark">
                    Servicios de Red (mDNS & Tiempo Real NTP)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Hostname (mDNS)
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        value={netConfig.mdns}
                        onChange={(e) =>
                          setNetConfig({ ...netConfig, mdns: e.target.value })
                        }
                        className="w-full p-2 border border-gray-300 rounded-l focus:ring-2 focus:ring-orange-accent focus:outline-none"
                      />
                      <span className="bg-gray-200 border border-l-0 border-gray-300 text-gray-500 p-2 rounded-r">
                        .local
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Servidor NTP
                    </label>
                    <input
                      type="text"
                      value={netConfig.ntp}
                      onChange={(e) =>
                        setNetConfig({ ...netConfig, ntp: e.target.value })
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Zona Horaria (POSIX)
                    </label>
                    <select
                      value={netConfig.tz}
                      onChange={(e) =>
                        setNetConfig({ ...netConfig, tz: e.target.value })
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none bg-white"
                    >
                      <option value="CST6CDT,M4.1.0,M10.5.0">
                        Hora Centro (México)
                      </option>
                      <option value="EST5EDT,M3.2.0,M11.1.0">
                        Hora del Este (US)
                      </option>
                      <option value="PST8PDT,M3.2.0,M11.1.0">
                        Hora del Pacífico (US)
                      </option>
                      <option value="CET-1CEST,M3.5.0,M10.5.0/3">
                        Europa Central (CET)
                      </option>
                      <option value="UTC0">UTC Universal</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* CONTROLES DE ACCIÓN */}
              <div className="flex justify-end gap-4 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-accent text-navy-dark rounded font-bold hover:bg-[#E08D55] shadow transition-all"
                >
                  Guardar y Aplicar Red
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'seguridad' && userRole === 'admin' && (
          <div className="max-w-4xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-navy-dark">
                Gestión de Accesos y Criptografía
              </h3>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  ></path>
                </svg>
                Postura de Seguridad: Alta
              </span>
            </div>

            <form className="space-y-8" onSubmit={handleSaveSecurity}>
              {/* 1. CONTROL DE ACCESO (IAM) */}
              <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                  <svg
                    className="w-5 h-5 text-teal-support"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-navy-dark">
                    Credenciales de Administrador Root
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Contraseña Actual (Requerida)
                    </label>
                    <input
                      type="password"
                      value={secConfig.current_pass}
                      onChange={(e) =>
                        setSecConfig({
                          ...secConfig,
                          current_pass: e.target.value,
                        })
                      }
                      placeholder="Ingrese su contraseña actual para validar cambios"
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-support focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      value={secConfig.new_pass}
                      onChange={(e) =>
                        setSecConfig({ ...secConfig, new_pass: e.target.value })
                      }
                      placeholder="Mínimo 8 caracteres"
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-support focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Confirmar Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      value={secConfig.confirm_pass}
                      onChange={(e) =>
                        setSecConfig({
                          ...secConfig,
                          confirm_pass: e.target.value,
                        })
                      }
                      placeholder="Repita la nueva contraseña"
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-support focus:outline-none"
                    />
                  </div>
                </div>
              </section>

              {/* 2. MOTOR CRIPTOGRÁFICO Y SESIONES */}
              <section className="bg-gray-50 p-6 rounded-lg border border-gray-200 border-l-4 border-l-yellow-support">
                <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-yellow-support"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                      ></path>
                    </svg>
                    <h4 className="text-lg font-bold text-navy-dark">
                      Gestión de Sesiones (JWT)
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Tiempo de Expiración de Sesión
                    </label>
                    <select
                      value={secConfig.jwt_exp}
                      onChange={(e) =>
                        setSecConfig({ ...secConfig, jwt_exp: e.target.value })
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-yellow-support focus:outline-none bg-white"
                    >
                      <option value="15">15 Minutos (Recomendado)</option>
                      <option value="60">1 Hora</option>
                      <option value="1440">24 Horas</option>
                    </select>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleRotateKey}
                      className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded font-bold hover:bg-red-100 transition-colors flex justify-center items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        ></path>
                      </svg>
                      Rotar Llave Secreta (Forzar Logout Global)
                    </button>
                  </div>
                  <p className="md:col-span-2 text-xs text-gray-500 mt-1">
                    Rotar la llave invalida inmediatamente todos los tokens
                    emitidos. Todos los usuarios activos (incluyéndote) serán
                    desconectados.
                  </p>
                </div>
              </section>

              {/* 3. FIREWALL PERIMETRAL */}
              <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                  <svg
                    className="w-5 h-5 text-navy-dark"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-navy-dark">
                    Firewall y Filtrado de APIs
                  </h4>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={secConfig.allowlist_enabled}
                      onChange={(e) =>
                        setSecConfig({
                          ...secConfig,
                          allowlist_enabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-orange-accent rounded focus:ring-orange-accent"
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      Habilitar Lista Blanca de IPs (Allowlist)
                    </span>
                  </label>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Direcciones IP Permitidas (Separadas por salto de línea)
                    </label>
                    <textarea
                      rows={3}
                      value={secConfig.allowlist}
                      onChange={(e) =>
                        setSecConfig({
                          ...secConfig,
                          allowlist: e.target.value,
                        })
                      }
                      placeholder="Ejemplo:&#10;192.168.1.50&#10;192.168.1.105"
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-navy-dark focus:outline-none font-mono text-sm bg-white"
                    ></textarea>
                    <p className="text-xs text-red-500 mt-1 font-semibold">
                      ⚠️ ¡Precaución! Asegúrese de incluir su IP actual o
                      perderá acceso al nodo instantáneamente al guardar.
                    </p>
                  </div>
                </div>
              </section>

              {/* CONTROLES DE ACCIÓN */}
              <div className="flex justify-end gap-4 pt-2">
                <button
                  type="button"
                  className="px-6 py-2 border border-gray-300 text-gray-600 rounded font-semibold hover:bg-gray-100 transition-colors"
                >
                  Descartar Cambios
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-navy-dark text-white rounded font-bold hover:bg-gray-800 shadow transition-all"
                >
                  Guardar Políticas de Seguridad
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "usuarios" && userRole === 'admin' && (
          <div className="max-w-4xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-navy-dark">
                Control de Acceso Basado en Roles (RBAC)
              </h3>
              <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                </svg>
                Multi-Tenant Activo
              </span>
            </div>

            <div className="space-y-8">
              {/* 1. LISTA DE USUARIOS ACTUALES */}
              <section className="bg-white p-0 rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-navy-dark"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      ></path>
                    </svg>
                    <h4 className="text-lg font-bold text-navy-dark">
                      Directorio de Usuarios
                    </h4>
                  </div>
                  <span className="text-xs text-gray-500 font-semibold">
                    Max. 5 Usuarios Adicionales
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                        <th className="px-6 py-3 font-semibold">Usuario</th>
                        <th className="px-6 py-3 font-semibold">
                          Rol Asignado
                        </th>
                        <th className="px-6 py-3 font-semibold">
                          Último Acceso
                        </th>
                        <th className="px-6 py-3 font-semibold text-right">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {usersList.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-8 text-center text-sm text-gray-500 font-semibold animate-pulse"
                          >
                            Conectando con motor IAM... Descargando identidades.
                          </td>
                        </tr>
                      ) : (
                        usersList.map((user, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4 font-bold text-navy-dark">
                              {user.username}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`border text-xs px-2 py-1 rounded font-bold ${
                                  user.role === "admin"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : user.role === "operator"
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-gray-50 text-gray-700 border-gray-200"
                                }`}
                              >
                                {user.role === "admin"
                                  ? "Root"
                                  : user.role === "operator"
                                    ? "Operador"
                                    : "Visor"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {user.last_login || "Desconocido"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                className={`transition-colors ${user.role === "admin" ? "text-gray-400 cursor-not-allowed" : "text-red-500 hover:text-red-700"}`}
                                title={
                                  user.role === "admin"
                                    ? "El usuario Root no puede ser eliminado"
                                    : "Revocar Acceso"
                                }
                                disabled={user.role === "admin"}
                                onClick={async () => {
                                  if (
                                    user.role !== "admin" &&
                                    window.confirm(
                                      `¿Seguro que desea revocar el acceso al usuario ${user.username}?`,
                                    )
                                  ) {
                                    try {
                                      const baseUrl =
                                        import.meta.env.VITE_EDGE_API_URL ||
                                        (import.meta.env.DEV
                                          ? "http://192.168.1.171"
                                          : "");
                                      // El ID viaja en la URL
                                      const res = await apiFetch(
                                        `${baseUrl}/api/users?id=${user.id}`,
                                        {
                                          method: "DELETE",
                                          headers: {
                                            Authorization: `Bearer ${authToken}`,
                                          },
                                        },
                                      );
                                      if (res.ok) {
                                        setUsersList((prev) =>
                                          prev.filter((u) => u.id !== user.id),
                                        );
                                        toast.success("Usuario eliminado.");
                                      } else {
                                        const data = await res.json();
                                        toast.error(`Error: ${data.error}`);
                                      }
                                    } catch (err) {
                                      toast.error("Fallo de conexión de red.");
                                    }
                                  }
                                }}
                              >
                                <svg
                                  className="w-5 h-5 inline"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  ></path>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 2. CREACIÓN DE NUEVO USUARIO */}
              <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                  <svg
                    className="w-5 h-5 text-orange-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-navy-dark">
                    Aprovisionar Nueva Identidad
                  </h4>
                </div>

                <form
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                  onSubmit={handleAddUser}
                >
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Nombre de Usuario
                    </label>
                    <input
                      type="text"
                      value={newUser.username}
                      onChange={(e) =>
                        setNewUser({ ...newUser, username: e.target.value })
                      }
                      placeholder="Ej. analista_datos"
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Contraseña Inicial
                    </label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      placeholder="Mínimo 8 caracteres"
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Nivel de Privilegio
                    </label>
                    <select
                      value={newUser.role}
                      onChange={(e) =>
                        setNewUser({ ...newUser, role: e.target.value })
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-accent focus:outline-none bg-white"
                    >
                      <option value="viewer">Visor (Solo Lectura)</option>
                      <option value="operator">
                        Operador (Acceso Limitado)
                      </option>
                      <option value="admin">
                        Administrador (Acceso Total)
                      </option>
                    </select>
                  </div>
                  <div className="md:col-span-3 flex justify-end mt-2">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-navy-dark text-white rounded font-bold hover:bg-gray-800 shadow transition-all flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        ></path>
                      </svg>
                      Registrar Usuario en NVS
                    </button>
                  </div>
                </form>
              </section>

              {/* 3. MATRIZ DE PERMISOS (RBAC Info) */}
              <section className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                <h4 className="text-sm font-bold text-blue-900 mb-3 uppercase tracking-wider">
                  Matriz de Permisos del Sistema
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white p-3 rounded shadow-sm border border-blue-50">
                    <p className="font-bold text-red-700 mb-1">Root / Admin</p>
                    <ul className="text-gray-600 space-y-1 list-disc list-inside">
                      <li>Gestión de Red y WiFi</li>
                      <li>Rotación de llaves JWT</li>
                      <li>Gestión de usuarios</li>
                      <li>Formateo de Base de Datos</li>
                    </ul>
                  </div>
                  <div className="bg-white p-3 rounded shadow-sm border border-blue-50">
                    <p className="font-bold text-blue-700 mb-1">Operador</p>
                    <ul className="text-gray-600 space-y-1 list-disc list-inside">
                      <li>Descarga de Dataset (CSV)</li>
                      <li>Calibración de Sensores</li>
                      <li>Visualización de Dashboard</li>
                    </ul>
                  </div>
                  <div className="bg-white p-3 rounded shadow-sm border border-blue-50">
                    <p className="font-bold text-gray-700 mb-1">Visor</p>
                    <ul className="text-gray-600 space-y-1 list-disc list-inside">
                      <li>Visualización de Dashboard en tiempo real</li>
                      <li>Estado de recursos (SRAM/Uptime)</li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'sensores' && (userRole === 'admin' || userRole === 'operator') && (
          <div className="max-w-4xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-navy-dark">
                Calibración de Hardware y Telemetría
              </h3>
              <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                    clipRule="evenodd"
                  ></path>
                </svg>
                DSP: Activo
              </span>
            </div>

            <form className="space-y-8" onSubmit={handleSaveSensors}>
              {/* 1. SENSOR AMBIENTAL (DHT) */}
              <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                  <svg
                    className="w-5 h-5 text-blue-support"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-navy-dark">
                    Configuración de Hardware Dinámico
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Muestreo (Polling Rate)
                    </label>
                    <div className="flex">
                      <input
                        type="number"
                        min="2000"
                        step="500"
                        value={sensorConfig.polling_rate}
                        onChange={(e) =>
                          setSensorConfig({
                            ...sensorConfig,
                            polling_rate: parseInt(e.target.value) || 2000,
                          })
                        }
                        className="w-full p-2 border border-gray-300 rounded-l focus:ring-2 focus:ring-blue-support focus:outline-none font-mono"
                      />
                      <span className="bg-gray-100 border border-l-0 border-gray-300 text-gray-500 font-bold p-2 rounded-r flex items-center text-xs">
                        ms
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 font-bold">
                      Mínimo seguro: 2000 ms.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Modelo de Sensor
                    </label>
                    <select
                      value={sensorConfig.dht_type}
                      onChange={(e) =>
                        setSensorConfig({
                          ...sensorConfig,
                          dht_type: parseInt(e.target.value),
                        })
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-support focus:outline-none bg-white"
                    >
                      <option value="11">DHT11</option>
                      <option value="21">DHT21</option>
                      <option value="22">DHT22</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Pin DHT (GPIO)
                    </label>
                    <input
                      type="number"
                      value={sensorConfig.dht_pin}
                      onChange={(e) =>
                        setSensorConfig({
                          ...sensorConfig,
                          dht_pin: parseInt(e.target.value),
                        })
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-support focus:outline-none font-mono"
                    />
                  </div>

                  {/* Calibración y ADC */}
                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 p-4 bg-white border border-gray-200 rounded">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">
                        Pin ADC Batería
                      </label>
                      <input
                        type="number"
                        value={sensorConfig.adc_pin}
                        onChange={(e) =>
                          setSensorConfig({
                            ...sensorConfig,
                            adc_pin: parseInt(e.target.value),
                          })
                        }
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-support focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">
                        Resistencia R1 (Ohms)
                      </label>
                      <input
                        type="number"
                        value={sensorConfig.r1}
                        onChange={(e) =>
                          setSensorConfig({
                            ...sensorConfig,
                            r1: parseFloat(e.target.value),
                          })
                        }
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-support focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">
                        Resistencia R2 (Ohms)
                      </label>
                      <input
                        type="number"
                        value={sensorConfig.r2}
                        onChange={(e) =>
                          setSensorConfig({
                            ...sensorConfig,
                            r2: parseFloat(e.target.value),
                          })
                        }
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-support focus:outline-none font-mono"
                      />
                    </div>
                    <div className="md:col-span-3 mt-2 border-t pt-4">
                      <label className="block text-sm font-semibold text-gray-600 mb-1">
                        Calibración Offset: Temperatura (°C)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={sensorConfig.temp_offset}
                        onChange={(e) =>
                          setSensorConfig({
                            ...sensorConfig,
                            temp_offset: parseFloat(e.target.value),
                          })
                        }
                        className="w-full md:w-1/3 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-support focus:outline-none font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1 mb-4">
                        Compensación por calor emitido por la placa ESP32.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">ADC Offset (V)</label>
                          <input type="number" step="0.01" value={sensorConfig.adc_offset || 0.0} onChange={(e) => setSensorConfig({ ...sensorConfig, adc_offset: parseFloat(e.target.value) })} className="w-full p-2 border rounded font-mono text-sm" />
                          <p className="text-xs text-gray-500">Ajuste fino de voltaje.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">ADC Multiplicador</label>
                          <input type="number" step="0.01" value={sensorConfig.adc_mult || 1.0} onChange={(e) => setSensorConfig({ ...sensorConfig, adc_mult: parseFloat(e.target.value) })} className="w-full p-2 border rounded font-mono text-sm" />
                          <p className="text-xs text-gray-500">Factor de corrección.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t mt-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Sleep Mode (Optimización Batería)</label>
                          <select value={sensorConfig.sleep_mode || 0} onChange={(e) => setSensorConfig({ ...sensorConfig, sleep_mode: parseInt(e.target.value) })} className="w-full p-2 border rounded font-mono text-sm">
                            <option value={0}>Siempre Encendido</option>
                            <option value={1}>Deep Sleep</option>
                          </select>
                          <p className="text-[10px] text-red-500 font-bold mt-1">Deep Sleep apaga el Servidor Web y REST API.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">Intervalo Deep Sleep (s)</label>
                          <input type="number" value={sensorConfig.sleep_time || 60} onChange={(e) => setSensorConfig({ ...sensorConfig, sleep_time: parseInt(e.target.value) })} className="w-full p-2 border rounded font-mono text-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* CONTROLES DE ACCIÓN */}
              <div className="flex justify-end gap-4 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-navy-dark text-white rounded font-bold hover:bg-gray-800 shadow transition-all"
                >
                  Guardar y Reiniciar Hardware
                </button>
              </div>
            </form>
          </div>
        )}

        {/* --- PESTAÑA: API KEYS & DOCUMENTACIÓN --- */}
        {activeTab === 'api' && userRole === 'admin' && (
          <div className="max-w-5xl animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-navy-dark">
                  Integración y API RESTful
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Gestión de Service Accounts y Documentación de Endpoints
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1 shadow-sm">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"></path>
                  </svg>
                  API v1.1 Operativa
                </span>
                <div className={`flex items-center gap-2 text-xs font-bold uppercase ${sysTime.getFullYear() > 2000 ? "text-teal-600" : "text-red-500 animate-pulse"}`}>
                  <div className={`w-2 h-2 rounded-full ${sysTime.getFullYear() > 2000 ? "bg-teal-600" : "bg-red-500"}`}></div>
                  {sysTime.getFullYear() > 2000 ? "NTP Sync: OK" : "NTP Sync: Pendiente"}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* 1. GESTIÓN DE TOKENS DE SERVICIO (API KEYS) */}
              <section className="bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                  </svg>
                  <h4 className="text-lg font-bold text-navy-dark">
                    Tokens de Servicio M2M (Machine-to-Machine)
                  </h4>
                </div>

                <p className="text-sm text-gray-600 mb-6">
                  Genere tokens estáticos de larga duración para integraciones automatizadas como Dashboards (Grafana), flujos de Node-RED o scripts de Python.
                </p>

                <div className="bg-white p-4 rounded border border-gray-200 flex flex-col md:flex-row gap-4 items-end mb-6 shadow-sm">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre de la Integración</label>
                    <input type="text" placeholder="Ej. Extractor Python Nocturno" value={newApiKey.name} onChange={(e) => setNewApiKey({ ...newApiKey, name: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" />
                  </div>
                  <div className="w-full md:w-48">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Vigencia</label>
                    <select value={newApiKey.expiration} onChange={(e) => setNewApiKey({ ...newApiKey, expiration: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-sm">
                      <option value="30">30 Días</option>
                      <option value="180">6 Meses</option>
                      <option value="never">Nunca (Peligroso)</option>
                    </select>
                  </div>
                  <button onClick={handleGenerateApiKey} className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 transition-colors shadow flex items-center justify-center gap-2 whitespace-nowrap h-[42px]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    Generar Token
                  </button>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-100 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Integración</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Prefijo (Token)</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Fecha de Expiración</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {apiKeysList.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500 italic">No hay API Keys activas. Genera una integración arriba.</td></tr>
                      ) : (
                        apiKeysList.map((key, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/50 transition-colors">
                            <td className="px-4 py-3 font-bold text-navy-dark">{key.name}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500"><span className="bg-gray-50 rounded border border-gray-100 px-2 py-1">{key.prefix}••••••••••</span></td>
                            <td className="px-4 py-3 text-gray-600">{key.expiration_date}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => handleRevokeApiKey(key.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-colors" title="Revocar Token">
                                <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 2. CATÁLOGO DE ENDPOINTS CATEGORIZADO */}
              <section className="bg-white p-4 md:p-6 rounded-lg border border-gray-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-gray-200 pb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <h4 className="text-lg font-bold text-navy-dark">Referencia de Endpoints RESTful</h4>
                  </div>
                  <div className="bg-yellow-50 text-yellow-800 border border-yellow-200 p-2 rounded text-xs overflow-x-auto">
                    <span className="font-bold">Auth Header:</span> <code className="bg-white px-1 rounded whitespace-nowrap">Authorization: Bearer &lt;TOKEN&gt;</code>
                  </div>
                </div>

                <div className="space-y-8">
                  {[
                    {
                      category: "Extracción de Datos & Telemetría",
                      icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                      endpoints: [
                        { method: "GET", path: "/api/dataset", roles: ["Admin", "Operador", "API Key"], desc: "Descarga del log histórico completo en formato CSV (Raw Data).", payload: null },
                        { method: "WS", path: "/ws", roles: ["Admin", "Operador", "Visor"], desc: "Stream bidireccional. Retorna telemetría (JSON) y estado del nodo.", payload: '{"type": "auth", "token": "<JWT>"}' },
                      ],
                    },
                    {
                      category: "Autenticación e Identidades (IAM)",
                      icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
                      endpoints: [
                        { method: "POST", path: "/api/login", roles: ["Público"], desc: "Intercambia credenciales por un JWT de sesión (Expiración variable).", payload: '{"username": "str", "password": "str"}' },
                        { method: "GET/POST/DEL", path: "/api/users", roles: ["Admin"], desc: "CRUD del Directorio Activo (RBAC). Límite de 5 usuarios secundarios.", payload: '{"username": "str", "password": "str", "role": "admin|operator|viewer"}' },
                        { method: "GET/POST/DEL", path: "/api/keys", roles: ["Admin"], desc: "Gestión de Tokens M2M (Service Accounts). Límite de 5 llaves activas.", payload: '{"name": "str", "expiration": "30|180|never"}' },
                      ],
                    },
                    {
                      category: "Configuración del Hardware (State)",
                      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
                      endpoints: [
                        { method: "GET/POST", path: "/api/config/network", roles: ["Admin"], desc: "Parámetros TCP/IP, Red STA de Producción, Red AP de Rescate y servidor NTP.", payload: '{"ssid": "str", "dhcp": bool, "ip": "str", ...}' },
                        { method: "GET/POST", path: "/api/config/security", roles: ["Admin"], desc: "Configuración del Firewall L3 (Allowlist IP) y TTL de sesiones JWT.", payload: '{"allowlist_enabled": bool, "allowlist": "ip1\\nip2"}' },
                        { method: "GET/POST", path: "/api/config/sensors", roles: ["Admin", "Operador"], desc: "Pines GPIO, atenuación del ADC, impedancias del divisor y offsets de calibración.", payload: '{"dht_pin": int, "adc_pin": int, "temp_offset": float}' },
                        { method: "GET/POST", path: "/api/config/smtp", roles: ["Admin"], desc: "Credenciales del servidor de correos y envolvente operacional (Umbrales de alarma).", payload: '{"host": "str", "t_max": float, "alert_temp": bool}' },
                        /* ⚠️ NUEVOS ENDPOINTS AÑADIDOS AQUÍ ⚠️ */
                        { method: "GET/POST", path: "/api/config/whatsapp", roles: ["Admin"], desc: "Credenciales de la API CallMeBot para notificaciones instantáneas de WhatsApp.", payload: '{"enabled": bool, "phone": "str", "api_key": "str"}' },
                        { method: "GET/POST", path: "/api/config/cloud", roles: ["Admin"], desc: "Sincronización M2M: Webhook HTTPS para inyectar telemetría directa a Bases de Datos en la nube.", payload: '{"enabled": bool, "url": "str", "token": "str"}' },
                      ],
                    },
                    {
                      category: "Mantenimiento y Ciclo de Vida (SysOps)",
                      icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
                      endpoints: [
                        { method: "GET", path: "/api/system/info", roles: ["Admin", "Operador", "Visor"], desc: "Retorna versión de Firmware, modelo del Chip, Cores, e información del TinyML.", payload: null },
                        { method: "GET", path: "/api/system/storage", roles: ["Admin"], desc: "Estadísticas de ocupación de las particiones NVS (Base de Datos) y LittleFS.", payload: null },
                        { method: "POST", path: "/api/system/ota", roles: ["Admin"], desc: "Over-The-Air Update. Inyecta binarios directamente en particiones OTA_0 u OTA_1.", payload: 'FormData { "firmware": File (.bin/.tflite) }' },
                        { method: "POST", path: "/api/system/reboot", roles: ["Admin"], desc: "Ejecuta un reinicio seguro (Soft-Reset) a nivel microcontrolador.", payload: "Ninguno" },
                        { method: "POST", path: "/api/system/format_logs", roles: ["Admin"], desc: "Purga destructiva: Elimina el dataset.csv de LittleFS permanentemente.", payload: "Ninguno" },
                        { method: "POST", path: "/api/system/factory_reset", roles: ["Admin"], desc: "Borrado Criptográfico: Destruye la NVS completa. Fuerza modo OOBE.", payload: "Ninguno" },
                        { method: "GET", path: "/api/health", roles: ["Público"], desc: "Healthcheck rápido. Retorna Uptime, Heap y calidad WiFi.", payload: "Ninguno" },
                        { method: "GET", path: "/api/system/battery", roles: ["API Key", "Admin", "Operador"], desc: "Retorna voltaje, porcentaje y estado de carga (TP4056).", payload: "Ninguno" },
                      ],
                    },
                  ].map((group, gIdx) => (
                    <div key={gIdx} className="mb-6">
                      <h5 className="flex items-center gap-2 font-bold text-navy-dark mb-3 border-b border-gray-100 pb-2">
                        <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={group.icon}></path></svg>
                        {group.category}
                      </h5>
                      <div className="space-y-3">
                        {group.endpoints.map((ep, eIdx) => (
                          <div key={eIdx} className="group flex flex-col lg:flex-row gap-4 items-start lg:items-center p-4 bg-gray-50 hover:bg-white rounded-lg border border-gray-200 shadow-sm transition-all hover:shadow-md">
                            {/* Método y Ruta */}
                            <div className="flex items-center gap-3 w-full lg:w-64 shrink-0">
                              <span className={`font-bold px-2 py-1 rounded text-[10px] w-16 text-center tracking-widest shrink-0 ${
                                  ep.method.includes("GET") ? "bg-blue-100 text-blue-800" : 
                                  ep.method.includes("POST") ? "bg-green-100 text-green-800" : 
                                  ep.method.includes("DEL") ? "bg-red-100 text-red-800" : 
                                  ep.method.includes("WS") ? "bg-purple-100 text-purple-800" : "bg-gray-200 text-gray-800"
                                }`}>
                                {ep.method}
                              </span>
                              <span className="font-mono text-sm text-navy-dark font-bold truncate cursor-pointer hover:text-orange-accent" title="Click para copiar" onClick={() => { navigator.clipboard.writeText(ep.path); toast.success(`Ruta ${ep.path} copiada`); }}>
                                {ep.path}
                              </span>
                            </div>

                            {/* Descripción y Payload */}
                            <div className="flex-1 flex flex-col gap-1 w-full min-w-0">
                              <span className="text-sm text-gray-700 leading-tight">
                                {ep.desc}
                              </span>
                              {ep.payload && (
                                <div className="mt-1 flex items-start gap-1">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 shrink-0">Payload:</span>
                                  <code className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 font-mono break-all">
                                    {ep.payload}
                                  </code>
                                </div>
                              )}
                            </div>

                            {/* Roles */}
                            <div className="shrink-0 flex flex-wrap gap-1 lg:w-48 lg:justify-end">
                              {ep.roles.map((role, rIdx) => (
                                <span key={rIdx} className={`text-[10px] font-bold px-2 py-1 rounded border whitespace-nowrap ${
                                    role === "Admin" ? "bg-red-50 text-red-700 border-red-100" : 
                                    role === "Operador" ? "bg-blue-50 text-blue-700 border-blue-100" : 
                                    role === "Público" ? "bg-gray-100 text-gray-500 border-gray-200" : 
                                    role === "API Key" ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-gray-50 text-gray-700 border-gray-200"
                                  }`}>
                                  {role}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. EJEMPLO DE INTEGRACIÓN (cURL) */}
              <section className="bg-navy-dark p-4 md:p-6 rounded-lg shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
                  <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-gray-700 pb-3 gap-3 relative z-10">
                  <h4 className="text-lg font-bold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-orange-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    Snippet: Extracción de CSV con cURL (M2M)
                  </h4>
                  <button onClick={() => { navigator.clipboard.writeText(`curl -X GET http://${import.meta.env.DEV ? "192.168.1.171" : window.location.hostname}/api/dataset -H 'Authorization: Bearer TU_TOKEN_M2M' --output dataset_$(date +%s).csv`); toast.success("Comando copiado al portapapeles"); }} className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-xs font-bold transition-colors shadow self-start sm:self-auto">
                    Copiar Código
                  </button>
                </div>

                <div className="bg-[#0D0D14] p-4 md:p-5 rounded-lg font-mono text-sm overflow-x-auto custom-scrollbar shadow-inner relative z-10 border border-gray-800">
                  <p className="text-gray-300 whitespace-nowrap"><span className="text-pink-500 font-bold">curl</span> <span className="text-blue-400">-X</span> GET \</p>
                  <p className="pl-4 text-green-300 whitespace-nowrap">http://{import.meta.env.DEV ? "192.168.1.171" : window.location.hostname}/api/dataset \</p>
                  <p className="pl-4 text-gray-300 whitespace-nowrap"><span className="text-blue-400">-H</span> <span className="text-yellow-300">'Authorization: Bearer <span className="text-white font-bold bg-white/10 px-1 rounded">TU_TOKEN_M2M_AQUI</span>'</span> \</p>
                  <p className="pl-4 text-gray-300 whitespace-nowrap"><span className="text-blue-400">--output</span> dataset_$(date +%s).csv</p>
                </div>
                <p className="text-xs text-gray-400 mt-4 font-sans relative z-10 border-l-2 border-orange-accent pl-3">
                  Implemente este comando en un <code className="text-gray-300 bg-gray-800 px-1 rounded">CronJob</code> de Linux o un script de Python (con la librería <code className="text-gray-300 bg-gray-800 px-1 rounded">requests</code>) para orquestar la ingesta automatizada de datos (ETL) hacia su Data Lake.
                </p>
              </section>
            </div>
          </div>
        )}

        {activeTab === "datos" && (userRole === 'admin' || userRole === 'operator') && (
          <div className="max-w-4xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-navy-dark">
                Gestión de Almacenamiento No Volátil
              </h3>
              <span className="bg-green-50 text-green-700 border border-green-200 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z"
                    clipRule="evenodd"
                  ></path>
                </svg>
                LittleFS Montado
              </span>
            </div>

            <div className="space-y-8">
              {/* 1. MONITOR DE ALMACENAMIENTO (Particiones) */}
              <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                  <svg
                    className="w-5 h-5 text-teal-support"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-navy-dark">
                    Estado de la Memoria Flash (ESP32-S3)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* LittleFS Bar */}
                  <div>
                    <div className="flex justify-between text-sm font-semibold text-gray-600 mb-2">
                      <span>Partición: spiffs / LittleFS</span>
                      <span>
                        {(storageMetrics.fs_used / (1024 * 1024)).toFixed(2)} MB
                        / {(storageMetrics.fs_total / (1024 * 1024)).toFixed(2)}{" "}
                        MB (
                        {storageMetrics.fs_total > 0
                          ? Math.round(
                              (storageMetrics.fs_used /
                                storageMetrics.fs_total) *
                                100,
                            )
                          : 0}
                        %)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-teal-support h-3 rounded-full transition-all duration-1000"
                        style={{
                          width: `${storageMetrics.fs_total > 0 ? (storageMetrics.fs_used / storageMetrics.fs_total) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Aloja el binario de esta SPA React, assets y los logs de
                      telemetría (CSV).
                    </p>
                  </div>

                  {/* NVS Bar */}
                  <div>
                    <div className="flex justify-between text-sm font-semibold text-gray-600 mb-2">
                      <span>Partición: nvs (Key-Value)</span>
                      <span>
                        {storageMetrics.nvs_used} / {storageMetrics.nvs_total}{" "}
                        Entradas (
                        {storageMetrics.nvs_total > 0
                          ? Math.round(
                              (storageMetrics.nvs_used /
                                storageMetrics.nvs_total) *
                                100,
                            )
                          : 0}
                        %)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-support h-3 rounded-full transition-all duration-1000"
                        style={{
                          width: `${storageMetrics.nvs_total > 0 ? (storageMetrics.nvs_used / storageMetrics.nvs_total) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Aloja configuración WiFi, políticas IAM y secretos
                      criptográficos JWT.
                    </p>
                  </div>
                </div>
              </section>

              {/* 2. EXTRACCIÓN DE DATOS (TinyML Tubería) */}
              <section className="bg-white p-6 rounded-lg border-2 border-dashed border-gray-300">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-navy-dark flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-orange-accent"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        ></path>
                      </svg>
                      Dataset de Entrenamiento (TinyML)
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Archivo:{" "}
                      <span className="font-mono text-navy-dark font-bold">
                        dataset.csv
                      </span>{" "}
                      • Tamaño: {(storageMetrics.fs_used / 1024).toFixed(1)} KB
                    </p>
                  </div>

                  <button
                    onClick={downloadDataset}
                    className="flex items-center gap-2 px-6 py-3 bg-navy-dark text-white rounded font-bold hover:bg-gray-800 shadow-lg transition-transform active:scale-95 whitespace-nowrap"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      ></path>
                    </svg>
                    Extraer Dataset
                  </button>
                </div>
              </section>

              {/* 3. ZONA DE PELIGRO (Acciones Destructivas) */}
              <section className="bg-red-50 p-6 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-4 border-b border-red-200 pb-2">
                  <svg
                    className="w-5 h-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-red-800">
                    Zona de Peligro (Acciones Destructivas)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded border border-red-100 flex flex-col justify-between">
                    <div>
                      <h5 className="font-bold text-navy-dark">
                        Purgar Historial de Telemetría
                      </h5>
                      <p className="text-xs text-gray-600 mt-1 mb-4">
                        Elimina permanentemente `dataset.csv` de LittleFS. Útil
                        para iniciar una nueva recolección de datos limpia.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleFormatLogs}
                      className="w-full py-2 bg-white border-2 border-red-500 text-red-600 rounded font-bold hover:bg-red-50 transition-colors"
                    >
                      Formatear Logs
                    </button>
                  </div>

                  <div className="bg-white p-4 rounded border border-red-100 flex flex-col justify-between">
                    <div>
                      <h5 className="font-bold text-navy-dark">
                        Factory Reset (Zero-Trust)
                      </h5>
                      <p className="text-xs text-gray-600 mt-1 mb-4">
                        Borra la partición NVS. Destruye credenciales WiFi,
                        administrador y llaves JWT. El nodo entrará en modo OOBE
                        tras reiniciar.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleFactoryReset}
                      className="w-full py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 shadow transition-colors"
                    >
                      Borrado Criptográfico
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "firmware" && userRole === 'admin' && (
          <div className="max-w-4xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-navy-dark">
                Gestor de Firmware y Ciclo de Vida
              </h3>
              <span className="bg-gray-100 text-gray-700 border border-gray-300 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  ></path>
                </svg>
                Sistema Estable ({sysInfo.fw_version})
              </span>
            </div>

            <div className="space-y-8">
              {/* 1. INFORMACIÓN DEL SISTEMA */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-start gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                      ></path>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Core Hardware
                    </p>
                    <p className="font-bold text-navy-dark">
                      {sysInfo.chip_model} ({sysInfo.cores} Cores)
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-1">
                      ESP-IDF: {sysInfo.sdk_version}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-start gap-3">
                  <div className="p-2 bg-orange-50 text-orange-accent rounded">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      ></path>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      C++ Firmware
                    </p>
                    <p className="font-bold text-navy-dark">
                      {sysInfo.fw_version}
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-1">
                      Build: {sysInfo.build_date}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-start gap-3">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                      ></path>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      TinyML Model
                    </p>
                    <p className="font-bold text-navy-dark text-sm">
                      anomaly_net.tflite
                    </p>
                    <p
                      className={`text-xs font-mono mt-1 font-bold ${sysInfo.ml_status.includes("Activo") ? "text-green-600" : "text-red-500"}`}
                    >
                      Estado: {sysInfo.ml_status}
                    </p>
                  </div>
                </div>
              </section>

              {/* 2. MOTOR DE ACTUALIZACIÓN OTA */}
              <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                  <svg
                    className="w-5 h-5 text-teal-support"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-navy-dark">
                    Actualización Inalámbrica (OTA Update)
                  </h4>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-white hover:bg-gray-50 transition-colors cursor-pointer">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    ></path>
                  </svg>
                  <p className="text-sm font-semibold text-gray-700">
                    Arrastre aquí el archivo .bin del Firmware, LittleFS o
                    .tflite
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Soporta binarios de PlatformIO (firmware.bin, littlefs.bin)
                  </p>
                  <input
                    type="file"
                    accept=".bin,.tflite"
                    className="hidden"
                    id="ota-upload"
                    onChange={handleOtaUpload}
                  />
                  <label
                    htmlFor="ota-upload"
                    className="mt-4 inline-block px-4 py-2 bg-navy-dark text-white rounded font-bold cursor-pointer hover:bg-gray-800 shadow"
                  >
                    Seleccionar Archivo
                  </label>
                </div>
              </section>

              {/* 3. CONTROL DE ENERGÍA */}
              <section className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-navy-dark">
                      Reinicio del Sistema
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Fuerza un reinicio seguro (Soft Reset). Se desconectarán
                      todos los clientes de WebSocket temporalmente.
                    </p>
                  </div>
                  <button
                    onClick={handleSystemReboot}
                    className="px-6 py-2 border border-gray-300 text-navy-dark rounded font-bold hover:bg-gray-100 transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      ></path>
                    </svg>
                    Reiniciar ESP32-S3
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'smtp' && userRole === 'admin' &&(
          <div className="max-w-4xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-navy-dark">
                Motor de Alertas y Notificaciones (SMTP)
              </h3>
              <span
                className={`border text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1 ${smtpConfig.enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${smtpConfig.enabled ? "bg-green-500" : "bg-gray-400"}`}
                ></div>
                {smtpConfig.enabled ? "Servicio Activo" : "Servicio Apagado"}
              </span>
            </div>

            <form className="space-y-8" onSubmit={handleSaveSMTP}>
              {/* 1. CREDENCIALES DE SERVIDOR */}
              <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      ></path>
                    </svg>
                    <h4 className="text-lg font-bold text-navy-dark">
                      Servidor de Salida
                    </h4>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpConfig.enabled}
                      onChange={(e) =>
                        setSmtpConfig({
                          ...smtpConfig,
                          enabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-sm font-bold text-gray-700">
                      Habilitar Alertas Correo
                    </span>
                  </label>
                </div>

                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-100 transition-opacity"
                  style={{
                    opacity: smtpConfig.enabled ? 1 : 0.5,
                    pointerEvents: smtpConfig.enabled ? "auto" : "none",
                  }}
                >
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Servidor Host (Ej. smtp.gmail.com)
                    </label>
                    <input
                      type="text"
                      value={smtpConfig.host}
                      onChange={(e) =>
                        setSmtpConfig({ ...smtpConfig, host: e.target.value })
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Puerto (SSL/TLS)
                    </label>
                    <input
                      type="number"
                      value={smtpConfig.port}
                      onChange={(e) =>
                        setSmtpConfig({
                          ...smtpConfig,
                          port: parseInt(e.target.value),
                        })
                      }
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Correo Remitente (Usuario)
                    </label>
                    <input
                      type="email"
                      value={smtpConfig.user}
                      onChange={(e) =>
                        setSmtpConfig({ ...smtpConfig, user: e.target.value })
                      }
                      placeholder="nodo.iot@gmail.com"
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      App Password (No su contraseña web)
                    </label>
                    <input
                      type="password"
                      value={smtpConfig.pass}
                      onChange={(e) =>
                        setSmtpConfig({ ...smtpConfig, pass: e.target.value })
                      }
                      placeholder="••••••••••••••••"
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Debe usar una contraseña de aplicación generada por
                      Google/Microsoft.
                    </p>
                  </div>
                </div>
              </section>

              {/* 2. REGLAS Y UMBRALES (HIGH/LOW) */}
              <section
                className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm"
                style={{
                  opacity: smtpConfig.enabled ? 1 : 0.5,
                  pointerEvents: smtpConfig.enabled ? "auto" : "none",
                }}
              >
                <h4 className="text-lg font-bold text-navy-dark mb-4 border-b pb-2">
                  Destinatario y Envolvente Operacional
                </h4>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-600 mb-1">
                    Correo del Administrador (Destino de Alertas)
                  </label>
                  <input
                    type="email"
                    value={smtpConfig.dest}
                    onChange={(e) =>
                      setSmtpConfig({ ...smtpConfig, dest: e.target.value })
                    }
                    placeholder="admin@empresa.com"
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Bloque Temperatura */}
                  <div className="bg-orange-50 p-4 rounded border border-orange-100 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-bold text-orange-800">
                          Temperatura (°C)
                        </label>
                        <input
                          type="checkbox"
                          checked={smtpConfig.alert_temp}
                          onChange={(e) =>
                            setSmtpConfig({
                              ...smtpConfig,
                              alert_temp: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-orange-600"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="w-1/2">
                          <p className="text-[10px] text-orange-600 font-bold uppercase">
                            Máximo
                          </p>
                          <input
                            type="number"
                            step="0.1"
                            value={smtpConfig.t_max}
                            onChange={(e) =>
                              setSmtpConfig({
                                ...smtpConfig,
                                t_max: parseFloat(e.target.value),
                              })
                            }
                            className="w-full p-1 border border-orange-200 rounded text-sm"
                          />
                        </div>
                        <div className="w-1/2">
                          <p className="text-[10px] text-orange-600 font-bold uppercase">
                            Mínimo
                          </p>
                          <input
                            type="number"
                            step="0.1"
                            value={smtpConfig.t_min}
                            onChange={(e) =>
                              setSmtpConfig({
                                ...smtpConfig,
                                t_min: parseFloat(e.target.value),
                              })
                            }
                            className="w-full p-1 border border-orange-200 rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloque Humedad */}
                  <div className="bg-blue-50 p-4 rounded border border-blue-100 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-bold text-blue-800">
                          Humedad (%)
                        </label>
                        <input
                          type="checkbox"
                          checked={smtpConfig.alert_hum}
                          onChange={(e) =>
                            setSmtpConfig({
                              ...smtpConfig,
                              alert_hum: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-blue-600"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="w-1/2">
                          <p className="text-[10px] text-blue-600 font-bold uppercase">
                            Alto (Corto)
                          </p>
                          <input
                            type="number"
                            step="0.1"
                            value={smtpConfig.h_max}
                            onChange={(e) =>
                              setSmtpConfig({
                                ...smtpConfig,
                                h_max: parseFloat(e.target.value),
                              })
                            }
                            className="w-full p-1 border border-blue-200 rounded text-sm"
                          />
                        </div>
                        <div className="w-1/2">
                          <p className="text-[10px] text-blue-600 font-bold uppercase">
                            Bajo (Estática)
                          </p>
                          <input
                            type="number"
                            step="0.1"
                            value={smtpConfig.h_min}
                            onChange={(e) =>
                              setSmtpConfig({
                                ...smtpConfig,
                                h_min: parseFloat(e.target.value),
                              })
                            }
                            className="w-full p-1 border border-blue-200 rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloque Energía y Spam */}
                  <div className="bg-gray-50 p-4 rounded border border-gray-200 flex flex-col justify-between">
                    <div className="mb-2">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-bold text-gray-800">
                          Batería Crítica (V)
                        </label>
                        <input
                          type="checkbox"
                          checked={smtpConfig.alert_sec}
                          onChange={(e) =>
                            setSmtpConfig({
                              ...smtpConfig,
                              alert_sec: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-gray-600"
                        />
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={smtpConfig.b_min}
                        onChange={(e) =>
                          setSmtpConfig({
                            ...smtpConfig,
                            b_min: parseFloat(e.target.value),
                          })
                        }
                        className="w-full p-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div className="border-t border-gray-200 pt-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">
                        Rate-Limit (Anti-Spam)
                      </label>
                      <select
                        value={smtpConfig.cooldown}
                        onChange={(e) =>
                          setSmtpConfig({
                            ...smtpConfig,
                            cooldown: parseInt(e.target.value),
                          })
                        }
                        className="w-full p-1 border border-gray-300 rounded bg-white text-sm mt-1"
                      >
                        <option value="15">15 Minutos</option>
                        <option value="60">1 Hora (Recomendado)</option>
                        <option value="720">12 Horas</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* CONTROLES DE ACCIÓN */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={!smtpConfig.enabled}
                  className="px-4 py-2 border-2 border-purple-600 text-purple-600 rounded font-bold hover:bg-purple-50 transition-colors disabled:opacity-50"
                >
                  Enviar Correo de Prueba
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-navy-dark text-white rounded font-bold hover:bg-gray-800 shadow transition-all"
                >
                  Guardar Configuración SMTP
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'whatsapp' && userRole === 'admin' && (
  <div className="max-w-4xl animate-fade-in">
    {/* HEADER CON STATUS BADGE - Igual que SMTP */}
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-xl font-bold text-navy-dark">
        Notificaciones de WhatsApp
      </h3>
      <span
        className={`border text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1 ${waConfig.enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}
      >
        <div
          className={`w-2 h-2 rounded-full ${waConfig.enabled ? "bg-green-500" : "bg-gray-400"}`}
        ></div>
        {waConfig.enabled ? "Servicio Activo" : "Servicio Apagado"}
      </span>
    </div>

    <form className="space-y-8" onSubmit={handleSaveWA}>
      {/* SECCIÓN PRINCIPAL - Mismo estilo que SMTP */}
      <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
          <div className="flex items-center gap-2">
            {/* Ícono de WhatsApp */}
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
            <h4 className="text-lg font-bold text-navy-dark">Configuración de WhatsApp</h4>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={waConfig.enabled}
              onChange={(e) => setWaConfig({ ...waConfig, enabled: e.target.checked })}
              className="w-4 h-4 text-teal-600 rounded"
            />
            <span className="text-sm font-bold text-gray-700">Habilitar Alertas por WhatsApp</span>
          </label>
        </div>

        {/* CAMPOS CON DISABLED STATE - Igual patrón que SMTP */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity"
          style={{
            opacity: waConfig.enabled ? 1 : 0.5,
            pointerEvents: waConfig.enabled ? "auto" : "none",
          }}
        >
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              Número de Teléfono (con código de país)
            </label>
            <input
              type="text"
              placeholder="+521234567890"
              value={waConfig.phone}
              onChange={(e) => setWaConfig({ ...waConfig, phone: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              CallMeBot API Key
            </label>
            <input
              type="password"
              placeholder="Ej. 123456"
              value={waConfig.api_key}
              onChange={(e) => setWaConfig({ ...waConfig, api_key: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noreferrer" className="text-teal-600 underline">Obtener API Key aquí</a>
            </p>
          </div>
        </div>
      </section>

      {/* BOTONES DE ACCIÓN - Mismo estilo que SMTP */}
      <div className="flex justify-end items-center pt-2">
        <button
          type="submit"
          disabled={!waConfig.enabled}
          className="px-6 py-2 bg-teal-600 text-white rounded font-bold hover:bg-teal-700 shadow transition-all disabled:opacity-50"
        >
          Guardar Configuración WhatsApp
        </button>
      </div>
    </form>
  </div>
)}

        {activeTab === 'cloud' && userRole === 'admin' && (
  <div className="max-w-4xl animate-fade-in">
    {/* HEADER CON STATUS BADGE - Igual que SMTP */}
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-xl font-bold text-navy-dark">
        Sincronización a Base de Datos
      </h3>
      <span
        className={`border text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1 ${cloudConfig.enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}
      >
        <div
          className={`w-2 h-2 rounded-full ${cloudConfig.enabled ? "bg-green-500" : "bg-gray-400"}`}
        ></div>
        {cloudConfig.enabled ? "Servicio Activo" : "Servicio Apagado"}
      </span>
    </div>

    <form className="space-y-8" onSubmit={handleSaveCloud}>
      {/* SECCIÓN PRINCIPAL - Mismo estilo que SMTP */}
      <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
          <div className="flex items-center gap-2">
            {/* Ícono de Cloud */}
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path>
            </svg>
            <h4 className="text-lg font-bold text-navy-dark">Configuración de Webhook</h4>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cloudConfig.enabled}
              onChange={(e) => setCloudConfig({ ...cloudConfig, enabled: e.target.checked })}
              className="w-4 h-4 text-teal-600 rounded"
            />
            <span className="text-sm font-bold text-gray-700">Habilitar Webhook a la Nube</span>
          </label>
        </div>

        {/* CAMPOS CON DISABLED STATE - Igual patrón que SMTP */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity"
          style={{
            opacity: cloudConfig.enabled ? 1 : 0.5,
            pointerEvents: cloudConfig.enabled ? "auto" : "none",
          }}
        >
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              Endpoint URL (HTTPS recomendado)
            </label>
            <input
              type="url"
              placeholder="https://mi-servidor.com/api/telemetry"
              value={cloudConfig.url}
              onChange={(e) => setCloudConfig({ ...cloudConfig, url: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              Token de Autorización (Bearer)
            </label>
            <input
              type="password"
              placeholder="Tu API Key o Token JWT"
              value={cloudConfig.token}
              onChange={(e) => setCloudConfig({ ...cloudConfig, token: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Se enviará como header: <code className="bg-gray-100 px-1 rounded">Authorization: Bearer &lt;token&gt;</code>
            </p>
          </div>
        </div>
      </section>

      {/* BOTONES DE ACCIÓN - Mismo estilo que SMTP */}
      <div className="flex justify-end items-center pt-2">
        <button
          type="submit"
          disabled={!cloudConfig.enabled}
          className="px-6 py-2 bg-teal-600 text-white rounded font-bold hover:bg-teal-700 shadow transition-all disabled:opacity-50"
        >
          Guardar Configuración Cloud
        </button>
      </div>
    </form>
  </div>
)}
      </div>
    </div>
  );
  // FIN DEL RENDER PRINCIPAL
  return (
    <div className="flex h-screen bg-bg-light font-sans text-text-primary overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
  <Toaster position="top-right" />
  
  {/* ========== SIDEBAR ESCRITORIO ========== */}
  <aside className="hidden md:flex w-64 bg-navy-dark text-white flex-col shadow-2xl z-20 shrink-0">
    <div className="h-16 flex items-center justify-start px-6 border-b border-white/10 shrink-0">
      <h2 className="text-lg font-black tracking-widest">
        <span className="text-teal-support">Edge</span>SecOps
      </h2>
    </div>
    <nav className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto">
      {[
        { id: 'dashboard', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
        { id: 'logs', label: 'Auditoría', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
        { id: 'config', label: 'Ajustes', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
      ].map(item => (
        <button
          key={item.id}
          onClick={() => setActiveMenu(item.id as "dashboard" | "config" | "logs")}
          className={`flex items-center gap-3 px-3 py-3 rounded-lg font-bold transition-all text-left ${
            activeMenu === item.id 
              ? 'bg-teal-support text-navy-dark' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          aria-current={activeMenu === item.id ? 'page' : undefined}
        >
          <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path>
          </svg>
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </nav>
    <div className="p-4 border-t border-white/10 shrink-0">
      <button 
        onClick={handleLogout} 
        className="w-full flex justify-start items-center gap-3 px-3 py-2 text-gray-400 hover:text-red-400 font-bold transition-colors"
        aria-label="Cerrar sesión"
      >
        <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
        </svg>
        <span>Cerrar Sesión</span>
      </button>
    </div>
  </aside>

  {/* ========== DRAWER MÓVIL (Overlay + Menú) ========== */}
  {mobileMenuOpen && (
    <>
      {/* Overlay con fade-in */}
      <div 
        className="fixed inset-0 bg-black/50 z-30 md:hidden animate-fade-in"
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />
      
      {/* Drawer deslizante desde la izquierda */}
      <div 
        className="fixed inset-y-0 left-0 w-64 bg-navy-dark text-white z-40 md:hidden transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
      >
        {/* Header del drawer */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 shrink-0">
          <h2 className="text-lg font-black">
            <span className="text-teal-support">Edge</span>SecOps
          </h2>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Cerrar menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        {/* Navegación móvil */}
        <nav className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
            { id: 'logs', label: 'Auditoría', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
            { id: 'config', label: 'Ajustes', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveMenu(item.id as "dashboard" | "config" | "logs"); setMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-4 rounded-lg font-bold transition-all text-left ${
                activeMenu === item.id 
                  ? 'bg-teal-support text-navy-dark' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              aria-current={activeMenu === item.id ? 'page' : undefined}
            >
              <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path>
              </svg>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>
        
        {/* Footer del drawer con logout */}
        <div className="p-4 border-t border-white/10 shrink-0">
          <button 
            onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 font-bold transition-colors rounded-lg"
            aria-label="Cerrar sesión"
          >
            <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  )}

  {/* ========== MAIN CONTENT AREA ========== */}
  <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 relative">
    {/* TOP HEADER */}
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-10">
      {/* Botón hamburguesa (solo móvil) */}
      <button 
        onClick={() => setMobileMenuOpen(true)} 
        className="md:hidden p-2 text-navy-dark hover:bg-gray-100 rounded-lg transition-colors -ml-2"
        aria-label="Abrir menú de navegación"
        aria-expanded={mobileMenuOpen}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>
      
      {/* Título de página */}
      <h1 className="text-lg md:text-xl font-bold text-navy-dark truncate px-2">
        {activeMenu === 'dashboard' ? 'Monitor Operacional' : activeMenu === 'logs' ? 'Auditoría' : 'Configuración del Sistema'}
      </h1>
      
      {/* Info de usuario y logout */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {/* Tiempo y uptime (oculto en móvil muy pequeño) */}
        <div className="hidden sm:flex flex-col items-end border-r border-gray-200 pr-4">
          <span className="text-navy-dark font-mono font-bold text-sm">
            {sysTime?.toLocaleTimeString('es-MX', { hour12: false }) || '--:--:--'}
          </span>
          <span className="text-xs text-gray-500 font-semibold">
            Up: {telemetry ? Math.floor(telemetry.uptime / 60) : 0}m
          </span>
        </div>
        
        {/* Badge de rol */}
        <div className="px-2 py-1 bg-gray-100 text-gray-600 text-xs md:text-sm font-mono rounded border shadow-inner shrink-0">
          {userRole?.toUpperCase() || 'GUEST'}
        </div>
        
        {/* Logout button (desktop: texto, mobile: ícono) */}
        <button 
          onClick={handleLogout} 
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm"
          aria-label="Cerrar sesión"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          <span className="hidden lg:inline">Salir</span>
        </button>
        
        {/* Logout ícono solo móvil */}
        <button 
          onClick={handleLogout} 
          className="md:hidden p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          aria-label="Cerrar sesión"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
        </button>
      </div>
    </header>

    {/* BODY SCROLLABLE CON CONTENIDO */}
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 custom-scrollbar">
      <div className="max-w-7xl mx-auto w-full">
        {activeMenu === 'dashboard' && renderDashboard()}
        {activeMenu === 'logs' && renderLogs()}
        {activeMenu === 'config' && renderConfig()}
      </div>
    </div>
  </main>
</div>
  );
}
