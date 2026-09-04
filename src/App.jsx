import React, { useState, useEffect, useRef } from 'react';
import packageJson from '../package.json';
import { ShoppingCart, ClipboardList, Box, Receipt, Settings, Users, PenTool, LayoutDashboard, Moon, Sun, PieChart, Wrench, Lock, Database, UserCheck, Sparkles, Image as ImageIcon, Store, Upload, Check, Package } from 'lucide-react';
import Caisse from './tabs/Caisse';
import Inventaire from './tabs/Inventaire';
import Vente from './tabs/Vente';
import Journal from './tabs/Journal';
import Depenses from './tabs/Depenses';
import Factures from './tabs/Factures';
import Produits from './tabs/Produits';
import Services from './tabs/Services';
import Clients from './tabs/Clients';
import Analytics from './tabs/Analytics';
import Sav from './tabs/Sav';
import Parametres from './tabs/Parametres';
import LoginModal from './components/LoginModal';
import Toast from './components/Toast';
import { playClick, playSuccess, playError } from './utils/sounds';
import query from './utils/db';

export default function App() {
  const [activeTab, setActiveTab] = useState('caisse');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [clients, setClients] = useState([]);
  const [activeSession, setActiveSession] = useState(null);

  // Gestion du Logo 3D (Option 1 ou Option 2 ou Custom)
  const [selectedLogo, setSelectedLogo] = useState(() => localStorage.getItem('skystore_logo') || 'option1');
  const [showLogoModal, setShowLogoModal] = useState(false);

  // Nom de la boutique (persisté dans localStorage)
  const [shopName, setShopName] = useState(() => localStorage.getItem('skystore_shop_name') || 'SKYSTORE');
  const [shopNameInput, setShopNameInput] = useState(() => localStorage.getItem('skystore_shop_name') || 'SKYSTORE');

  // Logo personnalisé (base64 persisté dans localStorage)
  const [customLogoB64, setCustomLogoB64] = useState(() => localStorage.getItem('skystore_logo_custom') || null);
  const logoUploadRef = useRef();
  const [shopNameSaved, setShopNameSaved] = useState(false);

  // Gestion des Toasts
  const [toasts, setToasts] = useState([]);

  const addToast = (type, title, message) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Gestion des utilisateurs et de la sécurité PIN
  const [currentUser, setCurrentUser] = useState({ id: 1, nom: 'Administrateur', role: 'ADMIN' });
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const fetchClients = async () => {
    try {
      const data = await query('SELECT * FROM clients ORDER BY nom ASC');
      setClients(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const checkActiveSession = async () => {
    try {
      const data = await query('SELECT * FROM sessions_caisses WHERE date_fermeture IS NULL ORDER BY id DESC LIMIT 1');
      if (data && data.length > 0) {
        setActiveSession({
          id: data[0].id,
          dateOuverture: data[0].date_ouverture,
          fondCaisseInitial: data[0].fond_caisse_initial
        });
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchClients();
    checkActiveSession();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleTabChange = (tabId) => {
    playClick();
    setActiveTab(tabId);
  };

  const handleBackupDB = async () => {
    playClick();
    if (window.api && window.api.backupDatabase) {
      const res = await window.api.backupDatabase();
      if (res.success) {
        playSuccess();
        addToast('success', 'Sauvegarde Réussie', `Base exportée : ${res.path}`);
      } else if (!res.canceled) {
        playError();
        addToast('error', 'Échec Sauvegarde', res.error);
      }
    } else {
      addToast('info', 'Information', 'La sauvegarde physique nécessite l\'environnement Electron.');
    }
  };

  const handleSelectLogo = (logoKey) => {
    playSuccess();
    setSelectedLogo(logoKey);
    localStorage.setItem('skystore_logo', logoKey);
    addToast('success', 'Logo Mis à Jour', `Logo 3D ${logoKey === 'option1' ? 'Cyan Glass' : 'Purple Metallic'} activé !`);
  };

  const handleSaveShopName = () => {
    const trimmed = shopNameInput.trim() || 'SKYSTORE';
    setShopName(trimmed);
    localStorage.setItem('skystore_shop_name', trimmed);
    playSuccess();
    setShopNameSaved(true);
    setTimeout(() => setShopNameSaved(false), 2000);
    addToast('success', 'Nom Sauvegardé', `Boutique : ${trimmed}`);
  };

  const handleCustomLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      setCustomLogoB64(b64);
      setSelectedLogo('custom');
      localStorage.setItem('skystore_logo_custom', b64);
      localStorage.setItem('skystore_logo', 'custom');
      playSuccess();
      addToast('success', 'Logo Personnalisé', 'Votre logo a été enregistré !');
    };
    reader.readAsDataURL(file);
  };

  const getLogoSrc = () => {
    if (selectedLogo === 'custom' && customLogoB64) return customLogoB64;
    if (selectedLogo === 'option2') return './asset/logo_option2.png';
    return './asset/logo_option1.png';
  };

  // Définition des droits par rôle
  const ROLE_TABS = {
    CAISSIER: ['caisse', 'sav', 'clients', 'factures'],
    GERANT:   ['caisse', 'sav', 'clients', 'factures', 'vente', 'produits', 'services', 'inventaire', 'depenses', 'parametres'],
    ADMIN:    ['caisse', 'analytics', 'sav', 'vente', 'journal', 'inventaire', 'depenses', 'factures', 'produits', 'services', 'clients', 'parametres'],
  };

  const allowedTabs = ROLE_TABS[currentUser?.role] || ROLE_TABS.CAISSIER;

  const navItems = [
    { id: 'caisse',    icon: ShoppingCart,   label: 'Caisse (POS)' },
    { id: 'analytics', icon: PieChart,        label: 'Analytics & Marges' },
    { id: 'sav',       icon: Wrench,          label: 'S.A.V & Réparations' },
    { id: 'vente',     icon: LayoutDashboard, label: 'Vente & Sessions' },
    { id: 'journal',   icon: ClipboardList,   label: "Journal d'Audit" },
    { id: 'inventaire',icon: Box,             label: 'Inventaire' },
    { id: 'depenses',  icon: Receipt,         label: 'Dépenses' },
    { id: 'factures',  icon: Receipt,         label: 'Factures' },
    { id: 'produits',  icon: Package,         label: 'Produits' },
    { id: 'services',  icon: PenTool,         label: 'Services' },
    { id: 'clients',   icon: Users,           label: 'Clients' },
    { id: 'parametres',icon: Settings,        label: 'Paramètres' },
  ].filter(item => allowedTabs.includes(item.id));

  // Si l'onglet actif n'est plus autorisé après changement d'utilisateur, revenir à la caisse
  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab('caisse');
    }
  }, [currentUser]);

  const renderContent = () => {
    switch (activeTab) {
      case 'caisse':     return <Caisse clients={clients} refreshClients={fetchClients} activeSession={activeSession} currentUser={currentUser} addToast={addToast} globalShopName={shopName} globalLogoB64={selectedLogo === 'custom' ? customLogoB64 : null} />;
      case 'analytics':  return <Analytics addToast={addToast} />;
      case 'sav':        return <Sav addToast={addToast} />;
      case 'vente':      return <Vente activeSession={activeSession} refreshSession={checkActiveSession} addToast={addToast} globalShopName={shopName} />;
      case 'journal':    return <Journal />;
      case 'inventaire': return <Inventaire />;
      case 'depenses':   return <Depenses />;
      case 'factures':   return <Factures activeSession={activeSession} addToast={addToast} globalShopName={shopName} currentUser={currentUser} />;
      case 'produits':   return <Produits addToast={addToast} />;
      case 'services':   return <Services addToast={addToast} />;
      case 'clients':    return <Clients clients={clients} refreshClients={fetchClients} addToast={addToast} />;
      case 'parametres': return <Parametres addToast={addToast} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} globalShopName={shopName} setGlobalShopName={setShopName} currentUser={currentUser} />;
      default:           return <Caisse clients={clients} refreshClients={fetchClients} activeSession={activeSession} currentUser={currentUser} addToast={addToast} globalShopName={shopName} globalLogoB64={selectedLogo === 'custom' ? customLogoB64 : null} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-foreground transition-colors duration-500 overflow-hidden font-sans">
      {/* Sidebar 3D Liquid Glass */}
      <aside className="w-64 liquid-glass flex flex-col z-20 m-3 rounded-3xl relative overflow-hidden border border-white/40 dark:border-white/10 shadow-2xl">
        <div className="p-5 flex items-center space-x-3 cursor-pointer group"
          onClick={() => currentUser?.role === 'ADMIN' && setShowLogoModal(true)}
          title={currentUser?.role === 'ADMIN' ? 'Paramètres Boutique' : 'Réservé à l\'Administrateur'}
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 p-1 border border-white/50 shadow-md group-hover:scale-105 transition-transform duration-300">
            <img src={getLogoSrc()} alt="SKYSTORE Logo" className="w-full h-full object-contain drop-shadow-md" />
          </div>
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 bg-clip-text text-transparent tracking-tight">
              {shopName}
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold flex items-center space-x-1">
              <span>POS Liquid 3D</span>
              <Sparkles size={10} className="text-cyan-400 animate-pulse" />
            </p>
          </div>
        </div>
        
        <nav className="flex-1 px-3 space-y-1.5 mt-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-2xl transition-all duration-300 text-xs ${
                  isActive 
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-extrabold shadow-lg shadow-blue-500/30 scale-[1.02]' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                }`}
              >
                <Icon size={18} className={isActive ? 'drop-shadow-md animate-bounce' : ''} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/50 mt-auto space-y-2.5">
          {currentUser?.role === 'ADMIN' && (
            <button
              onClick={() => setShowLogoModal(true)}
              className="w-full py-2 px-3 bg-white/40 dark:bg-slate-800/40 hover:bg-white/60 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 border border-white/50 dark:border-slate-700"
            >
              <Store size={14} className="text-cyan-500" />
              <span>Paramètres Boutique</span>
            </button>
          )}

          {currentUser?.role === 'ADMIN' && (
            <button
              onClick={handleBackupDB}
              className="w-full py-2 px-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 border border-blue-500/20 shadow-sm"
            >
              <Database size={14} />
              <span>Sauvegarder BD</span>
            </button>
          )}

          <div className="text-[10px] text-slate-500 text-center flex flex-col space-y-0.5">
             <span>Version {packageJson.version} Liquid 3D</span>
             <span className="text-emerald-500 font-bold">• Base SQLite Connectée</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Dynamic Background Mesh Gradients */}
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-br from-blue-600/30 via-cyan-500/20 to-purple-600/20 dark:from-blue-600/20 dark:via-cyan-500/10 dark:to-purple-600/10 rounded-full blur-[140px] pointer-events-none transition-all duration-700"></div>
        <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tl from-indigo-600/30 via-pink-500/20 to-emerald-500/20 dark:from-indigo-600/20 dark:via-pink-500/10 dark:to-emerald-500/10 rounded-full blur-[140px] pointer-events-none transition-all duration-700"></div>
        
        <header className="h-20 flex items-center justify-between px-8 z-10 m-3 ml-0 liquid-glass rounded-3xl relative border border-white/50 dark:border-white/10 shadow-lg">
           <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2 tracking-tight">
             <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">{navItems.find(i => i.id === activeTab)?.label.split(' ')[0]}</span>
             {navItems.find(i => i.id === activeTab)?.label.includes(' ') && (
               <span className="text-slate-500 dark:text-slate-400 text-lg font-medium">
                 {navItems.find(i => i.id === activeTab)?.label.substring(navItems.find(i => i.id === activeTab)?.label.indexOf(' '))}
               </span>
             )}
           </h2>

           <div className="flex items-center space-x-4">
              {/* Badge Utilisateur actif / Verrouillage PIN */}
              <button
                onClick={() => {
                  playClick();
                  setIsLoginOpen(true);
                }}
                className="px-4 py-2 bg-white/50 dark:bg-slate-800/80 hover:bg-white/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-white/60 dark:border-slate-700 rounded-2xl text-xs font-bold flex items-center space-x-2 transition shadow-sm"
              >
                <UserCheck size={16} className="text-blue-500" />
                <span>{currentUser ? currentUser.nom : 'Connexion'}</span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  currentUser?.role === 'ADMIN'   ? 'bg-rose-500/20 text-rose-500' :
                  currentUser?.role === 'GERANT'  ? 'bg-amber-500/20 text-amber-500' :
                  'bg-slate-400/20 text-slate-400'
                }`}>{currentUser?.role}</span>
                <Lock size={12} className="text-slate-400" />
              </button>

              <button
                onClick={() => {
                  playClick();
                  setIsDarkMode(!isDarkMode);
                }}
                className="p-2.5 rounded-2xl bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-colors shadow-sm border border-white/60 dark:border-slate-700"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {activeSession ? (
                <div className="px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-2xl text-xs font-bold flex items-center space-x-2 shadow-sm">
                   <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                   <span>Caisse Ouverte</span>
                </div>
              ) : (
                <div className="px-4 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-2xl text-xs font-bold flex items-center space-x-2 shadow-sm">
                   <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
                   <span>Caisse Fermée</span>
                </div>
              )}
           </div>
        </header>

        <div className="flex-1 overflow-auto p-4 pt-0 z-10 custom-scrollbar relative animate-fade-in">
           {renderContent()}
        </div>
      </main>

      {/* Modal Paramètres Boutique */}
      {showLogoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <Store className="text-cyan-500" size={24} />
              <span>Paramètres de la Boutique</span>
            </h3>

            {/* --- Nom de la boutique --- */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Nom de la boutique</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shopNameInput}
                  onChange={(e) => setShopNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveShopName(); }}
                  placeholder="Ex: MON MAGASIN"
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500 outline-none"
                />
                <button
                  onClick={handleSaveShopName}
                  className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 ${
                    shopNameSaved
                      ? 'bg-emerald-500 text-white'
                      : 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                  }`}
                >
                  {shopNameSaved ? <Check size={16} /> : <Check size={16} />}
                  {shopNameSaved ? 'Sauvegardé !' : 'Enregistrer'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Ce nom apparaîtra sur tous les tickets et factures.</p>
            </div>

            {/* --- Logo : Upload personnalisé --- */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Logo de la boutique</label>
              <input ref={logoUploadRef} type="file" accept="image/*" className="hidden" onChange={handleCustomLogoUpload} />
              <button
                onClick={() => logoUploadRef.current?.click()}
                className={`w-full py-2.5 px-4 rounded-xl border-2 border-dashed text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  selectedLogo === 'custom'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-cyan-400 hover:text-cyan-500'
                }`}
              >
                {selectedLogo === 'custom' && customLogoB64 ? (
                  <><img src={customLogoB64} alt="custom" className="w-6 h-6 object-contain" /><span>Logo personnalisé actif — Changer</span></>
                ) : (
                  <><Upload size={16} /><span>Importer mon propre logo</span></>
                )}
              </button>
            </div>

            {/* --- Logos 3D prédéfinis --- */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Logos 3D intégrés</label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => handleSelectLogo('option1')}
                  className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                    selectedLogo === 'option1'
                      ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-blue-400'
                  }`}
                >
                  <img src="./asset/logo_option1.png" alt="Option 1" className="w-16 h-16 object-contain drop-shadow-lg" />
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Cyan Liquid Glass</span>
                  {selectedLogo === 'option1' && <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">✓ Actif</span>}
                </div>
                <div
                  onClick={() => handleSelectLogo('option2')}
                  className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                    selectedLogo === 'option2'
                      ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-purple-400'
                  }`}
                >
                  <img src="./asset/logo_option2.png" alt="Option 2" className="w-16 h-16 object-contain drop-shadow-lg" />
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Purple Metallic 3D</span>
                  {selectedLogo === 'option2' && <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-bold">✓ Actif</span>}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowLogoModal(false)}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl text-sm transition hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modal de connexion PIN / Changement d'utilisateur */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          addToast('success', 'Connexion Réussie', `Bienvenue ${user.nom} (${user.role})`);
        }}
      />

      {/* Système de Toasts Globaux 3D Liquid Glass */}
      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
