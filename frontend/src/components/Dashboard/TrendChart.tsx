import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ChartDataPoint } from '../../hooks/useTelemetry';

interface TrendChartProps {
  data: ChartDataPoint[];
}

export default function TrendChart({ data }: TrendChartProps) {
  return (
    <div className="lg:col-span-2 bg-panel-bg p-6 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-navy-dark mb-4">Análisis de Tendencia Ambiental</h3>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: -20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#9ca3af" 
              fontSize={12} 
              tickMargin={10}
            />
            <YAxis 
              yAxisId="left" 
              stroke="#9ca3af" 
              fontSize={12} 
              domain={['auto', 'auto']}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="#9ca3af" 
              fontSize={12} 
              domain={[0, 100]}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1E1E2C', borderColor: '#1E1E2C', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="Temperatura" 
              stroke="#F29F67" 
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2 }}
              activeDot={{ r: 6 }} 
              isAnimationActive={false} 
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="Humedad" 
              stroke="#3B8FF3" 
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
