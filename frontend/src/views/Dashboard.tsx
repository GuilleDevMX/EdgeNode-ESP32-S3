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
} from 'recharts';

import Loader from '../components/Loader';
import { useMemo, useState, useEffect } from 'react';

const Dashboard = () => {
  const [timeWindow, setTimeWindow] = useState<number>(60);
  
  const { data: telemetry, status } = useTelemetryContext();
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (telemetry) {
      setChartData((prevData) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        const newDataPoint = {
          time: timeString,
          Temperatura: telemetry.temperature,
          Humedad: telemetry.humidity,
          Voltaje: telemetry.battery_v,
        };
        const newBuffer = [...prevData, newDataPoint];
        if (newBuffer.length > 360) newBuffer.shift();
        return newBuffer;
      });
    }
  }, [telemetry]);

  const visibleData = chartData.slice(-timeWindow);
  const isTempCritical = telemetry?.temperature && telemetry.temperature > 35.0;
  const isBatCritical = telemetry?.battery_v && telemetry.battery_v < 3.2;

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
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

  if (!telemetry && status === 'connecting') {
    return (
      <div className='min-h-[500px] flex flex-col items-center justify-center font-mono text-gray-500'>
        <Loader fullScreen={true} />
        <p className='animate-pulse mt-4'>Esperando datos del nodo...</p>
      </div>
    );
  }

  return (
    <div className='space-y-6 animate-fade-in'>
      {/* BANNER DE ALERTAS DINÁMICAS */}
      {(isTempCritical || isBatCritical) && (
        <div className='bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm flex items-start gap-4 animate-pulse'>
          <svg className='w-6 h-6 text-red-600 shrink-0 mt-0.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'></path></svg>
          <div>
            <h3 className='text-red-800 font-bold'>Intervención Requerida</h3>
            <p className='text-red-700 text-sm mt-1'>
              {isTempCritical && '🔥 Sobrecalentamiento detectado en el nodo. '}
              {isBatCritical && '🔋 Batería en nivel crítico. Conecte alimentación. '}
            </p>
          </div>
        </div>
      )}

      {/* TOOLBAR DE ANÁLISIS */}
      <div className='flex flex-col md:flex-row justify-between items-center gap-4 bg-panel p-3 rounded-lg border border-border-color shadow-sm'>
        <h3 className='font-bold text-primary flex items-center gap-2'>
          <svg className='w-5 h-5 text-blue-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z'></path></svg>
          Centro de Inteligencia Operacional
        </h3>
        <div className='flex items-center gap-2 text-sm font-semibold'>
          <span className='text-secondary'>Ventana de Análisis:</span>
          <select value={timeWindow} onChange={(e) => setTimeWindow(Number(e.target.value))} className='input-field'>
            <option value={60}>Últimos 5 Minutos</option>
            <option value={180}>Últimos 15 Minutos</option>
            <option value={360}>Últimos 30 Minutos</option>
          </select>
        </div>
      </div>

      {/* KPIs Superiores + Estadísticas */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='bg-panel p-5 rounded-lg border-l-4 border-orange-500 shadow-sm relative overflow-hidden group'>
          <p className='text-secondary text-sm font-semibold'>T_DHT22 (Temperatura)</p>
          <div className='flex items-end gap-3 mt-2'>
            <p className='text-3xl font-bold text-primary'>{telemetry?.temperature?.toFixed(1) || '--'} <span className='text-lg'>°C</span></p>
            {stats && <span className='text-xs font-bold text-secondary mb-1'>Media: {stats.t_mean}°C</span>}
          </div>
          <div className='absolute inset-x-0 bottom-0 bg-orange-50 h-0 group-hover:h-8 transition-all flex items-center justify-around px-2 opacity-0 group-hover:opacity-100 text-[10px] font-bold text-orange-800'>
            <span>MAX: {stats?.t_max || '--'}°C</span>
            <span>MIN: {stats?.t_min || '--'}°C</span>
          </div>
        </div>

        <div className='bg-panel p-5 rounded-lg border-l-4 border-blue-500 shadow-sm relative overflow-hidden group'>
          <p className='text-secondary text-sm font-semibold'>H_DHT22 (Humedad)</p>
          <div className='flex items-end gap-3 mt-2'>
            <p className='text-3xl font-bold text-primary'>{telemetry?.humidity?.toFixed(1) || '--'} <span className='text-lg'>%</span></p>
            {stats && <span className='text-xs font-bold text-secondary mb-1'>Media: {stats.h_mean}%</span>}
          </div>
          <div className='absolute inset-x-0 bottom-0 bg-blue-50 h-0 group-hover:h-8 transition-all flex items-center justify-around px-2 opacity-0 group-hover:opacity-100 text-[10px] font-bold text-blue-800'>
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
            <p className={`text-[10px] uppercase font-bold ${telemetry?.power_state === 'Charging' ? 'text-orange-600 animate-pulse' : telemetry?.power_state === 'Charged' ? 'text-green-600' : 'text-secondary'}`}>
              {telemetry?.power_state === 'Charging' ? 'Cargando' : telemetry?.power_state === 'Charged' ? 'Full' : 'Batería'}
            </p>
          </div>
          <div className='w-full bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden shadow-inner'>
            <div className={`h-1.5 rounded-full transition-colors duration-1000 ${telemetry?.power_state === 'Charging' ? 'bg-orange-500' : telemetry?.power_state === 'Charged' ? 'bg-green-500' : (telemetry?.battery_v || 0) < 3.4 ? 'bg-red-500' : 'bg-yellow-400'}`} style={{ width: `${Math.max(0, Math.min(100, (((telemetry?.battery_v || 0) - 3.2) / 1.0) * 100))}%` }}></div>
          </div>
        </div>

        <div className='bg-gray-900 p-5 rounded-lg shadow-sm text-white flex flex-col justify-between'>
          <div className='flex justify-between items-start'>
            <p className='text-gray-400 text-sm font-semibold'>Estado ML</p>
            <span className='text-xs font-mono text-gray-500'>Inferencia</span>
          </div>
          <p className='text-sm font-bold text-blue-400 truncate mt-1'>
            {telemetry?.ml_inference_us ? (telemetry.ml_inference_us / 1000).toFixed(1) : '--'} ms
          </p>
          <div className='border-t border-gray-700 mt-3 pt-3 grid grid-cols-1 gap-2 text-xs font-mono text-gray-400'>
            <div>
              <p>Heap Free / Max:</p>
              <p className='text-blue-400 font-bold text-sm'>
                {((telemetry?.heap_free || 0) / 1024).toFixed(0)} / {((telemetry?.heap_max_block || 0) / 1024).toFixed(0)} KB
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA DE GRÁFICOS AVANZADOS */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div className='bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col lg:col-span-2'>
          <h4 className='text-sm font-bold text-gray-700 mb-4 border-b pb-2 uppercase tracking-wider'>Tendencia Termodinámica</h4>
          <div className='flex-1 min-h-[250px] w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={visibleData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' vertical={false} />
                <XAxis dataKey='time' stroke='#9ca3af' fontSize={10} tickMargin={10} minTickGap={30} />
                <YAxis yAxisId='left' stroke='#F29F67' fontSize={10} domain={['dataMin - 2', 'dataMax + 2']} />
                <YAxis yAxisId='right' orientation='right' stroke='#3B8FF3' fontSize={10} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#1E1E2C', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} />
                <Legend iconType='circle' wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line yAxisId='left' type='monotone' dataKey='Temperatura' stroke='#F29F67' strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
                <Line yAxisId='right' type='monotone' dataKey='Humedad' stroke='#3B8FF3' strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className='bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col'>
          <h4 className='text-sm font-bold text-gray-700 mb-4 border-b pb-2 uppercase tracking-wider flex justify-between'>
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
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className='bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col'>
          <h4 className='text-sm font-bold text-gray-700 mb-4 border-b pb-2 uppercase tracking-wider flex justify-between items-center'>
            <span>Dispersión Ambiental (TinyML View)</span>
            <span className='text-[10px] text-gray-400 font-normal normal-case'>Temp vs Humedad</span>
          </h4>
          <div className='flex-1 min-h-[220px] w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <ScatterChart margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                <XAxis type='number' dataKey='Temperatura' name='Temp' unit='°C' stroke='#9ca3af' fontSize={10} domain={['dataMin - 1', 'dataMax + 1']} tickCount={5} />
                <YAxis type='number' dataKey='Humedad' name='Humedad' unit='%' stroke='#9ca3af' fontSize={10} domain={['dataMin - 5', 'dataMax + 5']} />
                <ZAxis type='number' range={[20, 20]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#1E1E2C', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} />
                <Scatter name='Lecturas' data={visibleData} fill='#14B8A6' opacity={0.6} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
