import React, { useState, useEffect } from 'react';
import { Search, Printer, Trash2, CheckCircle, XCircle, Eye, X, AlertTriangle } from 'lucide-react';
import query from '../utils/db';
import { playClick, playDelete, playSuccess, playError } from '../utils/sounds';

const FCFA = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

export default function Factures() {
  const [search, setSearch] = useState('');
  const [factures, setFactures] = useState([]);
  const [previewFac, setPreviewFac] = useState(null);
  const [previewArticles, setPreviewArticles] = useState([]);

  const fetchFactures = async () => {
    try {
      const data = await query(`
        SELECT v.*, c.nom as client_nom 
        FROM ventes v 
        LEFT JOIN clients c ON v.client_id = c.id 
        ORDER BY v.id DESC
      `);
      setFactures(data || []);
    } catch (err) {
      console.error("Erreur lors de la récupération des factures :", err);
    }
  };

  useEffect(() => {
    fetchFactures();
  }, []);

  // Filtrage de recherche
  const filtered = factures.filter(f =>
    String(f.id).toLowerCase().includes(search.toLowerCase()) ||
    (f.client_nom && f.client_nom.toLowerCase().includes(search.toLowerCase())) ||
    (!f.client_nom && 'client en passant'.includes(search.toLowerCase()))
  );

  // Annulation de facture avec restauration automatique des stocks et audit log
  const handleDelete = async (id) => {
    const factureTarget = factures.find(f => f.id === id);
    if (!factureTarget) return;

    if (window.confirm(`Annuler la facture INV-${id} ? Cette action réintégrera les produits en stock et est irréversible.`)) {
      try {
        // 1. Récupérer les articles physiques (produits) liés à cette vente pour restaurer le stock
        const articles = await query(
          "SELECT item_id, quantite FROM details_ventes WHERE vente_id = ? AND type_item = 'Produit'",
          [id]
        );

        // 2. Réintégrer les quantités dans la table produits
        for (const article of articles) {
          await query(
            "UPDATE produits SET quantite_stock = quantite_stock + ? WHERE id = ?",
            [article.quantite, article.item_id]
          );
        }

        // 3. Passer le statut de la facture à 'Supprimée'
        await query("UPDATE ventes SET statut_facture = 'Supprimée' WHERE id = ?", [id]);

        // 4. Écrire dans le Journal d'Audit pour la traçabilité
        const dateEvenement = new Date().toLocaleString('fr-FR');
        const detailsAudit = `Annulation de la facture INV-${id} (Montant: ${FCFA(factureTarget.total_facture)}) par l'administrateur. Restitution de ${articles.length} ligne(s) de produits en stock.`;

        await query(
          "INSERT INTO journal_audit (date_evenement, type_evenement, details, full_data) VALUES (?, ?, ?, ?)",
          [dateEvenement, "ANNULATION_FACTURE", detailsAudit, JSON.stringify({ vente_id: id, articles_restaures: articles })]
        );

        playDelete();
        fetchFactures();
      } catch (err) {
        console.error("Erreur lors de l'annulation de la facture :", err);
        playError();
        alert("Une erreur est survenue lors de l'annulation.");
      }
    }
  };

  const handlePrint = async (fac) => {
    playClick();
    try {
      const articles = await query(`
        SELECT dv.*, 
               CASE WHEN dv.type_item = 'Produit' THEN p.nom ELSE s.nom END as nom
        FROM details_ventes dv
        LEFT JOIN produits p ON dv.item_id = p.id AND dv.type_item = 'Produit'
        LEFT JOIN services s ON dv.item_id = s.id AND dv.type_item = 'Service'
        WHERE dv.vente_id = ?
      `, [fac.id]);

      setPreviewArticles(articles || []);
      setPreviewFac(fac);
    } catch (err) {
      console.error(err);
      playError();
      alert('Erreur lors du chargement des détails.');
    }
  };

  // --- CALCULS DES STATISTIQUES AVEC FILTRES TEMPORELS ---
  const todayStr = new Date().toLocaleDateString('fr-FR');

  const parseFRDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const [datePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Total Jour : Ventes valides effectuées aujourd'hui
  const totalJour = factures
    .filter(f => f.statut_facture === 'Valide' && f.date_vente && f.date_vente.includes(todayStr))
    .reduce((s, f) => s + f.total_facture, 0);

  // Total 30 Jours : Ventes valides des 30 derniers jours
  const total30j = factures
    .filter(f => {
      if (f.statut_facture !== 'Valide' || !f.date_vente) return false;
      const fDate = parseFRDate(f.date_vente);
      return fDate >= thirtyDaysAgo;
    })
    .reduce((s, f) => s + f.total_facture, 0);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Sécurité d'impression : injection de styles CSS media print ciblés */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #ticket-reprint, #ticket-reprint * {
            visibility: visible !important;
          }
          #ticket-reprint {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Header & Stats Cards */}
      <div className="flex justify-between items-center glass-card p-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Gestion des Factures</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Consultez, réimprimez ou annulez les factures émises.</p>
        </div>
        <div className="flex space-x-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-center shadow-sm min-w-[140px]">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Total Jour</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{FCFA(totalJour)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-center shadow-sm min-w-[140px]">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Total 30 Jours</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{FCFA(total30j)}</p>
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="flex-1 glass-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white/40 dark:bg-slate-900/40">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par ID, Client..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-xs uppercase text-slate-500 dark:text-slate-400 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-bold">ID Facture</th>
                <th className="px-6 py-4 font-bold">Client</th>
                <th className="px-6 py-4 font-bold">Date</th>
                <th className="px-6 py-4 font-bold">Paiement</th>
                <th className="px-6 py-4 font-bold text-center">Statut</th>
                <th className="px-6 py-4 font-bold text-right">Montant</th>
                <th className="px-6 py-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500 font-medium">Aucune facture trouvée</td></tr>
              ) : filtered.map((fac) => (
                <tr key={fac.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${fac.statut_facture === 'Supprimée' ? 'opacity-60 bg-red-50/30 dark:bg-red-900/5' : ''}`}>
                  <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-slate-300">INV-{fac.id}</td>
                  <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">{fac.client_nom || 'Client En Passant'}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">{fac.date_vente}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">{fac.moyen_paiement}</td>
                  <td className="px-6 py-4 text-center">
                    {fac.statut_facture === 'Valide' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                        <CheckCircle className="w-3 h-3 mr-1" /> Valide
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20">
                        <XCircle className="w-3 h-3 mr-1" /> Supprimée
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-800 dark:text-slate-200">{FCFA(fac.total_facture)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => handlePrint(fac)}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg transition-all"
                        title="Aperçu & Réimprimer"
                      >
                        <Printer size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(fac.id)}
                        className={`p-2 rounded-lg transition-all ${fac.statut_facture === 'Valide' ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20' : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'}`}
                        disabled={fac.statut_facture !== 'Valide'}
                        title={fac.statut_facture === 'Valide' ? "Annuler la facture" : "Facture déjà annulée"}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal aperçu impression (Ticket de caisse thermique style) */}
      {previewFac && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden transform scale-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center"><Eye className="mr-2 text-blue-500" /> Aperçu — INV-{previewFac.id}</h3>
              <button onClick={() => setPreviewFac(null)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 bg-slate-100 dark:bg-slate-950 flex justify-center max-h-[60vh] overflow-y-auto">
              {/* Conteneur Unique d'Impression isolé par id */}
              <div id="ticket-reprint" className="bg-white text-black w-80 shadow-md p-6 font-mono text-sm relative">
                <div className="absolute top-0 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDAgNSwxMCAxMCwwIiBmaWxsPSIjZjFmNWY5Ii8+PC9zdmc+')] -mt-1"></div>

                <div className="text-center mb-5">
                  <div className="text-2xl font-black uppercase tracking-widest">SKYSTORE</div>
                  <div className="text-xs text-gray-500 mt-1">Duplicata Ticket de Caisse</div>
                  <div className="text-xs text-gray-500 mt-1">{previewFac.date_vente}</div>
                  <div className="border-t-2 border-dashed border-gray-300 my-4" />
                </div>

                <div className="text-xs mb-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ticket N°:</span>
                    <span className="font-bold">INV-{previewFac.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Client:</span>
                    <span className="font-bold">{previewFac.client_nom || 'Client En Passant'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Paiement:</span>
                    <span className="font-bold">{previewFac.moyen_paiement}</span>
                  </div>
                </div>

                <div className="border-t-2 border-dashed border-gray-300 my-3" />

                <table className="w-full text-xs mb-3">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left pb-1">Qté</th>
                      <th className="text-left pb-1">Désignation</th>
                      <th className="text-right pb-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewArticles.map((a, i) => (
                      <tr key={i}>
                        <td className="py-1 font-bold">{a.quantite}x</td>
                        <td className="py-1 pr-2 truncate max-w-[120px]">{a.nom || 'Article'}</td>
                        <td className="py-1 text-right font-bold">{FCFA(a.prix_unitaire_vendu * a.quantite)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t-2 border-dashed border-gray-300 my-3" />

                <div className="flex justify-between items-end mb-4">
                  <span className="font-bold text-sm">TOTAL NET</span>
                  <span className="font-black text-xl">{FCFA(previewFac.total_facture)}</span>
                </div>

                {previewFac.statut_facture === 'Supprimée' && (
                  <div className="text-center font-bold text-red-600 border-2 border-red-600 p-2 my-2 rotate-[-10deg] opacity-70 flex items-center justify-center gap-1">
                    <AlertTriangle size={14} /> ANNULÉE / RESTAURÉE
                  </div>
                )}

                <div className="border-t-2 border-dashed border-gray-300 my-4" />

                <div className="text-center text-xs text-gray-500 font-bold">
                  *** MERCI DE VOTRE VISITE ***
                  <br />DUPLICATA
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDEwIDUsMCAxMCwxMCIgZmlsbD0iI2YxZjVmOSIvPjwvc3ZnPg==')] -mb-1"></div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex gap-4 bg-white dark:bg-slate-900">
              <button onClick={() => setPreviewFac(null)} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors">Fermer</button>
              <button
                onClick={() => { playClick(); window.print(); setPreviewFac(null); }}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Printer size={20} strokeWidth={3} /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}