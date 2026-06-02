import React, { useState, useRef, useEffect } from 'react';
import { Search, ShoppingCart, UserPlus, Plus, Minus, Trash2, Printer, X, Eye, Check, Edit2 } from 'lucide-react';
import Barcode from '../components/Barcode';
import { playBeep, playSuccess, playError, playCashRegister, playDelete, playClick } from '../utils/sounds';
import query from '../utils/db';

const FCFA = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

export default function Caisse({ clients = [], refreshClients }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [transactionId, setTransactionId] = useState('');

  // Client handling
  const [selectedClientId, setSelectedClientId] = useState('passant');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({ nom: '', telephone: '' });

  // Preview & Checkout
  const [showPreview, setShowPreview] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [shopName, setShopName] = useState('SKYSTORE');
  const [addedToCart, setAddedToCart] = useState(null);

  // Editing price
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [tempPrice, setTempPrice] = useState('');

  const logoInputRef = useRef();

  const allClients = [{ id: 'passant', nom: 'Client En Passant', telephone: '' }, ...clients];

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await query('SELECT p.*, c.nom as categorie_nom FROM produits p LEFT JOIN categories c ON p.categorie_id = c.id WHERE p.quantite_stock > 0 ORDER BY p.nom ASC');
        setProducts(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    (p.categorie_nom && p.categorie_nom.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart = (product) => {
    playBeep();
    setAddedToCart(product.id);
    setTimeout(() => setAddedToCart(null), 400);
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.qte < product.quantite_stock) {
        setCart(cart.map(item => item.id === product.id ? { ...item, qte: item.qte + 1 } : item));
      } else {
        playError();
        alert('Stock insuffisant');
      }
    } else {
      setCart([...cart, { ...product, qte: 1, prix_negocie: product.prix_vente }]);
    }
  };

  const updateQuantity = (id, delta) => {
    playClick();
    setCart(cart.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === id);
        const newQte = item.qte + delta;
        if (newQte > (product ? product.quantite_stock : 999)) {
          playError();
          alert('Stock insuffisant');
          return item;
        }
        return newQte > 0 ? { ...item, qte: newQte } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id) => {
    playDelete();
    setCart(cart.filter(item => item.id !== id));
  };

  const handlePriceEditSubmit = (id) => {
    const val = parseFloat(tempPrice);
    if (!isNaN(val) && val >= 0) {
      setCart(cart.map(item => item.id === id ? { ...item, prix_negocie: val } : item));
    }
    setEditingPriceId(null);
  };

  const total = cart.reduce((sum, item) => sum + (item.prix_negocie * item.qte), 0);

  const handleAddNewClient = async () => {
    if (!newClientData.nom || !newClientData.telephone) {
      playError();
      return alert('Nom et téléphone requis.');
    }

    try {
      const res = await query('INSERT INTO clients (nom, telephone) VALUES (?, ?)', [newClientData.nom, newClientData.telephone]);
      playSuccess();
      if (refreshClients) await refreshClients();
      setSelectedClientId(res.id || Date.now());
      setNewClientData({ nom: '', telephone: '' });
      setShowNewClientForm(false);
    } catch (err) {
      console.error(err);
      playError();
      alert('Erreur lors de la création du client.');
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      playError();
      return alert('Le panier est vide');
    }
    playClick();
    setShowPreview(true);
  };

  const now = new Date().toLocaleString('fr-FR');
  const invoiceId = 'INV-' + String(Date.now()).slice(-6);

  const confirmCheckout = async () => {
    try {
      const dbQuery = window.api ? window.api.dbQuery : async () => ({ id: Date.now() });
      const clientId = selectedClientId === 'passant' ? null : selectedClientId;
      const statutPaiement = paymentMethod === 'Carte' ? 'Payé' : 'Payé';

      // Create Sale
      const resVente = await dbQuery(
        'INSERT INTO ventes (client_id, date_vente, moyen_paiement, transaction_id, statut_paiement, total_facture, statut_facture) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [clientId, now, paymentMethod, transactionId, statutPaiement, total, 'Valide']
      );
      const venteId = resVente.id || Date.now();

      // Create details & Update stock
      for (const item of cart) {
        await dbQuery(
          'INSERT INTO details_ventes (vente_id, type_item, item_id, quantite, prix_unitaire_vendu) VALUES (?, ?, ?, ?, ?)',
          [venteId, 'Produit', item.id, item.qte, item.prix_negocie]
        );
        await dbQuery('UPDATE produits SET quantite_stock = quantite_stock - ? WHERE id = ?', [item.qte, item.id]);
      }

      await dbQuery(
        'INSERT INTO journal_audit (date_evenement, type_evenement, details) VALUES (?, ?, ?)',
        [now, 'STOCK OUT', `Vente effectuée - ${invoiceId} - Montant: ${total} FCFA`]
      );

      playCashRegister();

      // CORRECTION IMPRESSION : Ciblage explicite de l'imprimante XP-80C
      setTimeout(async () => {
        if (window.api && window.api.printSilent) {
          try {
            // Passe le nom de l'imprimante Windows de la boutique en paramètre
            await window.api.printSilent({ printerName: 'XP-80C' });
          } catch (printErr) {
            console.error("L'imprimante XP-80C n'a pas répondu, essai avec l'imprimante par défaut :", printErr);
            // Fallback silencieux sans argument si XP-80C échoue
            await window.api.printSilent().catch(err => console.error('Échec total impression:', err));
          }
        } else {
          window.print();
        }

        setShowPreview(false);
        setCart([]);
        setSelectedClientId('passant');
        setTransactionId('');

        // Refresh products to show updated stock
        query('SELECT p.*, c.nom as categorie_nom FROM produits p LEFT JOIN categories c ON p.categorie_id = c.id WHERE p.quantite_stock > 0 ORDER BY p.nom ASC')
          .then(data => setProducts(data || []));
      }, 500);

    } catch (err) {
      console.error(err);
      playError();
      alert('Erreur lors de la validation de la vente.');
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const selectedClientInfo = allClients.find(c => String(c.id) === String(selectedClientId)) || allClients[0];

  return (
    <div className="flex h-full gap-6">
      {/* Zone produits */}
      <div className="flex-1 flex flex-col h-full glass-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-3.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all shadow-sm backdrop-blur-md"
              style={{ touchAction: 'manipulation', WebkitUserSelect: 'text', userSelect: 'text' }} // CORRECTION TACTILE IMMÉDIATE
              placeholder="Rechercher un produit ou scanner code-barre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => addToCart(product)}
                className={`relative bg-white/70 dark:bg-slate-800/60 border rounded-2xl p-4 cursor-pointer transition-all duration-300 group overflow-hidden shadow-sm backdrop-blur-sm
                  ${addedToCart === product.id
                    ? 'border-blue-500 scale-95 bg-blue-50 dark:bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-md'
                  }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                {addedToCart === product.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 dark:bg-blue-500/20 rounded-2xl z-10">
                    <Check className="text-blue-500 dark:text-blue-400 w-12 h-12 animate-bounce drop-shadow-md" />
                  </div>
                )}
                <div className="h-24 bg-slate-100 dark:bg-slate-900/50 rounded-xl mb-4 flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                  <BoxIcon className="w-10 h-10 opacity-50" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight h-10">{product.nom}</h4>
                <div className="flex justify-between items-end mt-3">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 px-2 py-1 bg-slate-200/50 dark:bg-slate-900/50 rounded-md border border-slate-300/50 dark:border-slate-700/50">{product.quantite_stock} en stock</span>
                  <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">{FCFA(product.prix_vente)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zone panier */}
      <div className="w-[450px] flex flex-col glass-card shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-white/40 dark:bg-slate-900/40 flex items-center justify-between backdrop-blur-md">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center">
            <ShoppingCart className="mr-2 text-blue-500" size={22} /> Panier Courant
          </h2>
          {cart.length > 0 && (
            <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
              {cart.reduce((s, i) => s + i.qte, 0)} articles
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30 dark:bg-transparent">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-4">
              <ShoppingCart size={48} className="opacity-40" />
              <p className="text-sm font-medium">Scannez ou cliquez sur un produit</p>
            </div>
          ) : cart.map(item => (
            <div key={item.id} className="flex flex-col bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
              <div className="flex justify-between items-start mb-3">
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm w-2/3 leading-tight">{item.nom}</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400 text-base">{FCFA(item.prix_negocie * item.qte)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900/50 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-400 transition-colors">
                    <Minus size={14} strokeWidth={3} />
                  </button>
                  <span className="text-sm font-bold w-6 text-center text-slate-800 dark:text-slate-200">{item.qte}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-400 transition-colors">
                    <Plus size={14} strokeWidth={3} />
                  </button>
                </div>

                {/* Prix unitaire modifiable */}
                <div className="flex items-center space-x-2">
                  {editingPriceId === item.id ? (
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        className="w-20 text-xs bg-slate-100 dark:bg-slate-900 border border-blue-400 rounded px-2 py-1 text-slate-800 dark:text-slate-200"
                        style={{ touchAction: 'manipulation', WebkitUserSelect: 'text', userSelect: 'text' }} // CORRECTION TACTILE INPUT PRIX
                        value={tempPrice}
                        onChange={(e) => setTempPrice(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handlePriceEditSubmit(item.id)}
                        autoFocus
                      />
                      <button onClick={() => handlePriceEditSubmit(item.id)} className="text-green-500"><Check size={16} /></button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-500 transition-colors"
                      onClick={() => { setEditingPriceId(item.id); setTempPrice(item.prix_negocie.toString()); }}
                    >
                      <span>{FCFA(item.prix_negocie)}/u</span>
                      <Edit2 size={12} className="opacity-50" />
                    </div>
                  )}
                </div>

                <button onClick={() => removeFromCart(item.id)} className="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Zone paiement */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 space-y-4 backdrop-blur-xl">

          {/* Section Client Dynamique */}
          <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-700">
            {!showNewClientForm ? (
              <div className="flex items-center p-2 gap-2">
                <select
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm font-medium rounded-lg focus:ring-2 focus:ring-blue-500 p-2.5 shadow-sm"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  {allClients.map(c => <option key={c.id} value={c.id}>{c.nom} {c.telephone ? `- ${c.telephone}` : ''}</option>)}
                </select>
                <button
                  onClick={() => { playClick(); setShowNewClientForm(true); }}
                  className="p-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-sm transition-colors"
                  title="Enregistrer un nouveau client"
                >
                  <UserPlus size={18} />
                </button>
              </div>
            ) : (
              <div className="p-3 space-y-3 animate-fade-in">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Nouveau Client</span>
                  <button onClick={() => setShowNewClientForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nom complet"
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                    style={{ touchAction: 'manipulation', WebkitUserSelect: 'text', userSelect: 'text' }}
                    value={newClientData.nom}
                    onChange={(e) => setNewClientData({ ...newClientData, nom: e.target.value })}
                  />
                  <input
                    type="tel"
                    placeholder="Téléphone"
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                    style={{ touchAction: 'manipulation', WebkitUserSelect: 'text', userSelect: 'text' }}
                    value={newClientData.telephone}
                    onChange={(e) => setNewClientData({ ...newClientData, telephone: e.target.value })}
                  />
                </div>
                <button
                  onClick={handleAddNewClient}
                  className="w-full py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
                >
                  Enregistrer et Sélectionner
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 p-3 font-medium shadow-sm"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="Cash">💵 Espèces</option>
              <option value="Orange Money">🟠 Orange Money</option>
              <option value="Mobile Money">📱 Mobile Money</option>
              <option value="Carte">💳 Carte Bleue</option>
            </select>

            {paymentMethod !== 'Cash' && (
              <input
                type="text"
                placeholder="ID Transaction"
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-xl p-3 focus:ring-2 focus:ring-blue-500 shadow-sm animate-fade-in"
                style={{ touchAction: 'manipulation', WebkitUserSelect: 'text', userSelect: 'text' }}
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            )}
          </div>

          {/* Settings Ticket Rapide */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
            <button
              onClick={() => logoInputRef.current?.click()}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-500 border border-slate-300 dark:border-slate-700 hover:border-blue-500 px-3 py-2 rounded-lg transition-colors bg-white/50 dark:bg-slate-800/50"
            >
              🖼 Changer Logo
            </button>
            <input
              type="text"
              placeholder="Nom Boutique"
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 shadow-sm"
              style={{ touchAction: 'manipulation', WebkitUserSelect: 'text', userSelect: 'text' }}
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
            />
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>

          <div className="flex justify-between items-center py-4 border-t-2 border-dashed border-slate-300 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 font-bold text-lg">Total à payer</span>
            <span className="text-3xl font-black text-transparent bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300 bg-clip-text drop-shadow-sm">
              {FCFA(total)}
            </span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-4 rounded-xl flex items-center justify-center space-x-3 text-lg font-bold shadow-lg transition-all ${cart.length > 0
              ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-300 dark:border-slate-700'
              }`}
          >
            <Printer size={22} />
            <span>Aperçu & Encaisser</span>
          </button>
        </div>
      </div>

      {/* Modal Aperçu Ticket avec effet Glass */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center"><Eye className="mr-2 text-blue-500" /> Aperçu du Ticket</h3>
              <button onClick={() => { playClick(); setShowPreview(false); }} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Zone du Ticket format Thermique */}
            <div className="p-6 bg-slate-100 dark:bg-slate-950 overflow-y-auto max-h-[60vh] flex justify-center">
              <div id="ticket-preview" className="bg-white text-black w-80 shadow-md p-6 font-mono text-sm relative">
                <div className="absolute top-0 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDAgNSwxMCAxMCwwIiBmaWxsPSIjZjFmNWY5Ii8+PC9zdmc+')] -mt-1"></div>

                <div className="text-center mb-5">
                  {logoPreview && <img src={logoPreview} alt="Logo" className="h-20 mx-auto mb-3 object-contain grayscale" />}
                  <div className="text-2xl font-black uppercase tracking-widest">{shopName}</div>
                  <div className="text-xs text-gray-500 mt-1">Ticket de Caisse</div>
                  <div className="text-xs text-gray-500 mt-1">{now}</div>
                  <div className="border-t-2 border-dashed border-gray-300 my-4" />
                </div>

                <div className="text-xs mb-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ticket N°:</span>
                    <span className="font-bold">{invoiceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Caissier:</span>
                    <span className="font-bold">Admin</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Client:</span>
                    <span className="font-bold">{selectedClientInfo.nom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Paiement:</span>
                    <span className="font-bold">{paymentMethod}</span>
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
                    {cart.map(item => (
                      <tr key={item.id}>
                        <td className="py-1 font-bold">{item.qte}x</td>
                        <td className="py-1 pr-2 truncate max-w-[120px]">{item.nom}</td>
                        <td className="py-1 text-right font-bold">{FCFA(item.prix_negocie * item.qte)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t-2 border-dashed border-gray-300 my-3" />

                <div className="flex justify-between items-end mb-4">
                  <span className="font-bold text-sm">TOTAL NET</span>
                  <span className="font-black text-xl">{FCFA(total)}</span>
                </div>

                <div className="border-t-2 border-dashed border-gray-300 my-4" />

                <div className="flex flex-col items-center mb-4">
                  <Barcode value={invoiceId} width={1.8} height={45} fontSize={12} />
                </div>

                <div className="text-center text-xs text-gray-500 font-bold">
                  *** MERCI DE VOTRE VISITE ***
                  <br />À BIENTÔT !
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDEwIDUsMCAxMCwxMCIgZmlsbD0iI2YxZjVmOSIvPjwvc3ZnPg==')] -mb-1"></div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex gap-4 bg-white dark:bg-slate-900">
              <button
                onClick={() => { playClick(); setShowPreview(false); }}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmCheckout}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Check size={20} strokeWidth={3} />
                Valider & Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BoxIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  );
}