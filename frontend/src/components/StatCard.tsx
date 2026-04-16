// src/components/StatCard.tsx
interface StatCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: string;
  trend?: string;
  color?: string; // e.g., 'blue', 'green', 'red'
}

const StatCard = ({ title, value, unit, icon }: StatCardProps) => {
  return (
    <div className="card shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-secondary text-sm font-medium uppercase tracking-wider">{title}</h3>
        <span className={`text-2xl`}>{icon}</span>
      </div>
      <div className="flex items-baseline">
        <span className="text-3xl font-bold text-primary">{value}</span>
        <span className="ml-2 text-muted font-medium">{unit}</span>
      </div>
    </div>
  );
};

export default StatCard;