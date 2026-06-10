import React from 'react';

interface LeerzustandHinweisProps {
  message: string;
}

export const LeerzustandHinweis: React.FC<LeerzustandHinweisProps> = ({ message }) => {
  return (
    <div className="flex items-center justify-center p-8 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-gray-500 text-sm">
      {message}
    </div>
  );
};
