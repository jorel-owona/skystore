import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export default function Toast({ toasts = [], removeToast }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => {
        const getIcon = () => {
          switch (toast.type) {
            case 'success': return <CheckCircle2 className="text-emerald-500 shrink-0" size={22} />;
            case 'warning': return <AlertTriangle className="text-amber-500 shrink-0" size={22} />;
            case 'error': return <XCircle className="text-rose-500 shrink-0" size={22} />;
            default: return <Info className="text-blue-500 shrink-0" size={22} />;
          }
        };

        const getBorderColor = () => {
          switch (toast.type) {
            case 'success': return 'border-emerald-500/30';
            case 'warning': return 'border-amber-500/30';
            case 'error': return 'border-rose-500/30';
            default: return 'border-blue-500/30';
          }
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto liquid-glass liquid-glass-3d rounded-2xl p-4 flex items-center space-x-3 shadow-2xl border ${getBorderColor()} animate-fade-in backdrop-blur-xl`}
          >
            {getIcon()}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{toast.title || 'Notification'}</h4>
              {toast.message && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 line-clamp-2">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
