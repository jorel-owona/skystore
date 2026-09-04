import React, { useState, useEffect } from 'react';
import { Wrench, Plus, Search, Phone, FileText, CheckCircle, Clock, AlertCircle, MessageSquare, Printer, Trash2 } from 'lucide-react';
import query from '../utils/db';
import { playClick } from '../utils/sounds';

export default function Sav({ addToast }) {
  const [tickets, setTickets] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('Tous');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulaire nouveau ticket S.A.V
  const [form, setForm] = useState({
    client_id: '',
    client_nom: '',
    telephone: '',
    article_nom: '',
    numero_serie: '',
    description_panne: '',
    cout_estime: '',
    date_livraison_prevue: '',
    notes: ''
  });

  useEffect(() => {
    loadSavData();
    loadClients();
  }, []);

  const loadSavData = async () => {
    try {
      const data = await query('SELECT * FROM sav_tickets ORDER BY id DESC');
      setTickets(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadClients = async () => {
    try {
      const data = await query('SELECT * FROM clients ORDER BY nom ASC');
      setClients(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.article_nom || !form.client_nom) return;

    try {
      const now = new Date().toISOString().slice(0, 10);
      await query(
        `INSERT INTO sav_tickets (client_id, client_nom, telephone, article_nom, numero_serie, description_panne, cout_estime, date_reception, date_livraison_prevue, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          form.client_id || null,
          form.client_nom,
          form.telephone,
          form.article_nom,
          form.numero_serie,
          form.description_panne,
          parseFloat(form.cout_estime) || 0,
          now,
          form.date_livraison_prevue || null,
          form.notes
        ]
      );
      playClick();
      setIsModalOpen(false);
      setForm({
        client_id: '',
        client_nom: '',
        telephone: '',
        article_nom: '',
        numero_serie: '',
        description_panne: '',
        cout_estime: '',
        date_livraison_prevue: '',
        notes: ''
      });
      loadSavData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id, newStatut) => {
    try {
      await query('UPDATE sav_tickets SET statut = ? WHERE id = ?', [newStatut, id]);
      playClick();
      loadSavData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette fiche S.A.V ?')) return;
    try {
      await query('DELETE FROM sav_tickets WHERE id = ?', [id]);
      playClick();
      loadSavData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleWhatsAppNotify = (t) => {
    const msg = `Bonjour ${t.client_nom},\nVotre appareil (${t.article_nom} - S/N: ${t.numero_serie || 'N/A'}) sous le ticket S.A.V #${t.id} est actuellement au statut : *${t.statut}*.\nSKYSTORE vous remercie de votre confiance.`;
    if (window.api && window.api.openWhatsApp) {
      window.api.openWhatsApp(t.telephone, msg);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchSearch =
      t.client_nom.toLowerCase().includes(search.toLowerCase()) ||
      t.article_nom.toLowerCase().includes(search.toLowerCase()) ||
      (t.numero_serie && t.numero_serie.toLowerCase().includes(search.toLowerCase())) ||
      (t.telephone && t.telephone.includes(search));
    const matchStatut = filterStatut === 'Tous' || t.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const getStatusBadge = (statut) => {
    switch (statut) {
      case 'Reçu': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'En Diagnostic': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'En Réparation': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'Prêt': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'Livré': return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center liquid-card p-6 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center space-x-3">
            <Wrench className="text-blue-600 dark:text-blue-400" size={28} />
            <span>Gestion S.A.V & Réparations (IMEI)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Suivi des dépôts matériels, pièces et statut de réparation
          </p>
        </div>

        <button
          onClick={() => {
            playClick();
            setIsModalOpen(true);
          }}
          className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center space-x-2 shadow-lg shadow-blue-600/30"
        >
          <Plus size={20} />
          <span>Nouvelle Fiche S.A.V</span>
        </button>
      </div>

      {/* Barre de recherche et filtres de statut */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher par client, article, IMEI ou numéro de téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {['Tous', 'Reçu', 'En Diagnostic', 'En Réparation', 'Prêt', 'Livré'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatut(st)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition border ${
                filterStatut === st
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Grille / Liste des fiches S.A.V */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTickets.map(t => (
          <div
            key={t.id}
            className="liquid-card liquid-glass-3d p-6 flex flex-col justify-between relative space-y-4"
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-black text-blue-600 dark:text-blue-400">#SAV-{t.id}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${getStatusBadge(t.statut)}`}>
                  {t.statut}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t.article_nom}</h3>
              {t.numero_serie && (
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                  IMEI/SN: <span className="font-semibold text-slate-700 dark:text-slate-300">{t.numero_serie}</span>
                </p>
              )}

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center space-x-1.5">
                  <span>Client:</span>
                  <span className="font-bold">{t.client_nom}</span>
                  {t.telephone && <span className="text-slate-400">({t.telephone})</span>}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-rose-500">Panne:</span> {t.description_panne}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex justify-between items-center text-xs mb-3">
                <span className="text-slate-500">Coût estimé:</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                  {t.cout_estime ? `${t.cout_estime.toLocaleString('fr-FR')} FCFA` : 'Sur Devis'}
                </span>
              </div>

              {/* Actions de changement de statut */}
              <div className="flex items-center space-x-2">
                <select
                  value={t.statut}
                  onChange={(e) => handleUpdateStatus(t.id, e.target.value)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold p-2 text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="Reçu">Reçu</option>
                  <option value="En Diagnostic">En Diagnostic</option>
                  <option value="En Réparation">En Réparation</option>
                  <option value="Prêt">Prêt</option>
                  <option value="Livré">Livré</option>
                </select>

                {t.telephone && (
                  <button
                    onClick={() => handleWhatsAppNotify(t)}
                    className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition"
                    title="Informer le client sur WhatsApp"
                  >
                    <MessageSquare size={18} />
                  </button>
                )}

                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition"
                  title="Supprimer la fiche"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Création Ticket S.A.V */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <Wrench className="text-blue-600" size={24} />
              <span>Créer une nouvelle fiche S.A.V</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nom Client</label>
                  <input
                    type="text"
                    required
                    value={form.client_nom}
                    onChange={(e) => setForm({ ...form, client_nom: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
                    placeholder="Ex: Jean Dupont"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={form.telephone}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
                    placeholder="Ex: 699000000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nom de l'Appareil</label>
                  <input
                    type="text"
                    required
                    value={form.article_nom}
                    onChange={(e) => setForm({ ...form, article_nom: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
                    placeholder="Ex: Samsung S21 / PC Dell"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Numéro IMEI / Série</label>
                  <input
                    type="text"
                    value={form.numero_serie}
                    onChange={(e) => setForm({ ...form, numero_serie: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none font-mono"
                    placeholder="Ex: 354890123456789"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Description de la Panne</label>
                <textarea
                  required
                  rows={2}
                  value={form.description_panne}
                  onChange={(e) => setForm({ ...form, description_panne: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
                  placeholder="Ex: Écran cassé, le téléphone ne s'allume plus..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Coût estimé (FCFA)</label>
                  <input
                    type="number"
                    value={form.cout_estime}
                    onChange={(e) => setForm({ ...form, cout_estime: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
                    placeholder="Ex: 15000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Date Livraison Prévue</label>
                  <input
                    type="date"
                    value={form.date_livraison_prevue}
                    onChange={(e) => setForm({ ...form, date_livraison_prevue: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition shadow-lg shadow-blue-600/30"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
