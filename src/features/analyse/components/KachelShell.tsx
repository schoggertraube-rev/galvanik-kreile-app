import React from 'react';
import { motion } from 'framer-motion';

interface KachelShellProps {
  title: string;
  subtitle: string;
  status: 'STABIL' | 'BEOBACHTEN' | 'HANDLUNGSBEDARF';
  onClick?: () => void;
  children: React.ReactNode;
}

export const KachelShell: React.FC<KachelShellProps> = ({ title, subtitle, status, onClick, children }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'STABIL': return 'bg-green-100 text-green-800';
      case 'BEOBACHTEN': return 'bg-yellow-100 text-yellow-800';
      case 'HANDLUNGSBEDARF': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <motion.div 
      whileHover={onClick ? { scale: 1.02 } : {}}
      onClick={onClick}
      className={`relative bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            ⚡ {title}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getStatusColor()}`}>
          {status}
        </span>
      </div>
      <div className="flex-1">
        {children}
      </div>
    </motion.div>
  );
};
