import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2, X, Check, Search } from 'lucide-react';
import query from '../utils/db';
import { playClick, playSuccess, playDelete, playError } from '../utils/sounds';

const FCFA = (n) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

// Composant d'affichage des photos de produits en base64
function ProductImage({ path, alt }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let active = true;
    if (path) {
      if (window.api && window.api.readImage) {
        window.api.readImage(path).then(data => {
          if (active && data) setSrc(data);
        });
      } else {
        setSrc(path);
      }
    }
    return () => { active = false; };
  }, [path]);

  if (!src) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-slate-200/40 dark:bg-slate-800/40 text-slate-400">
        <Package className="w-4 h-4 opacity-40" />
      </div>
    );
  }

  return <img src={src} alt={alt} className="h-full w-full object-cover" />;
}

export default function Produits() {
  const [produits, setProduits] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    id: null,
    nom: '',
    description: '',
    photo_path: '',
    prix_achat: '',
    prix_vente: '',
    quantite_stock: ''
  });

  const [photoPreview, setPhotoPreview] = useState(null);

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

  // Gérer le changement d'image
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoPreview(ev.target.result);
      };
      reader.readAsDataURL(file);

      // Copier l'image sur le disque d'Electron
      if (window.api && window.api.saveImage && file.path) {
        try {
          const fileName = `prod_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
          const savedPath = await window.api.saveImage(file.path, fileName);
          setFormData(prev => ({ ...prev, photo_path: savedPath }));
        } catch (err) {
          console.error(err);
          playError();
          alert("Erreur lors de la sauvegarde physique de l'image.");
        }
      } else {
        // Fallback web
        setFormData(prev => ({ ...prev, photo_path: file.name }));
      }
    }
  };

  // Mettre à jour l'aperçu si photo_path change à l'ouverture du modal
  useEffect(() => {
    if (showModal && formData.photo_path) {
      if (window.api && window.api.readImage) {
        window.api.readImage(formData.photo_path).then(src => {
          if (src) setPhotoPreview(src);
        });
      } else {
        setPhotoPreview(formData.photo_path);
      }
    } else {
      setPhotoPreview(null);
    }
  }, [showModal, formData.photo_path]);

  const handleOpenModal = (produit = null) => {
    playClick();
    if (produit) {
      setIsEditing(true);
      setFormData({
        id: produit.id,
        nom: produit.nom,
        description: produit.description || '',
        photo_path: produit.photo_path || '',
        prix_achat: produit.prix_achat,
        prix_vente: produit.prix_vente,
        quantite_stock: produit.quantite_stock
      });
    } else {
      setIsEditing(false);
      setFormData({ id: null, nom: '', description: '', photo_path: '', prix_achat: '', prix_vente: '', quantite_stock: '' });
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
          'UPDATE produits SET nom = ?, description = ?, photo_path = ?, prix_achat = ?, prix_vente = ?, quantite_stock = ? WHERE id = ?',
          [formData.nom, formData.description, formData.photo_path, parseFloat(formData.prix_achat), parseFloat(formData.prix_vente), parseInt(formData.quantite_stock, 10), formData.id]
        );
        // Log PRICE_CHANGE
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
          'INSERT INTO produits (nom, description, photo_path, prix_achat, prix_vente, quantite_stock) VALUES (?, ?, ?, ?, ?, ?)',
          [formData.nom, formData.description, formData.photo_path, parseFloat(formData.prix_achat), parseFloat(formData.prix_vente), parseInt(formData.quantite_stock, 10)]
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
      <div className="flex justify-between items-center glass-card p-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center">
            <Package className="mr-2 text-blue-500" size={22} /> Gestion des Produits
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs">Gérez le catalogue des produits (Ajout, Modification, Suppression).</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/30 transition-all active:scale-95"
          >
            <Plus size={16} />
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
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-slate-700 dark:text-slate-300 text-xs">
              {filteredProduits.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">Aucun produit trouvé.</td>
                </tr>
              ) : filteredProduits.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 font-semibold flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
                      {p.photo_path ? (
                        <ProductImage path={p.photo_path} alt={p.nom} />
                      ) : (
                        <Package size={14} className="opacity-40" />
                      )}
                    </div>
                    <span>{p.nom}</span>
                  </td>
                  <td className="p-3">{FCFA(p.prix_achat)}</td>
                  <td className="p-3 font-bold text-blue-600 dark:text-blue-400">{FCFA(p.prix_vente)}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] ${p.quantite_stock <= 5 ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                      {p.quantite_stock}
                    </span>
                  </td>
                  <td className="p-3 flex justify-center gap-1.5">
                    <button onClick={() => handleOpenModal(p)} className="p-2 text-slate-400 hover:text-blue-500 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-500/20 rounded-lg transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-rose-500 bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-500/20 rounded-lg transition-colors">
                      <Trash2 size={14} />
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center">
                {isEditing ? <Edit2 className="mr-2 text-blue-500" size={18}/> : <Plus className="mr-2 text-blue-500" size={18}/>}
                {isEditing ? 'Modifier Produit' : 'Nouveau Produit'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Désignation Produit *</label>
                <input required type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                  value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Description</label>
                <textarea className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500" rows="2"
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>

              {/* Champ d'upload d'image */}
              <div className="grid grid-cols-3 gap-3 items-center bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Photo du produit</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoChange}
                    className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-800 dark:file:text-slate-300"
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Aperçu" className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm" />
                  ) : (
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
                      <Package size={16} className="opacity-40" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Prix Achat *</label>
                  <input required type="number" min="0" step="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                    value={formData.prix_achat} onChange={e => setFormData({...formData, prix_achat: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Prix Vente *</label>
                  <input required type="number" min="0" step="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                    value={formData.prix_vente} onChange={e => setFormData({...formData, prix_vente: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Stock Initial *</label>
                <input required type="number" min="0" step="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                  value={formData.quantite_stock} onChange={e => setFormData({...formData, quantite_stock: e.target.value})} />
              </div>

              <div className="pt-3 flex gap-3">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors">
                  Annuler
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 flex justify-center items-center gap-1.5 transition-all active:scale-95">
                  <Check size={16} />
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
