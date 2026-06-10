import React from 'react';

interface KpiMiniCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export const KpiMiniCard: React.FC<KpiMiniCardProps> = ({ label, value, subValue, trend }) => {
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {subValue && (
        <span className={`text-sm mt-1 flex items-center gap-1 ${getTrendColor()}`}>
          {trend === 'up' && '▲'}
          {trend === 'down' && '▼'}
          {subValue}
        </span>
      )}
    </div>
  );
};
