import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2, X, Check, Search } from 'lucide-react';
import query from '../utils/db';
import { playClick, playSuccess, playDelete } from '../utils/sounds';

const FCFA = (n) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

export default function Produits() {
  const [produits, setProduits] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    id: null,
    nom: '',
    description: '',
    prix_achat: '',
    prix_vente: '',
    quantite_stock: ''
  });

  const fetchProduits = async () => {
    try {
      const data = await query('SELECT * FROM produits ORDER BY id DESC');
      setProduits(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProduits();
  }, []);

  const handleOpenModal = (produit = null) => {
    playClick();
    if (produit) {
      setIsEditing(true);
      setFormData({
        id: produit.id,
        nom: produit.nom,
        description: produit.description || '',
        prix_achat: produit.prix_achat,
        prix_vente: produit.prix_vente,
        quantite_stock: produit.quantite_stock
      });
    } else {
      setIsEditing(false);
      setFormData({ id: null, nom: '', description: '', prix_achat: '', prix_vente: '', quantite_stock: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    playClick();
    setShowModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nom || formData.prix_achat === '' || formData.prix_vente === '' || formData.quantite_stock === '') {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    try {
      const now = new Date().toLocaleString('fr-FR');
      if (isEditing) {
        await query(
          'UPDATE produits SET nom = ?, description = ?, prix_achat = ?, prix_vente = ?, quantite_stock = ? WHERE id = ?',
          [formData.nom, formData.description, parseFloat(formData.prix_achat), parseFloat(formData.prix_vente), parseInt(formData.quantite_stock, 10), formData.id]
        );
        // Log PRICE_CHANGE or updates
        const fullData = JSON.stringify({
          produit: formData.nom,
          nouveauPrixAchat: `${formData.prix_achat} FCFA`,
          nouveauPrixVente: `${formData.prix_vente} FCFA`,
          nouveauStock: formData.quantite_stock
        });
        await query(
           `INSERT INTO journal_audit (date_evenement, type_evenement, details, full_data) VALUES (?, ?, ?, ?)`,
           [now, 'PRICE_CHANGE', `Mise à jour du produit: ${formData.nom}`, fullData]
        );
      } else {
        await query(
          'INSERT INTO produits (nom, description, prix_achat, prix_vente, quantite_stock) VALUES (?, ?, ?, ?, ?)',
          [formData.nom, formData.description, parseFloat(formData.prix_achat), parseFloat(formData.prix_vente), parseInt(formData.quantite_stock, 10)]
        );
        // Log STOCK_IN
        const fullData = JSON.stringify({
          produit: formData.nom,
          quantiteEntree: formData.quantite_stock,
          prixAchat: `${formData.prix_achat} FCFA/u`
        });
        await query(
           `INSERT INTO journal_audit (date_evenement, type_evenement, details, full_data) VALUES (?, ?, ?, ?)`,
           [now, 'STOCK_IN', `Nouveau produit ajouté: ${formData.nom}`, fullData]
        );
      }
      playSuccess();
      setShowModal(false);
      fetchProduits();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'enregistrement.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      try {
        await query('DELETE FROM produits WHERE id = ?', [id]);
        playDelete();
        fetchProduits();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const filteredProduits = produits.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-center glass-card p-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center">
            <Package className="mr-2 text-blue-500" /> Gestion des Produits
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gérez le catalogue des produits (Ajout, Modification, Suppression).</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all active:scale-95"
          >
            <Plus size={18} />
            <span>Nouveau Produit</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 glass-card overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700/50">Désignation Produit</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700/50">Prix Achat</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700/50">Prix Vente</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700/50">Stock</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700/50 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-slate-700 dark:text-slate-300 text-sm">
              {filteredProduits.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">Aucun produit trouvé.</td>
                </tr>
              ) : filteredProduits.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-semibold">{p.nom}</td>
                  <td className="p-4">{FCFA(p.prix_achat)}</td>
                  <td className="p-4 font-bold text-blue-600 dark:text-blue-400">{FCFA(p.prix_vente)}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-md font-bold text-xs ${p.quantite_stock <= 5 ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                      {p.quantite_stock}
                    </span>
                  </td>
                  <td className="p-4 flex justify-center gap-2">
                    <button onClick={() => handleOpenModal(p)} className="p-2 text-slate-400 hover:text-blue-500 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-500/20 rounded-lg transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-rose-500 bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-500/20 rounded-lg transition-colors">
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
                {isEditing ? <Edit2 className="mr-2 text-blue-500" size={20}/> : <Plus className="mr-2 text-blue-500" size={20}/>}
                {isEditing ? 'Modifier Produit' : 'Nouveau Produit'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Désignation Produit *</label>
                <input required type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Description</label>
                <textarea className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500" rows="2"
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Prix Achat *</label>
                  <input required type="number" min="0" step="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.prix_achat} onChange={e => setFormData({...formData, prix_achat: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Prix Vente *</label>
                  <input required type="number" min="0" step="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.prix_vente} onChange={e => setFormData({...formData, prix_vente: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Stock Initial *</label>
                <input required type="number" min="0" step="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.quantite_stock} onChange={e => setFormData({...formData, quantite_stock: e.target.value})} />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors">
                  Annuler
                </button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2 transition-all active:scale-95">
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
