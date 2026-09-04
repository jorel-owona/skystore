import React, { useState, useRef, useEffect } from 'react';
import { Search, ShoppingCart, UserPlus, Plus, Minus, Trash2, Printer, X, Eye, Check, Edit2, AlertCircle, PenTool, Camera, MessageSquare, Award } from 'lucide-react';
import Barcode from '../components/Barcode';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { playBeep, playSuccess, playError, playCashRegister, playDelete, playClick } from '../utils/sounds';
import query from '../utils/db';

const FCFA = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

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
        <BoxIcon className="w-8 h-8 opacity-40" />
      </div>
    );
  }

  return <img src={src} alt={alt} className="h-full w-full object-cover" />;
}

export default function Caisse({ clients = [], refreshClients, activeSession, currentUser, addToast, globalShopName, globalLogoB64 }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [transactionId, setTransactionId] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Client handling
  const [selectedClientId, setSelectedClientId] = useState('passant');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({ nom: '', telephone: '' });

  // Preview & Checkout
  const [showPreview, setShowPreview] = useState(false);
  // Logo : priorité prop globale > localStorage
  const [logoPreview, setLogoPreview] = useState(() => globalLogoB64 || localStorage.getItem('skystore_logo_custom') || null);
  // Nom boutique : priorité prop globale > localStorage
  const [shopName, setShopName] = useState(() => globalShopName || localStorage.getItem('skystore_shop_name') || 'SKYSTORE');
  const [addedToCart, setAddedToCart] = useState(null);

  // Editing price
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceType, setEditingPriceType] = useState(null);
  const [tempPrice, setTempPrice] = useState('');

  const logoInputRef = useRef();

  // Sync depuis props globales si elles changent (ex: utilisateur met à jour le nom depuis le modal)
  useEffect(() => {
    if (globalShopName) setShopName(globalShopName);
  }, [globalShopName]);

  useEffect(() => {
    if (globalLogoB64) setLogoPreview(globalLogoB64);
  }, [globalLogoB64]);

  const allClients = [{ id: 'passant', nom: 'Client En Passant', telephone: '', points_fidelite: 0 }, ...clients];

  const fetchItems = async () => {
    try {
      const prodData = await query('SELECT p.*, c.nom as categorie_nom FROM produits p LEFT JOIN categories c ON p.categorie_id = c.id WHERE p.quantite_stock > 0 ORDER BY p.nom ASC');
      const servData = await query('SELECT s.*, c.nom as categorie_nom FROM services s LEFT JOIN categories c ON s.categorie_id = c.id ORDER BY s.nom ASC');
      
      const mappedProds = (prodData || []).map(p => ({
        ...p,
        type: 'Produit'
      }));

      const mappedServs = (servData || []).map(s => ({
        ...s,
        type: 'Service',
        prix_vente: s.cout_service,
        quantite_stock: null
      }));

      setProducts([...mappedProds, ...mappedServs]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // --- Raccourcis Clavier (F1-F4, F9, Esc) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorer si l'utilisateur saisit du texte dans un champ de formulaire
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && e.key !== 'Escape' && e.key !== 'F9') {
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        setPaymentMethod('Cash');
        playClick();
      } else if (e.key === 'F2') {
        e.preventDefault();
        setPaymentMethod('Orange Money');
        playClick();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setPaymentMethod('Mobile Money');
        playClick();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setPaymentMethod('Carte');
        playClick();
      } else if (e.key === 'F9' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        handleCheckout();
      } else if (e.key === 'Escape') {
        if (showPreview) {
          setShowPreview(false);
        } else if (isScannerOpen) {
          setIsScannerOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, activeSession, showPreview, isScannerOpen]);

  const filteredProducts = products.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    (p.code_barre && p.code_barre.toLowerCase().includes(search.toLowerCase())) ||
    (p.categorie_nom && p.categorie_nom.toLowerCase().includes(search.toLowerCase()))
  );

  const handleScanBarcode = (scannedCode) => {
    const found = products.find(p => p.code_barre === scannedCode || p.nom.toLowerCase() === scannedCode.toLowerCase());
    if (found) {
      addToCart(found);
      playSuccess();
      if (addToast) addToast('success', 'Produit Scanné', `${found.nom} ajouté au panier`);
    } else {
      playError();
      if (addToast) addToast('error', 'Code-barres Inconnu', `Aucun produit pour : ${scannedCode}`);
    }
  };

  const addToCart = (product) => {
    if (!activeSession) {
      playError();
      if (addToast) addToast('warning', 'Caisse Fermée', 'Ouvrez une session dans "Vente & Sessions" pour encaisser.');
      return;
    }
    playBeep();
    setAddedToCart(`${product.type}-${product.id}`);
    setTimeout(() => setAddedToCart(null), 400);

    const existing = cart.find(item => item.id === product.id && item.type === product.type);
    if (existing) {
      if (product.type === 'Service') {
        setCart(cart.map(item => item.id === product.id && item.type === 'Service' ? { ...item, qte: item.qte + 1 } : item));
      } else {
        if (existing.qte < product.quantite_stock) {
          setCart(cart.map(item => item.id === product.id && item.type === 'Produit' ? { ...item, qte: item.qte + 1 } : item));
        } else {
          playError();
          if (addToast) addToast('warning', 'Stock Insuffisant', `Stock max atteint pour ${product.nom}`);
        }
      }
    } else {
      setCart([...cart, { ...product, qte: 1, prix_negocie: product.prix_vente }]);
    }
  };

  const updateQuantity = (id, type, delta) => {
    playClick();
    setCart(cart.map(item => {
      if (item.id === id && item.type === type) {
        if (item.type === 'Service') {
          const newQte = item.qte + delta;
          return newQte > 0 ? { ...item, qte: newQte } : item;
        } else {
          const product = products.find(p => p.id === id && p.type === 'Produit');
          const newQte = item.qte + delta;
          if (newQte > (product ? product.quantite_stock : 999)) {
            playError();
            if (addToast) addToast('warning', 'Stock Insuffisant', 'Quantité demandée > stock disponible');
            return item;
          }
          return newQte > 0 ? { ...item, qte: newQte } : item;
        }
      }
      return item;
    }));
  };

  const removeFromCart = (id, type) => {
    playDelete();
    setCart(cart.filter(item => !(item.id === id && item.type === type)));
  };

  const handlePriceEditSubmit = (id, type) => {
    const val = parseFloat(tempPrice);
    if (!isNaN(val) && val >= 0) {
      setCart(cart.map(item => item.id === id && item.type === type ? { ...item, prix_negocie: val } : item));
    }
    setEditingPriceId(null);
    setEditingPriceType(null);
  };

  const total = cart.reduce((sum, item) => sum + (item.prix_negocie * item.qte), 0);
  const pointsEarned = Math.floor(total / 1000);

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
    if (!activeSession) {
      playError();
      if (addToast) addToast('warning', 'Caisse Fermée', 'Ouvrez d\'abord une session.');
      return;
    }
    if (cart.length === 0) {
      playError();
      if (addToast) addToast('info', 'Panier Vide', 'Ajoutez des articles avant d\'encaisser.');
      return;
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
      const statutPaiement = 'Payé';
      const vendedorId = currentUser ? currentUser.id : null;

      // Create Sale
      const resVente = await dbQuery(
        'INSERT INTO ventes (client_id, date_vente, moyen_paiement, transaction_id, statut_paiement, total_facture, statut_facture, vendeur_id, points_gagnes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [clientId, now, paymentMethod, transactionId, statutPaiement, total, 'Valide', vendedorId, pointsEarned]
      );
      const venteId = resVente.id || Date.now();

      // Mise à jour des points de fidélité du client
      if (clientId && pointsEarned > 0) {
        await dbQuery('UPDATE clients SET points_fidelite = points_fidelite + ? WHERE id = ?', [pointsEarned, clientId]);
        if (refreshClients) refreshClients();
      }

      // Create details & Update stock
      for (const item of cart) {
        await dbQuery(
          'INSERT INTO details_ventes (vente_id, type_item, item_id, quantite, prix_unitaire_vendu) VALUES (?, ?, ?, ?, ?)',
          [venteId, item.type, item.id, item.qte, item.prix_negocie]
        );
        if (item.type === 'Produit') {
          await dbQuery('UPDATE produits SET quantite_stock = quantite_stock - ? WHERE id = ?', [item.qte, item.id]);
        }
      }

      await dbQuery(
        'INSERT INTO journal_audit (date_evenement, type_evenement, details) VALUES (?, ?, ?)',
        [now, 'STOCK OUT', `Vente effectuée par ${currentUser?.nom || 'Admin'} - ${invoiceId} - Montant: ${total} FCFA`]
      );

      playCashRegister();

      // Impression directe brute (ESC/POS)
      setTimeout(async () => {
        const selectedPrinter = localStorage.getItem('selected_printer') || 'XP-80C';
        
        if (window.api && window.api.printTicketRaw) {
          try {
            const printData = {
              shopName: shopName || 'SKYSTORE',
              date: now,
              invoiceId: invoiceId,
              cashier: currentUser?.nom || 'Admin',
              clientName: selectedClientInfo.nom,
              paymentMethod: paymentMethod,
              cart: cart,
              total: total
            };
            await window.api.printTicketRaw(printData, selectedPrinter);
          } catch (printErr) {
            console.error("Échec impression ticket brute, fallback standard :", printErr);
            window.print();
          }
        } else {
          window.print();
        }

        setShowPreview(false);
        setCart([]);
        setSelectedClientId('passant');
        setTransactionId('');

        // Refresh items
        fetchItems();
      }, 500);

    } catch (err) {
      console.error(err);
      playError();
      alert('Erreur lors de la validation de la vente.');
    }
  };

  const handleSendWhatsApp = () => {
    if (!selectedClientInfo.telephone) {
      return alert('Aucun numéro de téléphone rattaché à ce client.');
    }
    const articlesList = cart.map(i => `- ${i.qte}x ${i.nom} (${FCFA(i.prix_negocie * i.qte)})`).join('\n');
    const msg = `Bonjour ${selectedClientInfo.nom},\nMerci pour votre achat chez *${shopName}* (Facture #${invoiceId}).\n\n*Détail de votre panier :*\n${articlesList}\n\n*Total Net :* ${FCFA(total)}\n*Moyen de Paiement :* ${paymentMethod}\n\nÀ bientôt chez ${shopName} !`;

    if (window.api && window.api.openWhatsApp) {
      window.api.openWhatsApp(selectedClientInfo.telephone, msg);
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
    <div className="flex flex-col h-full gap-4">
      {/* Alerte caisse fermée */}
      {!activeSession && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl p-4 text-xs font-semibold flex items-center gap-2.5 shadow-sm animate-fade-in no-print">
          <AlertCircle size={18} className="animate-pulse" />
          <span>La caisse est actuellement fermée. Veuillez ouvrir une session dans l'onglet "Vente & Sessions" pour encaisser.</span>
        </div>
      )}

      <div className="flex h-full gap-6">
        {/* Zone produits */}
        <div className="flex-1 flex flex-col h-full liquid-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                className="block w-full pl-11 pr-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all shadow-sm backdrop-blur-md"
                placeholder="Rechercher un produit/service ou scanner code-barre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Bouton Scanner Webcam */}
            <button
              onClick={() => { playClick(); setIsScannerOpen(true); }}
              className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-md shadow-blue-500/20"
              title="Scanner par Webcam"
            >
              <Camera size={18} />
              <span className="hidden sm:inline">Webcam</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map(product => {
                const uniqueKey = `${product.type}-${product.id}`;
                return (
                  <div
                    key={uniqueKey}
                    onClick={() => addToCart(product)}
                    className={`relative bg-white/70 dark:bg-slate-800/60 border rounded-xl p-3 cursor-pointer transition-all duration-300 group overflow-hidden shadow-sm backdrop-blur-sm
                      ${addedToCart === uniqueKey
                        ? 'border-blue-500 scale-95 bg-blue-50 dark:bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-md'
                      }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    {addedToCart === uniqueKey && (
                      <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 dark:bg-blue-500/20 rounded-xl z-10">
                        <Check className="text-blue-500 dark:text-blue-400 w-10 h-10 animate-bounce drop-shadow-md" />
                      </div>
                    )}
                    <div className="h-20 bg-slate-100 dark:bg-slate-900/50 rounded-lg mb-2 flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 overflow-hidden">
                      {product.type === 'Service' ? (
                        <PenTool className="w-8 h-8 opacity-50 text-pink-500" />
                      ) : product.photo_path ? (
                        <ProductImage path={product.photo_path} alt={product.nom} />
                      ) : (
                        <BoxIcon className="w-8 h-8 opacity-50" />
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight h-8">{product.nom}</h4>
                    <div className="flex justify-between items-end mt-2">
                      {product.type === 'Service' ? (
                        <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 px-2 py-0.5 bg-pink-100/50 dark:bg-pink-500/10 rounded border border-pink-200 dark:border-pink-500/20">Service</span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 px-1.5 py-0.5 bg-slate-200/50 dark:bg-slate-900/50 rounded border border-slate-300/50 dark:border-slate-700/50">{product.quantite_stock} en stock</span>
                      )}
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400">{FCFA(product.prix_vente)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Zone panier */}
        <div className="w-[380px] flex flex-col liquid-card shadow-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white/40 dark:bg-slate-900/40 flex items-center justify-between backdrop-blur-md">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center">
              <ShoppingCart className="mr-2 text-blue-500" size={18} /> Panier
            </h2>
            {cart.length > 0 && (
              <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                {cart.reduce((s, i) => s + i.qte, 0)} art
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar bg-slate-50/30 dark:bg-transparent">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-3">
                <ShoppingCart size={36} className="opacity-40" />
                <p className="text-xs font-medium">Le panier est vide</p>
                <div className="text-[10px] text-slate-400 text-center space-y-1 mt-2 bg-slate-100 dark:bg-slate-800/40 p-3 rounded-2xl">
                  <p><span className="font-bold">F1-F4</span> : Sélection Paiement</p>
                  <p><span className="font-bold">F9</span> : Encaisser</p>
                  <p><span className="font-bold">Esc</span> : Annuler</p>
                </div>
              </div>
            ) : cart.map(item => (
              <div key={`${item.type}-${item.id}`} className="flex flex-col bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs w-2/3 leading-tight">{item.nom}</span>
                  <span className="font-black text-blue-600 dark:text-blue-400 text-xs">{FCFA(item.prix_negocie * item.qte)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900/50 rounded p-0.5 border border-slate-200 dark:border-slate-700">
                    <button onClick={() => updateQuantity(item.id, item.type, -1)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 transition-colors">
                      <Minus size={12} strokeWidth={3} />
                    </button>
                    <span className="text-xs font-bold w-5 text-center text-slate-800 dark:text-slate-200">{item.qte}</span>
                    <button onClick={() => updateQuantity(item.id, item.type, 1)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 transition-colors">
                      <Plus size={12} strokeWidth={3} />
                    </button>
                  </div>

                  {/* Prix unitaire modifiable */}
                  <div className="flex items-center space-x-1.5">
                    {editingPriceId === item.id && editingPriceType === item.type ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          className="w-16 text-[10px] bg-slate-100 dark:bg-slate-900 border border-blue-400 rounded px-1.5 py-0.5 text-slate-800 dark:text-slate-200"
                          value={tempPrice}
                          onChange={(e) => setTempPrice(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handlePriceEditSubmit(item.id, item.type)}
                          autoFocus
                        />
                        <button onClick={() => handlePriceEditSubmit(item.id, item.type)} className="text-green-500"><Check size={14} /></button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center space-x-1 text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-500 transition-colors"
                        onClick={() => { setEditingPriceId(item.id); setEditingPriceType(item.type); setTempPrice(item.prix_negocie.toString()); }}
                      >
                        <span>{FCFA(item.prix_negocie)}/u</span>
                        <Edit2 size={10} className="opacity-50" />
                      </div>
                    )}
                  </div>

                  <button onClick={() => removeFromCart(item.id, item.type)} className="p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Zone paiement */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 space-y-3.5 backdrop-blur-xl">
            {/* Section Client Dynamique */}
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-700">
              {!showNewClientForm ? (
                <div className="flex items-center p-1.5 gap-2">
                  <select
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded p-2 focus:ring-1 focus:ring-blue-500 shadow-sm"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                  >
                    {allClients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nom} {c.telephone ? `- ${c.telephone}` : ''} {c.points_fidelite > 0 ? `⭐ (${c.points_fidelite} pts)` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => { playClick(); setShowNewClientForm(true); }}
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded shadow-sm transition-colors"
                    title="Enregistrer un nouveau client"
                  >
                    <UserPlus size={16} />
                  </button>
                </div>
              ) : (
                <div className="p-2.5 space-y-2.5 animate-fade-in">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Nouveau Client</span>
                    <button onClick={() => setShowNewClientForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={14} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nom complet"
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200"
                      value={newClientData.nom}
                      onChange={(e) => setNewClientData({ ...newClientData, nom: e.target.value })}
                    />
                    <input
                      type="tel"
                      placeholder="Téléphone"
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200"
                      value={newClientData.telephone}
                      onChange={(e) => setNewClientData({ ...newClientData, telephone: e.target.value })}
                    />
                  </div>
                  <button
                    onClick={handleAddNewClient}
                    className="w-full py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded text-xs font-bold shadow-sm transition-colors"
                  >
                    Enregistrer et Sélectionner
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl p-2.5 font-medium shadow-sm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="Cash">💵 [F1] Espèces</option>
                <option value="Orange Money">🟠 [F2] Orange Money</option>
                <option value="Mobile Money">📱 [F3] Mobile Money</option>
                <option value="Carte">💳 [F4] Carte Bleue</option>
              </select>

              {paymentMethod !== 'Cash' && (
                <input
                  type="text"
                  placeholder="ID Transaction"
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500 shadow-sm animate-fade-in"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                />
              )}
            </div>

            {/* Points de fidélité gagnés */}
            {pointsEarned > 0 && selectedClientId !== 'passant' && (
              <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                <span className="flex items-center space-x-1">
                  <Award size={14} />
                  <span>Fidélité attribuée :</span>
                </span>
                <span className="font-extrabold">+{pointsEarned} pts</span>
              </div>
            )}

            {/* Settings Ticket Rapide */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
              <button
                onClick={() => logoInputRef.current?.click()}
                className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-500 border border-slate-300 dark:border-slate-700 hover:border-blue-500 px-2 py-1.5 rounded transition-colors bg-white/50 dark:bg-slate-800/50"
              >
                🖼 Logo
              </button>
              <input
                type="text"
                placeholder="Nom Boutique"
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-[10px] font-bold text-slate-800 dark:text-slate-200 shadow-sm"
                value={shopName}
                onChange={(e) => {
                  setShopName(e.target.value);
                  localStorage.setItem('skystore_shop_name', e.target.value);
                }}
              />
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>

            <div className="flex justify-between items-center py-2.5 border-t-2 border-dashed border-slate-300 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 font-bold text-sm">Total à payer</span>
              <span className="text-xl font-black text-transparent bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300 bg-clip-text drop-shadow-sm">
                {FCFA(total)}
              </span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || !activeSession}
              className={`w-full py-3 rounded-xl flex items-center justify-center space-x-2 text-base font-bold shadow-lg transition-all ${cart.length > 0 && activeSession
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                }`}
            >
              <Printer size={18} />
              <span>Aperçu & Encaisser [F9]</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Aperçu Ticket */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 no-print">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center"><Eye className="mr-2 text-blue-500" size={18} /> Aperçu du Ticket</h3>
              <button onClick={() => { playClick(); setShowPreview(false); }} className="p-1.5 bg-slate-200 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Zone du Ticket format Thermique */}
            <div className="p-4 bg-slate-100 dark:bg-slate-950 overflow-y-auto max-h-[50vh] flex justify-center">
              <div id="ticket-preview" className="bg-white text-black w-80 shadow-md p-5 font-mono text-xs relative">
                <div className="absolute top-0 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDAgNSwxMCAxMCwwIiBmaWxsPSIjZjFmNWY5Ii8+PC9zdmc+')] -mt-1 no-print"></div>

                <div className="text-center mb-4">
                  {logoPreview && <img src={logoPreview} alt="Logo" className="h-16 mx-auto mb-2 object-contain grayscale" />}
                  <div className="text-xl font-black uppercase tracking-widest">{shopName}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Ticket de Caisse</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{now}</div>
                  <div className="border-t-2 border-dashed border-gray-300 my-3" />
                </div>

                <div className="text-[10px] mb-3 space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ticket N°:</span>
                    <span className="font-bold">{invoiceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Caissier:</span>
                    <span className="font-bold">{currentUser?.nom || 'Admin'}</span>
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

                <table className="w-full text-[10px] mb-3">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left pb-1">Qté</th>
                      <th className="text-left pb-1">Désignation</th>
                      <th className="text-right pb-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={`${item.type}-${item.id}`}>
                        <td className="py-1 font-bold">{item.qte}x</td>
                        <td className="py-1 pr-2 truncate max-w-[120px]">{item.nom}</td>
                        <td className="py-1 text-right font-bold">{FCFA(item.prix_negocie * item.qte)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t-2 border-dashed border-gray-300 my-3" />

                <div className="flex justify-between items-end mb-3">
                  <span className="font-bold text-xs">TOTAL NET</span>
                  <span className="font-black text-base">{FCFA(total)}</span>
                </div>

                <div className="border-t-2 border-dashed border-gray-300 my-3" />

                <div className="flex flex-col items-center mb-3 no-print">
                  <Barcode value={invoiceId} width={1.5} height={35} fontSize={10} />
                </div>

                <div className="text-center text-[10px] text-gray-500 font-bold">
                  *** MERCI DE VOTRE VISITE ***
                  <br />À BIENTÔT !
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDEwIDUsMCAxMCwxMCIgZmlsbD0iI2YxZjVmOSIvPjwvc3ZnPg==')] -mb-1 no-print"></div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2 bg-white dark:bg-slate-900 no-print">
              {selectedClientInfo.telephone && (
                <button
                  onClick={handleSendWhatsApp}
                  className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1"
                  title="Partager par WhatsApp"
                >
                  <MessageSquare size={16} />
                  <span>WhatsApp</span>
                </button>
              )}
              <button
                onClick={() => { playClick(); setShowPreview(false); }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmCheckout}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/30 flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <Check size={16} strokeWidth={3} />
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Scanner Code-Barres Webcam */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanBarcode}
      />
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