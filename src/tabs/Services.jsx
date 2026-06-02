import React, { useState, useEffect } from 'react';
import { PenTool, Plus, Edit2, Trash2, X, Check, Search } from 'lucide-react';
import query from '../utils/db';
import { playClick, playSuccess, playDelete } from '../utils/sounds';

const FCFA = (n) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

export default function Services() {
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    id: null,
    nom: '',
    description: '',
    cout_service: ''
  });

  const fetchServices = async () => {
    try {
      const data = await query('SELECT * FROM services ORDER BY id DESC');
      setServices(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleOpenModal = (service = null) => {
    playClick();
    if (service) {
      setIsEditing(true);
      setFormData({
        id: service.id,
        nom: service.nom,
        description: service.description || '',
        cout_service: service.cout_service
      });
    } else {
      setIsEditing(false);
      setFormData({ id: null, nom: '', description: '', cout_service: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    playClick();
    setShowModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nom || !formData.cout_service) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    try {
      if (isEditing) {
        await query(
          'UPDATE services SET nom = ?, description = ?, cout_service = ? WHERE id = ?',
          [formData.nom, formData.description, parseFloat(formData.cout_service), formData.id]
        );
      } else {
        await query(
          'INSERT INTO services (nom, description, cout_service) VALUES (?, ?, ?)',
          [formData.nom, formData.description, parseFloat(formData.cout_service)]
        );
      }
      playSuccess();
      setShowModal(false);
      fetchServices();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'enregistrement.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce service ?')) {
      try {
        await query('DELETE FROM services WHERE id = ?', [id]);
        playDelete();
        fetchServices();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const filteredServices = services.filter(s => s.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-center glass-card p-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center">
            <PenTool className="mr-2 text-pink-500" /> Services & Main d'Oeuvre
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gérez les prestations de service (Secrétariat, Réparation).</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-pink-500 outline-none shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center space-x-2 px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold shadow-lg shadow-pink-500/30 transition-all active:scale-95"
          >
            <Plus size={18} />
            <span>Nouveau Service</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 glass-card overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700/50">Nom du Service</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700/50">Description</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700/50">Coût</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700/50 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-slate-700 dark:text-slate-300 text-sm">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-slate-500">Aucun service trouvé.</td>
                </tr>
              ) : filteredServices.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-semibold">{s.nom}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-400">{s.description || '-'}</td>
                  <td className="p-4 font-bold text-pink-600 dark:text-pink-400">{FCFA(s.cout_service)}</td>
                  <td className="p-4 flex justify-center gap-2">
                    <button onClick={() => handleOpenModal(s)} className="p-2 text-slate-400 hover:text-pink-500 bg-slate-100 hover:bg-pink-100 dark:bg-slate-800 dark:hover:bg-pink-500/20 rounded-lg transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-400 hover:text-rose-500 bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-500/20 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center">
                {isEditing ? <Edit2 className="mr-2 text-pink-500" size={20}/> : <Plus className="mr-2 text-pink-500" size={20}/>}
                {isEditing ? 'Modifier Service' : 'Nouveau Service'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Nom du Service *</label>
                <input required type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-pink-500"
                  value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Description</label>
                <textarea className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-pink-500" rows="3"
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Coût du Service *</label>
                <input required type="number" min="0" step="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-pink-500"
                  value={formData.cout_service} onChange={e => setFormData({...formData, cout_service: e.target.value})} />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors">
                  Annuler
                </button>
                <button type="submit" className="flex-1 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold shadow-lg shadow-pink-500/30 flex justify-center items-center gap-2 transition-all active:scale-95">
                  <Check size={20} />
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
