import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Search, Trash2, CheckCircle } from 'lucide-react';
import query from '../utils/db';
import { playClick, playSuccess, playDelete, playError } from '../utils/sounds';

const FCFA = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

const CATEGORIES = ['Électricité', 'Transport', 'Fournitures', 'Salaire', 'Loyer', 'Internet', 'Autre'];

export default function Depenses() {
  const [depenses, setDepenses] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ objet: '', raison: '', categorie_depense: 'Électricité', somme: '' });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errors, setErrors] = useState({});

  const fetchDepenses = async () => {
    try {
      const data = await query('SELECT * FROM depenses ORDER BY id DESC');
      setDepenses(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDepenses();
  }, []);

  const validate = () => {
    const e = {};
    if (!form.objet.trim()) e.objet = 'Champ requis';
    if (!form.somme || isNaN(form.somme) || Number(form.somme) <= 0) e.somme = 'Montant invalide';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { 
      setErrors(e); 
      playError();
      return; 
    }
    setErrors({});
    setSaving(true);
    
    try {
      const dateNow = new Date().toLocaleString('fr-FR');
      await query(
        'INSERT INTO depenses (objet, raison, categorie_depense, somme, date_depense) VALUES (?, ?, ?, ?, ?)',
        [form.objet, form.raison, form.categorie_depense, parseFloat(form.somme), dateNow]
      );
      playSuccess();
      setForm({ objet: '', raison: '', categorie_depense: 'Électricité', somme: '' });
      setSuccessMsg(true);
      fetchDepenses();
      setTimeout(() => setSuccessMsg(false), 2500);
    } catch (err) {
      console.error(err);
      playError();
      alert('Erreur lors de l\'enregistrement de la dépense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Supprimer cette dépense ?')) {
      try {
        await query('DELETE FROM depenses WHERE id = ?', [id]);
        playDelete();
        fetchDepenses();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const filtered = depenses.filter(d =>
    d.objet.toLowerCase().includes(search.toLowerCase()) ||
    d.categorie_depense.toLowerCase().includes(search.toLowerCase())
  );

  const totalMois = depenses.reduce((s, d) => s + d.somme, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Formulaire */}
      <div className="lg:col-span-1 glass-card p-6 flex flex-col">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center mb-6">
          <Plus className="mr-2 text-rose-500" /> Nouvelle Dépense
        </h3>

        <div className="space-y-4 flex-1">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Objet <span className="text-rose-500">*</span></label>
            <input
              type="text"
              className={`w-full bg-white dark:bg-slate-800 border rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 outline-none transition-all ${errors.objet ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'}`}
              placeholder="Ex: Achat fournitures"
              value={form.objet}
              onChange={(e) => setForm({ ...form, objet: e.target.value })}
            />
            {errors.objet && <p className="text-red-500 text-xs mt-1">{errors.objet}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Raison / Détails</label>
            <textarea
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 outline-none h-20 resize-none"
              placeholder="Détails de la dépense..."
              value={form.raison}
              onChange={(e) => setForm({ ...form, raison: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Catégorie</label>
            <select
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 outline-none"
              value={form.categorie_depense}
              onChange={(e) => setForm({ ...form, categorie_depense: e.target.value })}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Somme (FCFA) <span className="text-rose-500">*</span></label>
            <input
              type="number"
              className={`w-full bg-white dark:bg-slate-800 border rounded-lg p-2.5 text-slate-800 dark:text-slate-100 font-bold text-lg focus:ring-2 focus:ring-rose-500 outline-none transition-all ${errors.somme ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'}`}
              placeholder="0"
              value={form.somme}
              onChange={(e) => setForm({ ...form, somme: e.target.value })}
            />
            {errors.somme && <p className="text-red-500 text-xs mt-1">{errors.somme}</p>}
          </div>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl p-3 text-sm font-medium mt-4 animate-fade-in">
            <CheckCircle size={16} /> Dépense enregistrée avec succès !
          </div>
        )}

        <button
          type="button"
          onClick={() => { playClick(); handleSubmit(); }}
          disabled={saving}
          className="mt-4 w-full py-3 bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400 text-white rounded-xl font-bold shadow-lg shadow-rose-500/30 transition-all disabled:opacity-60 active:scale-95"
        >
          {saving ? 'Enregistrement...' : '💾 Enregistrer la dépense'}
        </button>
      </div>

      {/* Historique */}
      <div className="lg:col-span-2 glass-card p-6 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center">
              <Receipt className="mr-2 text-rose-500" /> Historique des Dépenses
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total enregistré : <span className="text-rose-600 dark:text-rose-400 font-bold">{FCFA(totalMois)}</span></p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 outline-none shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-xs uppercase text-slate-500 dark:text-slate-400 sticky top-0">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Objet</th>
                <th className="px-4 py-3 font-bold">Catégorie</th>
                <th className="px-4 py-3 text-right font-bold">Montant</th>
                <th className="px-4 py-3 text-center rounded-tr-lg font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Aucune dépense trouvée</td></tr>
              ) : filtered.map(d => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{d.date_depense}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{d.objet}</p>
                    {d.raison && <p className="text-xs text-slate-500 mt-0.5">{d.raison}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{d.categorie_depense}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-extrabold text-rose-600 dark:text-rose-400">{FCFA(d.somme)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => { playClick(); handleDelete(d.id); }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
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
