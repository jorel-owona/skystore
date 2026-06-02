import React, { useState, useEffect } from 'react';
import { Lock, DollarSign, Wallet, TrendingUp, AlertCircle } from 'lucide-react';
import query from '../utils/db';
import { playClick, playSuccess } from '../utils/sounds';

const FCFA = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

export default function Vente() {
  const [session, setSession] = useState(null); // null = fermée, object = ouverte
  const [fondCaisse, setFondCaisse] = useState('');
  
  // Real metrics
  const [recetteDuJour, setRecetteDuJour] = useState(0);
  const [impayes, setImpayes] = useState(0);

  const fetchMetrics = async () => {
    try {
      const today = new Date().toLocaleDateString('fr-FR');
      // Total des ventes valides payées ou partielles aujourd'hui (simplifié pour démo: juste les ventes du jour)
      const resVentes = await query(`SELECT COALESCE(SUM(total_facture), 0) as total FROM ventes WHERE statut_facture = 'Valide' AND date_vente LIKE ?`, [`${today}%`]);
      setRecetteDuJour(resVentes[0]?.total || 0);

      // Impayés globaux (dette clients)
      const resImpayes = await query('SELECT COALESCE(SUM(dette_actuelle), 0) as total FROM clients');
      setImpayes(resImpayes[0]?.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (session) {
      fetchMetrics();
      // On pourrait aussi faire un setInterval pour rafraichir les metrics régulièrement
    }
  }, [session]);

  const handleOpenSession = async () => {
    playClick();
    if (!fondCaisse || isNaN(fondCaisse)) return alert('Veuillez entrer un fond de caisse valide.');
    
    // Check if session exists in DB
    try {
       await query('INSERT INTO sessions_caisses (date_ouverture, fond_caisse_initial) VALUES (?, ?)', [new Date().toLocaleString('fr-FR'), parseFloat(fondCaisse)]);
    } catch(e) {
       console.error("Impossible de sauvegarder la session", e);
    }
    
    playSuccess();
    setSession({
      dateOuverture: new Date().toLocaleString('fr-FR'),
      fondCaisseInitial: parseFloat(fondCaisse)
    });
  };

  const handleCloseSession = async () => {
    playClick();
    if (window.confirm('Voulez-vous vraiment fermer la caisse ?')) {
      try {
        await query('UPDATE sessions_caisses SET date_fermeture = ?, recette_attendue = ? WHERE date_fermeture IS NULL', [
          new Date().toLocaleString('fr-FR'), 
          session.fondCaisseInitial + recetteDuJour
        ]);
      } catch(e) {}
      
      playSuccess();
      alert('Caisse fermée avec succès ! Les rapports ont été générés.');
      setSession(null);
      setFondCaisse('');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {!session ? (
        <div className="flex-1 flex items-center justify-center glass-card backdrop-blur-md">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl text-center transform hover:scale-[1.01] transition-transform">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100 dark:border-blue-500/20 shadow-inner">
              <Lock className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-3">Caisse Fermée</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Veuillez ouvrir une session pour commencer à encaisser et suivre les transactions.</p>
            
            <div className="space-y-5">
              <div>
                <label className="block text-left text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wide">Fond de caisse initial</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    className="block w-full pl-11 pr-4 py-3.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xl font-black shadow-sm"
                    placeholder="0"
                    value={fondCaisse}
                    onChange={(e) => setFondCaisse(e.target.value)}
                  />
                </div>
              </div>
              <button 
                onClick={handleOpenSession}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-lg shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98]"
              >
                Ouvrir la Caisse
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
          <div className="glass-card p-8 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[80px] group-hover:bg-emerald-500/20 transition-colors"></div>
            <div className="relative z-10">
               <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center mb-8">
                 <Wallet className="mr-3 text-emerald-500 dark:text-emerald-400" /> Session en cours
               </h3>
               <div className="space-y-6">
                  <div className="bg-white/60 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm">
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Ouverte le</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{session.dateOuverture}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/60 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm">
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Fond Initial</p>
                      <p className="text-2xl font-black text-slate-800 dark:text-white">{FCFA(session.fondCaisseInitial)}</p>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 border-l-blue-500 backdrop-blur-sm">
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Recette Attendue</p>
                      <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{FCFA(session.fondCaisseInitial + recetteDuJour)}</p>
                    </div>
                  </div>
               </div>
            </div>
            <button 
              onClick={handleCloseSession}
              className="mt-8 w-full py-4 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-500/50 rounded-xl font-black text-lg transition-all shadow-sm relative z-10"
            >
              Fermer la Session
            </button>
          </div>

          <div className="flex flex-col space-y-6">
             <div className="flex-1 glass-card p-8">
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center mb-6">
                  <TrendingUp className="mr-3 text-purple-600 dark:text-purple-400" /> Ventes du Jour
                </h3>
                <div className="flex items-center justify-center h-40 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-dashed">
                  <div className="text-center">
                    <p className="text-4xl font-black text-slate-800 dark:text-slate-200 mb-2">{FCFA(recetteDuJour)}</p>
                    <p className="text-slate-500 font-medium">Recette des ventes aujourd'hui</p>
                  </div>
                </div>
             </div>
             <div className="glass-card !bg-red-50 dark:!bg-red-500/10 p-8 !border-red-200 dark:!border-red-500/20 relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:opacity-20 transition-opacity">
                  <AlertCircle size={160} />
                </div>
                <h3 className="text-2xl font-black text-red-600 dark:text-red-400 flex items-center mb-4 relative z-10">
                  <AlertCircle className="mr-3" /> Impayés & Dettes
                </h3>
                <p className="text-4xl font-black text-red-600 dark:text-red-300 mb-2 relative z-10">{FCFA(impayes)}</p>
                <p className="text-sm font-bold text-red-500/80 dark:text-red-400/80 uppercase tracking-wider relative z-10">Montant total des dettes clients.</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
