import React, { useState, useEffect } from 'react';
import { Clock, Activity, ArrowRightLeft, ShieldAlert, AlertTriangle, ChevronRight, Info } from 'lucide-react';
import query from '../utils/db';

function DetailBlock({ label, value }) {
  if (Array.isArray(value)) {
    return (
      <div className="mt-2">
        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">{label} :</p>
        {value.map((item, i) => (
          <div key={i} className="flex justify-between bg-slate-100 dark:bg-slate-900 rounded-lg px-3 py-2 text-sm mb-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium">{item.nom || item.name || JSON.stringify(item)}</span>
            <span className="text-amber-600 dark:text-amber-400 text-xs font-bold">{item.info || item.qte || ''}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex justify-between items-start gap-4 text-sm py-0.5">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-800 dark:text-slate-200 font-bold text-right">{value}</span>
    </div>
  );
}

function AuditCard({ log }) {
  const [open, setOpen] = useState(false);
  
  // Choose icon and color based on type
  let Icon = Info;
  let color = 'text-slate-500 dark:text-slate-400';
  let bg = 'bg-slate-100 dark:bg-slate-800';
  let borderColor = 'border-slate-200 dark:border-slate-700';

  if (log.type_evenement === 'PRICE_CHANGE') {
    Icon = Activity; color = 'text-blue-600 dark:text-blue-400'; bg = 'bg-blue-50 dark:bg-blue-500/10'; borderColor = 'border-blue-200 dark:border-blue-500/30';
  } else if (log.type_evenement === 'STOCK_IN' || log.type_evenement === 'STOCK_OUT') {
    Icon = ArrowRightLeft; color = 'text-emerald-600 dark:text-emerald-400'; bg = 'bg-emerald-50 dark:bg-emerald-500/10'; borderColor = 'border-emerald-200 dark:border-emerald-500/30';
  } else if (log.type_evenement === 'SALE_CANCEL') {
    Icon = ShieldAlert; color = 'text-red-600 dark:text-red-400'; bg = 'bg-red-50 dark:bg-red-500/10'; borderColor = 'border-red-200 dark:border-red-500/30';
  } else if (log.type_evenement === 'EXPIRE_ALERT') {
    Icon = AlertTriangle; color = 'text-amber-600 dark:text-amber-400'; bg = 'bg-amber-50 dark:bg-amber-500/10'; borderColor = 'border-amber-200 dark:border-amber-500/30';
  }

  let fullData = {};
  if (log.full_data) {
    try {
      fullData = JSON.parse(log.full_data);
    } catch(e) { console.error('Error parsing full_data', e); }
  }

  const hasDetails = Object.keys(fullData).length > 0;

  return (
    <div className={`rounded-xl border ${borderColor} bg-white/60 dark:bg-slate-800/60 transition-all duration-200 overflow-hidden ${open ? 'shadow-md dark:shadow-lg bg-white dark:bg-slate-800' : ''}`}>
      <button
        className="w-full flex items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors text-left"
        onClick={() => { if (hasDetails) setOpen(!open); }}
      >
        <div className={`p-2.5 rounded-lg ${bg} mr-4 shrink-0`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-0.5">
            <span className={`font-bold text-sm ${color}`}>{log.type_evenement.replace(/_/g, ' ')}</span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 shadow-sm">{log.date_evenement}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{log.details}</p>
        </div>
        {hasDetails && (
          <div className={`ml-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
            <ChevronRight size={18} />
          </div>
        )}
      </button>

      {open && hasDetails && (
        <div className={`px-4 pb-4 border-t ${borderColor} pt-3 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/20 animate-fade-in`}>
          {Object.entries(fullData).map(([key, value], idx) => {
             const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
             return <DetailBlock key={idx} label={label} value={value} />;
          })}
        </div>
      )}
    </div>
  );
}

export default function Journal() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await query('SELECT * FROM journal_audit ORDER BY id DESC LIMIT 100');
        setLogs(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="flex flex-col h-full glass-card p-6">
      <div className="mb-6 flex justify-between items-end border-b border-slate-200 dark:border-slate-700/50 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center">
            <Clock className="mr-3 text-cyan-600 dark:text-cyan-400" /> Journal d'Audit & Traçabilité
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">Historique des 100 derniers événements. Cliquez sur un événement pour afficher ses détails complets.</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 font-medium">
            Aucun événement enregistré.
          </div>
        ) : (
          logs.map(log => <AuditCard key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}
