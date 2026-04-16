// src/components/AnomalyAlert.tsx
const AnomalyAlert = ({ mse, threshold = 0.015 }: { mse: number, threshold?: number }) => {
  if (mse <= threshold) return null;

  return (
    <div className="bg-red-900/30 border border-red-500 p-4 rounded-lg flex items-center gap-4 animate-pulse">
      <span className="text-2xl">⚠️</span>
      <div>
        <h4 className="text-red-400 font-bold uppercase text-xs">Anomalía Detectada (TinyML)</h4>
        <p className="text-white text-sm">El error cuadrático medio ({mse.toFixed(4)}) supera el umbral de seguridad.</p>
      </div>
    </div>
  );
};

export default AnomalyAlert;