// src/views/Dashboard.tsx
import { useTelemetryContext } from '../context/TelemetryContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Brush,
} from 'recharts';

import Loader from '../components/Loader';
import { useMemo, useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { apiFetch } from '../api/client';
import toast from 'react-hot-toast';




export interface ZonePref {
  name: string;
  color: string;
  lineType: 'monotone' | 'linear' | 'step';
  strokeDasharray: string;
  dot: boolean;
}

const DEFAULT_PREFS: ZonePref[] = [
  { name: 'Zona 1', color: '#F87171', lineType: 'monotone', strokeDasharray: '', dot: false },
  { name: 'Zona 2', color: '#FBBF24', lineType: 'monotone', strokeDasharray: '', dot: false },
  { name: 'Zona 3', color: '#34D399', lineType: 'monotone', strokeDasharray: '', dot: false },
  { name: 'Zona 4', color: '#60A5FA', lineType: 'monotone', strokeDasharray: '', dot: false },
  { name: 'Zona 5', color: '#A78BFA', lineType: 'monotone', strokeDasharray: '', dot: false },
];

const Dashboard = () => {
  const [dataWindow, setDataWindow] = useState<number>(60);
  const [zonePrefs, setZonePrefs] = useState<ZonePref[]>(() => {
    const saved = localStorage.getItem('dashboard_zone_prefs');
    return saved ? JSON.parse(saved) : DEFAULT_PREFS;
  });
  const [showSettings, setShowSettings] = useState(false);

  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const handleSavePrefs = async () => {
    setIsSavingPrefs(true);
    try {
      const res = await apiFetch('/api/config/dashboard', {
        method: 'POST',
        body: JSON.stringify({ zones: zonePrefs })
      });
      if (res.ok) {
        toast.success('Preferencias guardadas en el backend.');
      } else {
        toast.error('Error al guardar preferencias.');
      }
    } catch (e) {
      toast.error('Error de red al guardar.');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const updateZonePref = (index: number, key: keyof ZonePref, value: any) => {
    const newPrefs = [...zonePrefs];
    newPrefs[index] = { ...newPrefs[index], [key]: value };
    setZonePrefs(newPrefs);
    localStorage.setItem('dashboard_zone_prefs', JSON.stringify(newPrefs));
  };

  
  const { data: telemetry, status } = useTelemetryContext();
  const [chartData, setChartData] = useState<any[]>([]);

  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({});

  const handleLegendClick = (e: any) => {
    const dataKey = e.dataKey;
    setHiddenLines(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

  useEffect(() => {
    // Cargar preferencias del backend
    apiFetch('/api/config/dashboard')
      .then(res => res.json())
      .then(data => {
        if (data.zones && Array.isArray(data.zones)) {
          setZonePrefs(data.zones);
          localStorage.setItem('dashboard_zone_prefs', JSON.stringify(data.zones));
        }
      })
      .catch(() => {});

    // Cargar fechas disponibles
    apiFetch('/api/datasets')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const dates = data.map((d: any) => d.date).filter(d => d !== 'today');
          setAvailableDates(dates);
        }
      })
      .catch(() => {});

    // Pre-poblar el gráfico en vivo con los datos de hoy (dataset.csv)
    apiFetch('/api/dataset')
      .then(res => res.text())
      .then(csvText => {
        const lines = csvText.split('\n');
        const parsedData = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const parts = line.split(',');
          let timeLabel = parts[0];
          if (timeLabel.includes(' ')) timeLabel = timeLabel.split(' ')[1];
          parsedData.push({
            time: timeLabel,
            T0: parseFloat(parts[1]), H0: parseFloat(parts[2]),
            T1: parseFloat(parts[3]), H1: parseFloat(parts[4]),
            T2: parseFloat(parts[5]), H2: parseFloat(parts[6]),
            T3: parseFloat(parts[7]), H3: parseFloat(parts[8]),
            T4: parseFloat(parts[9]), H4: parseFloat(parts[10]),
            Voltaje: parseFloat(parts[11])
          });
        }
        if (parsedData.length > 0) {
          // Tomar máximo los últimos 360 registros (30 minutos de histórico base)
          setChartData(parsedData.slice(-360));
        }
      })
      .catch(() => {});
  }, []);

  const handleDayClick = async (date: Date) => {
    setSelectedDate(date);
    setIsLoadingHistory(true);
    
    // Formatear a YYYY-MM-DD
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    try {
      const res = await apiFetch(`/api/dataset?date=${dateStr}`);
      const csvText = await res.text();
      
      const lines = csvText.split('\n');
      const parsedData = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        let timeLabel = parts[0];
        if (timeLabel.includes(' ')) timeLabel = timeLabel.split(' ')[1];
        
        parsedData.push({
          time: timeLabel,
          T0: parseFloat(parts[1]), H0: parseFloat(parts[2]),
          T1: parseFloat(parts[3]), H1: parseFloat(parts[4]),
          T2: parseFloat(parts[5]), H2: parseFloat(parts[6]),
          T3: parseFloat(parts[7]), H3: parseFloat(parts[8]),
          T4: parseFloat(parts[9]), H4: parseFloat(parts[10]),
          Voltaje: parseFloat(parts[11])
        });
      }
      
      setHistoricalData(parsedData);
      if (parsedData.length === 0) {
        toast.error('El dataset seleccionado está vacío.');
      } else {
        toast.success(`Dataset cargado: ${parsedData.length} registros.`);
      }
    } catch (error) {
      setHistoricalData([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteHistorical = async () => {
    if (!selectedDate) return;
    if (!window.confirm('⚠️ ¿Estás seguro de eliminar este dataset histórico de forma permanente?')) return;
    
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    try {
      const res = await apiFetch(`/api/dataset?date=${dateStr}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`Dataset del ${dateStr} eliminado.`);
        setHistoricalData([]);
        setAvailableDates(prev => prev.filter(d => d !== dateStr));
        setSelectedDate(undefined);
      }
    } catch (e) {
      // toast ya manejado por apiFetch
    }
  };

  const handleDownloadHistorical = async () => {
    if (!selectedDate) return;
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    try {
      const response = await apiFetch(`/api/dataset?date=${dateStr}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edgenode_telemetry_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      // toast already handled by apiFetch
    }
  };

  useEffect(() => {
    if (telemetry) {
      setChartData((prevData) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        const newDataPoint: any = {
          time: timeString,
          Voltaje: telemetry.battery_v,
        };
        telemetry.sensors?.forEach((s: any) => {
            newDataPoint[`T${s.id}`] = s.t;
            newDataPoint[`H${s.id}`] = s.h;
        });

        const newBuffer = [...prevData, newDataPoint];
        if (newBuffer.length > 360) newBuffer.shift();
        return newBuffer;
      });
    }
  }, [telemetry]);

  const visibleData = chartData.slice(-dataWindow);
  
  // Revisar si algún sensor supera los 35 grados
  const isTempCritical = telemetry?.sensors?.some((s: any) => s.t && s.t > 35.0) ?? false;
  const isBatCritical = telemetry?.battery_v && telemetry.battery_v < 3.2;

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const allTemps: number[] = [];
    const allHums: number[] = [];
    
    visibleData.forEach((d) => {
        for(let i=0; i<5; i++) {
            if (typeof d[`T${i}`] === 'number' && !isNaN(d[`T${i}`])) allTemps.push(d[`T${i}`]);
            if (typeof d[`H${i}`] === 'number' && !isNaN(d[`H${i}`])) allHums.push(d[`H${i}`]);
        }
    });

    if (allTemps.length === 0 || allHums.length === 0) return null;

    return {
      t_mean: (allTemps.reduce((a, b) => a + b, 0) / allTemps.length).toFixed(1),
      t_max: Math.max(...allTemps).toFixed(1),
      t_min: Math.min(...allTemps).toFixed(1),
      h_mean: (allHums.reduce((a, b) => a + b, 0) / allHums.length).toFixed(1),
      h_max: Math.max(...allHums).toFixed(1),
      h_min: Math.min(...allHums).toFixed(1),
    };
  }, [chartData, dataWindow]);

  if (!telemetry && status === 'connecting') {
    return (
      <div className='min-h-[500px] flex flex-col items-center justify-center font-mono text-muted'>
        <Loader fullScreen={true} />
        <p className='animate-pulse mt-4'>Esperando datos del nodo...</p>
      </div>
    );
  }

  // Preparamos datos scatter promediados para TinyML si se requiere
  const scatterData = visibleData.map(d => {
    let t_sum = 0, h_sum = 0, count = 0;
    for(let i=0; i<5; i++) {
        if (typeof d[`T${i}`] === 'number' && !isNaN(d[`T${i}`])) {
            t_sum += d[`T${i}`]; h_sum += d[`H${i}`]; count++;
        }
    }
    return {
        Temperatura: count > 0 ? t_sum / count : 0,
        Humedad: count > 0 ? h_sum / count : 0
    };
  });

  return (
    <div className='space-y-6 animate-fade-in'>
      {/* BANNER DE ALERTAS DINÁMICAS */}
      {(isTempCritical || isBatCritical) && (
        <div className='bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-lg shadow-sm flex items-start gap-4 animate-pulse'>
          <svg className='w-6 h-6 text-red-600 shrink-0 mt-0.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'></path></svg>
          <div>
            <h3 className='text-red-800 font-bold'>Intervención Requerida</h3>
            <p className='text-red-700 dark:text-red-400 text-sm mt-1'>
              {isTempCritical && '🔥 Sobrecalentamiento detectado en al menos una zona. '}
              {isBatCritical && '🔋 Batería en nivel crítico. Conecte alimentación. '}
            </p>
          </div>
        </div>
      )}

      {/* TOOLBAR DE ANÁLISIS */}
      <div className='flex flex-col md:flex-row justify-between items-center gap-4 bg-panel p-3 rounded-lg border border-border-color shadow-sm'>
        <h3 className='font-bold text-primary flex items-center gap-2'>
          <svg className='w-5 h-5 text-blue-600 dark:text-blue-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z'></path></svg>
          Centro de Inteligencia Operacional
        </h3>
        <div className='flex items-center gap-4'>
          <button onClick={() => setShowSettings(!showSettings)} className='btn btn-secondary text-sm py-1 px-3 flex items-center gap-2'>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            Gráficos
          </button>
          <div className='flex items-center gap-2 text-sm font-semibold'>
            <span className='text-secondary'>Muestras:</span>
          <select value={dataWindow} onChange={(e) => setDataWindow(Number(e.target.value))} className='input-field'>
            <option value={60}>Últimas 60 Muestras</option>
            <option value={180}>Últimas 180 Muestras</option>
            <option value={360}>Últimas 360 Muestras</option>
          </select>
        </div>
        </div>
      </div>


      {showSettings && (
        <div className='bg-panel p-4 rounded-lg border border-border-color shadow-sm mb-4 animate-fade-in'>
          <div className='flex justify-between items-center mb-3'>
            <h4 className='text-sm font-bold text-primary'>Personalización de Gráficos (Zonas)</h4>
            <button onClick={handleSavePrefs} disabled={isSavingPrefs} className='btn btn-primary text-xs py-1 px-3'>
              {isSavingPrefs ? 'Guardando...' : 'Guardar en Servidor'}
            </button>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>
            {[0, 1, 2, 3, 4].map(id => (
              <div key={`pref-${id}`} className='space-y-2 border border-border-color p-3 rounded bg-app'>
                <input type='text' value={zonePrefs[id].name} onChange={e => updateZonePref(id, 'name', e.target.value)} className='input-field text-sm font-bold w-full' placeholder={`Zona ${id+1}`} />
                <div className='flex items-center gap-2'>
                  <input type='color' value={zonePrefs[id].color} onChange={e => updateZonePref(id, 'color', e.target.value)} className='w-8 h-8 rounded cursor-pointer shrink-0 border-0 p-0' />
                  <select value={zonePrefs[id].lineType} onChange={e => updateZonePref(id, 'lineType', e.target.value as any)} className='input-field text-xs flex-1'>
                    <option value='monotone'>Curva</option>
                    <option value='linear'>Recta</option>
                    <option value='step'>Escalón</option>
                  </select>
                </div>
                <div className='flex items-center justify-between text-xs text-text-secondary'>
                  <label className='flex items-center gap-1 cursor-pointer'><input type='checkbox' checked={zonePrefs[id].strokeDasharray === '5 5'} onChange={e => updateZonePref(id, 'strokeDasharray', e.target.checked ? '5 5' : '')} /> Punteada</label>
                  <label className='flex items-center gap-1 cursor-pointer'><input type='checkbox' checked={zonePrefs[id].dot} onChange={e => updateZonePref(id, 'dot', e.target.checked)} /> Puntos</label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GRID MULTI-ZONAS */}
      <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4'>
        {[0, 1, 2, 3, 4].map((id) => {
            const sensor = telemetry?.sensors?.find((s: any) => s.id === id);
            return (
              <div key={id} className='bg-panel p-4 rounded-lg border border-border-color shadow-sm flex flex-col justify-between hover:border-accent transition-colors'>
                <p className='text-xs font-bold text-text-secondary uppercase mb-2'>{zonePrefs[id].name}</p>
                <div className='flex justify-between items-end gap-2'>
                    <div className='flex flex-col'>
                        <span className='text-[10px] text-muted font-bold'>TEMP</span>
                        <p className='text-xl font-black text-primary'>{typeof sensor?.t === 'number' && !isNaN(sensor.t) ? sensor.t.toFixed(1) : '--'}<span className='text-sm text-text-secondary font-normal'>°C</span></p>
                    </div>
                    <div className='flex flex-col items-end'>
                        <span className='text-[10px] text-muted font-bold'>HUM</span>
                        <p className='text-xl font-black text-primary'>{typeof sensor?.h === 'number' && !isNaN(sensor.h) ? sensor.h.toFixed(1) : '--'}<span className='text-sm text-text-secondary font-normal'>%</span></p>
                    </div>
                </div>
              </div>
            );
        })}
      </div>

      {/* KPIs Superiores + Estadísticas Globales */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='bg-panel p-5 rounded-lg border-l-4 border-orange-500 shadow-sm relative overflow-hidden group'>
          <p className='text-secondary text-sm font-semibold'>Media Térmica Global</p>
          <div className='flex items-end gap-3 mt-2'>
            <p className='text-3xl font-bold text-primary'>{stats?.t_mean || '--'} <span className='text-lg'>°C</span></p>
          </div>
          <div className='absolute inset-x-0 bottom-0 bg-orange-50 h-0 group-hover:h-8 transition-all flex items-center justify-around px-2 opacity-0 group-hover:opacity-100 text-[10px] font-bold text-orange-800 dark:text-orange-300'>
            <span>MAX: {stats?.t_max || '--'}°C</span>
            <span>MIN: {stats?.t_min || '--'}°C</span>
          </div>
        </div>

        <div className='bg-panel p-5 rounded-lg border-l-4 border-blue-500 shadow-sm relative overflow-hidden group'>
          <p className='text-secondary text-sm font-semibold'>Media Humedad Global</p>
          <div className='flex items-end gap-3 mt-2'>
            <p className='text-3xl font-bold text-primary'>{stats?.h_mean || '--'} <span className='text-lg'>%</span></p>
          </div>
          <div className='absolute inset-x-0 bottom-0 bg-blue-50 dark:bg-blue-900/30 h-0 group-hover:h-8 transition-all flex items-center justify-around px-2 opacity-0 group-hover:opacity-100 text-[10px] font-bold text-blue-800 dark:text-blue-300'>
            <span>MAX: {stats?.h_max || '--'}%</span>
            <span>MIN: {stats?.h_min || '--'}%</span>
          </div>
        </div>

        <div className={`bg-panel p-5 rounded-lg border-l-4 shadow-sm ${telemetry?.power_state === 'Charging' ? 'border-orange-500 bg-orange-50/30' : telemetry?.power_state === 'Charged' ? 'border-green-500 bg-green-50/30' : 'border-yellow-400'}`}>
          <div className='flex justify-between items-start'>
            <p className='text-secondary text-sm font-semibold'>V_BAT (TP4056)</p>
            <span className='text-xl'>{telemetry?.power_state === 'Charging' ? '⚡' : telemetry?.power_state === 'Charged' ? '🔌' : '🔋'}</span>
          </div>
          <div className='flex items-baseline gap-2 mt-2'>
            <p className='text-3xl font-bold text-primary'>{telemetry?.battery_v?.toFixed(2) || '--'} <span className='text-lg'>V</span></p>
            <p className={`text-[10px] uppercase font-bold ${telemetry?.power_state === 'Charging' ? 'text-orange-600 dark:text-orange-400 animate-pulse' : telemetry?.power_state === 'Charged' ? 'text-green-600' : 'text-secondary'}`}>
              {telemetry?.power_state === 'Charging' ? 'Cargando' : telemetry?.power_state === 'Charged' ? 'Full' : 'Batería'}
            </p>
          </div>
          <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-3 overflow-hidden shadow-inner'>
            <div className={`h-1.5 rounded-full transition-colors duration-1000 ${telemetry?.power_state === 'Charging' ? 'bg-orange-500' : telemetry?.power_state === 'Charged' ? 'bg-green-500 dark:bg-green-600' : (telemetry?.battery_v || 0) < 3.4 ? 'bg-red-500' : 'bg-yellow-400'}`} style={{ width: `${Math.max(0, Math.min(100, (((telemetry?.battery_v || 0) - 3.2) / 1.0) * 100))}%` }}></div>
          </div>
        </div>

        <div className='bg-panel p-5 rounded-lg border-l-4 border-green-500 shadow-sm relative overflow-hidden group'>
          <div className='flex justify-between items-start'>
            <p className='text-secondary text-sm font-semibold'>Estado ML</p>
            <span className='text-xs font-mono text-text-secondary'>Inferencia</span>
          </div>
          <p className='text-sm font-bold text-blue-400 dark:text-blue-300 truncate mt-1'>
            {telemetry?.ml_inference_us ? (telemetry.ml_inference_us / 1000).toFixed(1) : '--'} ms
          </p>
          <div className='border-t border-border-color mt-3 pt-3 grid grid-cols-1 gap-2 text-xs font-mono text-muted'>
            <div>
              <p>Heap Free / Max:</p>
              <p className='text-blue-400 dark:text-blue-300 font-bold text-sm'>
                {((telemetry?.heap_free || 0) / 1024).toFixed(0)} / {((telemetry?.heap_max_block || 0) / 1024).toFixed(0)} KB
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA DE GRÁFICOS AVANZADOS */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div className='card p-5 flex flex-col lg:col-span-2'>
          <h4 className='text-sm font-bold text-text-secondary mb-4 border-b border-border-color pb-2 uppercase tracking-wider flex justify-between'>
            <span>Tendencia Termodinámica (Multi-Zona)</span>
            <span className='text-[10px] text-muted font-normal normal-case'>Clic en leyenda para ocultar</span>
          </h4>
          <div className='flex-1 min-h-[350px] w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={visibleData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' vertical={false} />
                <XAxis dataKey='time' stroke='#9ca3af' fontSize={10} tickMargin={10} minTickGap={30} />
                <YAxis yAxisId='left' stroke='#F29F67' fontSize={10} domain={['dataMin - 2', 'dataMax + 2']} />
                <YAxis yAxisId='right' orientation='right' stroke='#3B8FF3' fontSize={10} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#1E1E2C', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} />
                <Legend iconType='circle' wrapperStyle={{ fontSize: '12px', paddingTop: '10px', cursor: 'pointer' }} onClick={handleLegendClick} />
                
                {[0, 1, 2, 3, 4].map(id => (
                    <Line key={`T${id}`} hide={hiddenLines[`T${id}`]} yAxisId='left' name={`${zonePrefs[id].name} (T)`} type={zonePrefs[id].lineType} dataKey={`T${id}`} stroke={zonePrefs[id].color} strokeDasharray={zonePrefs[id].strokeDasharray} strokeWidth={2} dot={zonePrefs[id].dot} isAnimationActive={false} />
                ))}
                {[0, 1, 2, 3, 4].map(id => (
                    <Line key={`H${id}`} hide={hiddenLines[`H${id}`]} yAxisId='right' name={`${zonePrefs[id].name} (H)`} type={zonePrefs[id].lineType} strokeDasharray={zonePrefs[id].strokeDasharray || "5 5"} dataKey={`H${id}`} stroke={zonePrefs[id].color} strokeWidth={2} dot={zonePrefs[id].dot} opacity={0.6} isAnimationActive={false} />
                ))}
                <Brush dataKey="time" height={30} stroke="#3B8FF3" fill="#1E1E2C" travellerWidth={10} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className='card p-5 flex flex-col'>
          <h4 className='text-sm font-bold text-text-secondary mb-4 border-b border-border-color pb-2 uppercase tracking-wider flex justify-between'>
            <span>Análisis de Consumo (V_BAT)</span>
          </h4>
          <div className='flex-1 min-h-[220px] w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={visibleData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' vertical={false} />
                <XAxis dataKey='time' stroke='#9ca3af' fontSize={10} tickMargin={10} minTickGap={30} />
                <YAxis stroke='#8B5CF6' fontSize={10} domain={[3.0, 4.3]} tickCount={6} />
                <Tooltip contentStyle={{ backgroundColor: '#1E1E2C', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} formatter={(value: any) => [`${Number(value || 0).toFixed(2)} V`, 'Voltaje']} />
                <Line type='monotone' dataKey='Voltaje' name='Voltaje Batería' stroke='#8B5CF6' strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#8B5CF6' }} isAnimationActive={false} />
                <Brush dataKey="time" height={30} stroke="#8B5CF6" fill="#1E1E2C" travellerWidth={10} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className='card p-5 flex flex-col'>
          <h4 className='text-sm font-bold text-text-secondary mb-4 border-b border-border-color pb-2 uppercase tracking-wider flex justify-between items-center'>
            <span>Dispersión Ambiental (Promedio TinyML)</span>
            <span className='text-[10px] text-muted font-normal normal-case'>Temp vs Humedad</span>
          </h4>
          <div className='flex-1 min-h-[220px] w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <ScatterChart margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                <XAxis type='number' dataKey='Temperatura' name='Temp' unit='°C' stroke='#9ca3af' fontSize={10} domain={['dataMin - 1', 'dataMax + 1']} tickCount={5} />
                <YAxis type='number' dataKey='Humedad' name='Humedad' unit='%' stroke='#9ca3af' fontSize={10} domain={['dataMin - 5', 'dataMax + 5']} />
                <ZAxis type='number' range={[20, 20]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#1E1E2C', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} />
                <Scatter name='Lecturas Medias' data={scatterData} fill='#14B8A6' opacity={0.6} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* EXPLORADOR DE DATASETS HISTÓRICOS */}
      <div className='card p-6 mt-8'>
        <div className='flex items-center gap-2 mb-6 border-b border-border-color pb-2'>
          <svg className='w-6 h-6 text-accent' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'></path></svg>
          <h3 className='text-xl font-bold text-text-primary'>Explorador de Datasets Históricos</h3>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          <div className='lg:col-span-1 bg-app p-4 rounded-xl border border-border-color flex justify-center'>
            <DayPicker 
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && handleDayClick(d)}
              modifiers={{
                available: availableDates.map(d => {
                  const [y, m, day] = d.split('-');
                  return new Date(parseInt(y), parseInt(m)-1, parseInt(day));
                })
              }}
              modifiersStyles={{
                available: { fontWeight: 'bold', textDecoration: 'underline', color: 'var(--color-accent)' }
              }}
            />
          </div>

          <div className='lg:col-span-2 flex flex-col'>
            {selectedDate ? (
              <div className='flex-1 flex flex-col'>
                <div className='flex justify-between items-center mb-4'>
                  <h4 className='font-bold text-text-primary'>
                    Datos del {selectedDate.toLocaleDateString('es-ES')}
                  </h4>
                  {historicalData.length > 0 && (
                    <div className="flex gap-2">
                      <button onClick={handleDownloadHistorical} className='btn btn-primary text-sm py-1.5'>
                        Descargar CSV
                      </button>
                      <button onClick={handleDeleteHistorical} className='btn btn-danger text-sm py-1.5'>
                        Borrar Día
                      </button>
                    </div>
                  )}
                </div>
                
                {isLoadingHistory ? (
                  <div className='flex-1 flex justify-center items-center text-muted min-h-[300px]'>
                    <div className='w-8 h-8 border-4 border-border-color border-t-accent rounded-full animate-spin'></div>
                  </div>
                ) : historicalData.length > 0 ? (
                  <div className='flex-1 min-h-[300px] w-full bg-panel p-4 rounded-lg border border-border-color'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <LineChart data={historicalData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' vertical={false} />
                        <XAxis dataKey='time' stroke='#9ca3af' fontSize={10} tickMargin={10} minTickGap={30} />
                        <YAxis yAxisId='left' stroke='#F29F67' fontSize={10} domain={['auto', 'auto']} />
                        <YAxis yAxisId='right' orientation='right' stroke='#3B8FF3' fontSize={10} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: '#1E1E2C', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} />
                        <Legend iconType='circle' wrapperStyle={{ fontSize: '12px', paddingTop: '10px', cursor: 'pointer' }} onClick={handleLegendClick} />
                        
                        {[0, 1, 2, 3, 4].map(id => (
                            <Line key={`T${id}`} hide={hiddenLines[`T${id}`]} yAxisId='left' name={`${zonePrefs[id].name} (T)`} type={zonePrefs[id].lineType} dataKey={`T${id}`} stroke={zonePrefs[id].color} strokeDasharray={zonePrefs[id].strokeDasharray} strokeWidth={2} dot={zonePrefs[id].dot} isAnimationActive={false} />
                        ))}
                        {[0, 1, 2, 3, 4].map(id => (
                            <Line key={`H${id}`} hide={hiddenLines[`H${id}`]} yAxisId='right' name={`${zonePrefs[id].name} (H)`} type={zonePrefs[id].lineType} strokeDasharray={zonePrefs[id].strokeDasharray || "5 5"} dataKey={`H${id}`} stroke={zonePrefs[id].color} strokeWidth={2} dot={zonePrefs[id].dot} opacity={0.6} isAnimationActive={false} />
                        ))}
                        <Brush dataKey="time" height={30} stroke="#F29F67" fill="#1E1E2C" travellerWidth={10} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className='flex-1 flex justify-center items-center text-muted min-h-[300px] border-2 border-dashed border-border-color rounded-lg bg-app'>
                    <p>No se encontraron datos para este día.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className='flex-1 flex justify-center items-center text-muted border-2 border-dashed border-border-color rounded-lg bg-app min-h-[300px] p-6 text-center'>
                <p>Selecciona una fecha en el calendario para visualizar su dataset histórico (telemetría procesada y almacenada en LittleFS).</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
