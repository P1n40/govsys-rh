import React from 'react';

export const Card = ({ children, className = '', onClick }: { children?: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div 
    className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}
    onClick={onClick}
  >
    {children}
  </div>
);

export const Badge = ({ children, type }: { children?: React.ReactNode, type: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) => {
  const colors = {
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    danger: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    neutral: 'bg-slate-100 text-slate-800 border-slate-200',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[type]}`}>
      {children}
    </span>
  );
};

export const Button = ({ 
  children, 
  variant = 'primary', 
  onClick, 
  disabled = false,
  className = '',
  type = 'button'
}: { 
  children?: React.ReactNode, 
  variant?: 'primary' | 'secondary' | 'danger' | 'outline', 
  onClick?: () => void,
  disabled?: boolean,
  className?: string,
  type?: 'button' | 'submit' | 'reset'
}) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 shadow-sm",
    secondary: "bg-slate-800 hover:bg-slate-900 text-white focus:ring-slate-700 shadow-sm",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-sm",
    outline: "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-slate-300"
  };

  return (
    <button 
      type={type}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};