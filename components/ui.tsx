import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({ 
  children, onClick, variant = 'primary', className = '', isLoading = false, disabled = false, ...props 
}: any) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500",
    danger: "bg-red-500 text-white hover:bg-red-600 focus:ring-red-500",
    success: "bg-green-500 text-white hover:bg-green-600 focus:ring-green-500",
    outline: "border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled || isLoading} 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', ...props }: any) => (
  <div className={`bg-white rounded-xl shadow-md p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const Avatar = ({ src, alt, size = 'md' }: { src?: string, alt: string, size?: 'sm'|'md'|'lg'|'xl' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32'
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-200 border border-gray-200 flex-shrink-0`}>
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <svg className="w-1/2 h-1/2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
      )}
    </div>
  );
};

export const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    '出席': 'bg-green-100 text-green-800 border-green-200',
    '遲到': 'bg-orange-100 text-orange-800 border-orange-200',
    '缺席': 'bg-red-100 text-red-800 border-red-200',
    '請假': 'bg-blue-100 text-blue-800 border-blue-200',
    '早退': 'bg-gray-100 text-gray-800 border-gray-200',
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${colors[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
};