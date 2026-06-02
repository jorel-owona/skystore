import React, { useState, useEffect } from 'react';
import { Download, Printer, Filter, Search, AlertTriangle } from 'lucide-react';
import query from '../utils/db';
import { playClick } from '../utils/sounds';

const FCFA = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

export default function Inventaire() {
  const [search, setSearch] = useState('');
  const [inventory, setInventory] = useState([]);
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const data = await query(`
          SELECT 
            p.id, p.nom, p.fournisseur, c.nom as categorie, p.quantite_stock as stock,
            COALESCE(SUM(dv.quantite), 0) as qte_sortie
          FROM produits p
          LEFT JOIN categories c ON p.categorie_id = c.id
          LEFT JOIN details_ventes dv ON p.id = dv.item_id AND dv.type_item = 'Produit'
          GROUP BY p.id
          ORDER BY p.nom ASC
        `);
        
        // Calculate Qte Entree based on current stock + total sold
        const mappedData = (data || []).map(item => ({
          ...item,
          categorie: item.categorie || 'Non Catégorisé',
          fournisseur: item.fournisseur || 'Inconnu',
          qte_entree: item.stock + item.qte_sortie
        }));
        
        setInventory(mappedData);
      } catch (err) {
        console.error(err);
      }
    };
    fetchInventory();
  }, []);

  const filteredInventory = inventory.filter(item =>
    item.nom.toLowerCase().includes(search.toLowerCase()) ||
    item.categorie.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrint = () => {
    playClick();
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 300);
  };

  const handleExportExcel = async () => {
    playClick();
    setExporting(true);
    try {
      // Génération CSV (compatible Excel)
      const headers = ['ID', 'Nom du Produit', 'Fournisseur', 'Catégorie', 'Qté Entrée', 'Qté Sortie', 'Stock Actuel', 'Statut'];
      const rows = filteredInventory.map(item => [
        item.id, item.nom, item.fournisseur, item.categorie,
        item.qte_entree, item.qte_sortie, item.stock,
        item.stock <= 10 ? 'Stock Bas' : 'Normal'
      ]);
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(';'))
        .join('\n');
      const BOM = '\uFEFF'; // UTF-8 BOM pour Excel
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventaire_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erreur export: ' + e.message);
    }
    setExporting(false);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between glass-card p-4">
        <div className="flex items-center space-x-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              placeholder="Rechercher dans l'inventaire..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500 transition-colors shadow-sm">
            <Filter size={18} />
          </button>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-blue-400 hover:text-blue-500 transition-all disabled:opacity-50 shadow-sm"
          >
            <Printer size={18} />
            <span className="text-sm font-bold">{printing ? 'Impression...' : "Imprimer l'état"}</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600/40 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-600/30 hover:border-emerald-500 transition-all disabled:opacity-50 shadow-sm font-bold"
          >
            <Download size={18} />
            <span className="text-sm">{exporting ? 'Export...' : 'Export Excel (CSV)'}</span>
          </button>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Total Produits</p>
          <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{filteredInventory.length}</p>
        </div>
        <div className="glass-card !bg-red-50 dark:!bg-red-500/10 !border-red-200 dark:!border-red-500/20 p-4 text-center">
          <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wider font-bold flex items-center justify-center gap-1 mb-1"><AlertTriangle size={14} />Stock Bas</p>
          <p className="text-3xl font-black text-red-600 dark:text-red-400">{filteredInventory.filter(i => i.stock <= 10).length}</p>
        </div>
        <div className="glass-card !bg-emerald-50 dark:!bg-emerald-500/10 !border-emerald-200 dark:!border-emerald-500/20 p-4 text-center">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-bold mb-1">Stock Normal</p>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{filteredInventory.filter(i => i.stock > 10).length}</p>
        </div>
      </div>

      <div className="flex-1 glass-card overflow-hidden flex flex-col" id="inventory-table-container">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-bold">Nom du Produit</th>
                <th className="px-6 py-4 font-bold">Fournisseur</th>
                <th className="px-6 py-4 font-bold">Catégorie</th>
                <th className="px-6 py-4 font-bold text-center">Qté Entrée</th>
                <th className="px-6 py-4 font-bold text-center">Qté Sortie</th>
                <th className="px-6 py-4 font-bold text-center">Stock Actuel</th>
                <th className="px-6 py-4 font-bold text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50 text-sm">
              {filteredInventory.length === 0 ? (
                 <tr><td colSpan={7} className="text-center py-8 text-slate-500 font-medium">Aucun produit dans l'inventaire</td></tr>
              ) : filteredInventory.map((item) => (
                <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-slate-700 dark:text-slate-300 ${item.stock <= 10 ? 'bg-red-50 dark:bg-red-500/5' : ''}`}>
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{item.nom}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{item.fournisseur}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-semibold">{item.categorie}</span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-blue-600 dark:text-slate-400">{item.qte_entree}</td>
                  <td className="px-6 py-4 text-center font-bold text-orange-500 dark:text-slate-400">{item.qte_sortie}</td>
                  <td className={`px-6 py-4 text-center font-black text-xl ${item.stock <= 10 ? 'text-red-500 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>{item.stock}</td>
                  <td className="px-6 py-4 text-center">
                    {item.stock <= 10 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20">
                        <AlertTriangle size={12} /> Stock Bas
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                        Normal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
