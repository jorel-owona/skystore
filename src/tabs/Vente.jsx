import React, { useState, useEffect } from 'react';
import { Lock, DollarSign, Wallet, TrendingUp, AlertCircle, Printer, X, Check } from 'lucide-react';
import query from '../utils/db';
import { playClick, playSuccess, playError } from '../utils/sounds';

const FCFA = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

const parseDate = (str) => {
  if (!str) return new Date(0);
  const cleanStr = str.replace(',', '');
  const [datePart, timePart] = cleanStr.split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  if (!timePart) return new Date(year, month - 1, day);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
};

export default function Vente({ activeSession, refreshSession }) {
  const [fondCaisse, setFondCaisse] = useState('');
  const [recetteDuJour, setRecetteDuJour] = useState(0);
  const [impayes, setImpayes] = useState(0);

  // Configuration Imprimantes
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(localStorage.getItem('selected_printer') || '');

  // Fermeture caisse modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [zReportData, setZReportData] = useState(null);

  // Charger la liste des imprimantes
  useEffect(() => {
    if (window.api && window.api.getPrinters) {
      window.api.getPrinters().then(list => {
        setPrinters(list || []);
      });
    }
  }, []);

  // Pré-remplir le fond de caisse avec le montant réel de la dernière fermeture
  useEffect(() => {
    const fetchLastClosingCash = async () => {
      try {
        const res = await query('SELECT recette_reelle FROM sessions_caisses WHERE date_fermeture IS NOT NULL ORDER BY id DESC LIMIT 1');
        if (res && res.length > 0 && res[0].recette_reelle !== null) {
          setFondCaisse(res[0].recette_reelle.toString());
        }
      } catch (err) {
        console.error(err);
      }
    };
    if (!activeSession) {
      fetchLastClosingCash();
    }
  }, [activeSession]);

  const fetchMetrics = async () => {
    try {
      if (!activeSession) return;
      
      // Récupérer toutes les ventes valides et filtrer par rapport au début de session
      const allSales = await query("SELECT * FROM ventes WHERE statut_facture = 'Valide'");
      const sessionStart = parseDate(activeSession.dateOuverture);
      const activeSales = allSales.filter(s => parseDate(s.date_vente) >= sessionStart);
      const totalSales = activeSales.reduce((s, val) => s + val.total_facture, 0);
      
      setRecetteDuJour(totalSales);

      // Impayés globaux (dette clients)
      const resImpayes = await query('SELECT COALESCE(SUM(dette_actuelle), 0) as total FROM clients');
      setImpayes(resImpayes[0]?.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeSession) {
      fetchMetrics();
    }
  }, [activeSession]);

  const handleOpenSession = async () => {
    playClick();
    if (!fondCaisse || isNaN(fondCaisse)) return alert('Veuillez entrer un fond de caisse valide.');
    
    try {
      await query('INSERT INTO sessions_caisses (date_ouverture, fond_caisse_initial) VALUES (?, ?)', [
        new Date().toLocaleString('fr-FR'), 
        parseFloat(fondCaisse)
      ]);
      playSuccess();
      if (refreshSession) await refreshSession();
    } catch(e) {
      console.error("Impossible de sauvegarder la session", e);
      playError();
    }
  };

  const handleCloseSession = () => {
    playClick();
    // Proposer par défaut le montant attendu
    setCountedCash((activeSession.fondCaisseInitial + recetteDuJour).toString());
    setShowCloseModal(true);
  };

  const confirmCloseSession = async () => {
    const realCash = parseFloat(countedCash);
    if (isNaN(realCash) || realCash < 0) {
      playError();
      return alert('Veuillez entrer un montant réel valide.');
    }

    try {
      const nowStr = new Date().toLocaleString('fr-FR');
      const expectedCash = activeSession.fondCaisseInitial + recetteDuJour;

      // Mettre à jour en base de données
      await query('UPDATE sessions_caisses SET date_fermeture = ?, recette_attendue = ?, recette_reelle = ? WHERE date_fermeture IS NULL', [
        nowStr, 
        expectedCash,
        realCash
      ]);

      // Préparer les données pour le Rapport Z d'impression
      const zData = {
        dateOuverture: activeSession.dateOuverture,
        dateFermeture: nowStr,
        fondCaisseInitial: activeSession.fondCaisseInitial,
        recetteAttendue: expectedCash,
        recetteReelle: realCash,
        ecart: realCash - expectedCash,
        recetteDuJour: recetteDuJour
      };

      setZReportData(zData);

      // Imprimer le rapport Z
      setTimeout(async () => {
        const activePrinter = selectedPrinter || 'XP-80C';
        if (window.api && window.api.printTicketRaw) {
          try {
            const printData = {
              isZReport: true,
              shopName: 'SKYSTORE',
              date: nowStr,
              dateOuverture: activeSession.dateOuverture,
              dateFermeture: nowStr,
              fondCaisseInitial: FCFA(activeSession.fondCaisseInitial),
              recetteAttendue: FCFA(expectedCash),
              recetteReelle: FCFA(realCash),
              ecart: FCFA(realCash - expectedCash),
              recetteDuJour: FCFA(recetteDuJour)
            };
            await window.api.printTicketRaw(printData, activePrinter);
          } catch (err) {
            console.error("Échec impression Rapport Z brute, fallback standard:", err);
            window.print();
          }
        } else {
          window.print();
        }

        setShowCloseModal(false);
        setZReportData(null);
        if (refreshSession) await refreshSession();
        playSuccess();
        alert('Caisse fermée et Rapport Z imprimé avec succès !');
      }, 500);

    } catch (err) {
      console.error(err);
      playError();
      alert('Erreur lors de la fermeture de la caisse.');
    }
  };

  const handlePrinterChange = (e) => {
    const name = e.target.value;
    setSelectedPrinter(name);
    localStorage.setItem('selected_printer', name);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Session report template for printing (visible only in print media) */}
      {zReportData && (
        <div id="session-report" className="hidden print-ticket bg-white text-black w-80 p-6 font-mono text-xs relative">
          <div className="text-center mb-4">
            <div className="text-lg font-black uppercase tracking-wider">SKYSTORE POS</div>
            <div className="text-xs font-bold text-gray-500 mt-1">RAPPORT DE CLÔTURE (RAPPORT Z)</div>
            <div className="border-t-2 border-dashed border-gray-300 my-3" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Ouverture:</span>
              <span className="font-bold">{zReportData.dateOuverture}</span>
            </div>
            <div className="flex justify-between">
              <span>Fermeture:</span>
              <span className="font-bold">{zReportData.dateFermeture}</span>
            </div>
            <div className="border-t border-gray-200 my-2" />
            <div className="flex justify-between">
              <span>Fond de Caisse Initial:</span>
              <span className="font-bold">{FCFA(zReportData.fondCaisseInitial)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ventes de la journée:</span>
              <span className="font-bold">{FCFA(zReportData.recetteDuJour)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-gray-200 pt-1">
              <span>Montant Attendu:</span>
              <span>{FCFA(zReportData.recetteAttendue)}</span>
            </div>
            <div className="flex justify-between font-bold border-b border-gray-200 pb-1">
              <span>Montant Réel Saisi:</span>
              <span>{FCFA(zReportData.recetteReelle)}</span>
            </div>
            <div className={`flex justify-between font-bold ${zReportData.ecart >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <span>Écart de caisse:</span>
              <span>{FCFA(zReportData.ecart)}</span>
            </div>
          </div>
          <div className="border-t-2 border-dashed border-gray-300 my-4" />
          <div className="text-center text-xs text-gray-500 font-bold">
            *** FIN DU RAPPORT DE SESSION ***
          </div>
        </div>
      )}

      {!activeSession ? (
        <div className="flex-1 flex items-center justify-center glass-card backdrop-blur-md">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl text-center transform hover:scale-[1.01] transition-transform">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-500/20 shadow-inner">
              <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">Caisse Fermée</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-xs font-medium">Veuillez ouvrir une session pour commencer à encaisser et suivre les transactions.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-left text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wide">Fond de caisse initial</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    className="block w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-lg font-black shadow-sm"
                    placeholder="0"
                    value={fondCaisse}
                    onChange={(e) => setFondCaisse(e.target.value)}
                  />
                </div>
              </div>
              <button 
                onClick={handleOpenSession}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-base shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98]"
              >
                Ouvrir la Caisse
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
          <div className="glass-card p-6 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[80px] group-hover:bg-emerald-500/20 transition-colors"></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
               <div>
                 <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center mb-6">
                   <Wallet className="mr-2.5 text-emerald-500 dark:text-emerald-400" /> Session en cours
                 </h3>
                 <div className="space-y-4">
                    <div className="bg-white/60 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Ouverte le</p>
                      <p className="text-base font-bold text-slate-800 dark:text-slate-200">{activeSession.dateOuverture}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/60 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Fond Initial</p>
                        <p className="text-lg font-black text-slate-800 dark:text-white">{FCFA(activeSession.fondCaisseInitial)}</p>
                      </div>
                      <div className="bg-white/60 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 border-l-blue-500 backdrop-blur-sm">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Recette Attendue</p>
                        <p className="text-lg font-black text-blue-600 dark:text-blue-400">{FCFA(activeSession.fondCaisseInitial + recetteDuJour)}</p>
                      </div>
                    </div>
                 </div>
               </div>

               {/* Section Sélection d'Imprimante */}
               <div className="bg-white/60 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm mt-4">
                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Imprimante de Ticket</label>
                 <select
                   className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                   value={selectedPrinter}
                   onChange={handlePrinterChange}
                 >
                   <option value="">🖨 Imprimante système par défaut</option>
                   {printers.map(p => (
                     <option key={p.name} value={p.name}>
                       {p.name} {p.isDefault ? '(Par défaut)' : ''}
                     </option>
                   ))}
                 </select>
               </div>

               <button 
                 onClick={handleCloseSession}
                 className="mt-6 w-full py-3 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-500/50 rounded-xl font-black text-base transition-all shadow-sm relative z-10"
               >
                 Fermer la Session & Imprimer Z-Report
               </button>
            </div>
          </div>

          <div className="flex flex-col space-y-6">
             <div className="flex-1 glass-card p-6">
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center mb-4">
                  <TrendingUp className="mr-2 text-purple-600 dark:text-purple-400" /> Ventes du Jour
                </h3>
                <div className="flex items-center justify-center h-32 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-slate-200 dark:border-slate-700 border-dashed">
                  <div className="text-center">
                    <p className="text-3xl font-black text-slate-800 dark:text-slate-200 mb-1">{FCFA(recetteDuJour)}</p>
                    <p className="text-xs text-slate-500 font-medium">Recette de la session courante</p>
                  </div>
                </div>
             </div>
             <div className="glass-card !bg-red-50 dark:!bg-red-500/10 p-6 !border-red-200 dark:!border-red-500/20 relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                  <AlertCircle size={120} />
                </div>
                <h3 className="text-xl font-black text-red-600 dark:text-red-400 flex items-center mb-3 relative z-10">
                  <AlertCircle className="mr-2" /> Impayés & Dettes
                </h3>
                <p className="text-3xl font-black text-red-600 dark:text-red-300 mb-1 relative z-10">{FCFA(impayes)}</p>
                <p className="text-xs font-bold text-red-500/80 dark:text-red-400/80 uppercase tracking-wider relative z-10">Dettes clients cumulées globales.</p>
             </div>
          </div>
        </div>
      )}

      {/* Modal Fermeture Caisse (Saisie Recette Réelle) */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Fermeture de la Caisse</h3>
              <button onClick={() => setShowCloseModal(false)} className="p-1.5 bg-slate-200 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3 rounded-xl">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>Fond initial :</span>
                  <span className="font-bold">{FCFA(activeSession.fondCaisseInitial)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mt-1">
                  <span>Ventes de la journée :</span>
                  <span className="font-bold">{FCFA(recetteDuJour)}</span>
                </div>
                <div className="border-t border-blue-200 dark:border-blue-500/20 my-2" />
                <div className="flex justify-between text-sm font-bold text-blue-600 dark:text-blue-400">
                  <span>Montant Attendu :</span>
                  <span>{FCFA(activeSession.fondCaisseInitial + recetteDuJour)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Espèces réelles dans le tiroir *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    required
                    className="block w-full pl-9 pr-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all font-bold"
                    placeholder="0"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex gap-3">
              <button 
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={confirmCloseSession}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex justify-center items-center gap-1.5 shadow-md transition-colors"
              >
                <Check size={14} /> Fermer & Imprimer Z
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
