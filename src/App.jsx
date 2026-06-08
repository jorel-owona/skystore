import React, { useState, useEffect } from 'react';
import { ShoppingCart, ClipboardList, Box, Receipt, Settings, Users, PenTool, LayoutDashboard, Moon, Sun } from 'lucide-react';
import Caisse from './tabs/Caisse';
import Inventaire from './tabs/Inventaire';
import Vente from './tabs/Vente';
import Journal from './tabs/Journal';
import Depenses from './tabs/Depenses';
import Factures from './tabs/Factures';
import Produits from './tabs/Produits';
import Services from './tabs/Services';
import Clients from './tabs/Clients';
import { playClick } from './utils/sounds';
import query from './utils/db';

export default function App() {
  const [activeTab, setActiveTab] = useState('caisse');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [clients, setClients] = useState([]);
  const [activeSession, setActiveSession] = useState(null);

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

  const navItems = [
    { id: 'caisse', icon: ShoppingCart, label: 'Caisse (POS)' },
    { id: 'vente', icon: LayoutDashboard, label: 'Vente & Sessions' },
    { id: 'journal', icon: ClipboardList, label: "Journal d'Audit" },
    { id: 'inventaire', icon: Box, label: 'Inventaire' },
    { id: 'depenses', icon: Receipt, label: 'Dépenses' },
    { id: 'factures', icon: Receipt, label: 'Factures' },
    { id: 'produits', icon: Settings, label: 'Produits' },
    { id: 'services', icon: PenTool, label: 'Services' },
    { id: 'clients', icon: Users, label: 'Clients' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'caisse': return <Caisse clients={clients} refreshClients={fetchClients} activeSession={activeSession} />;
      case 'vente': return <Vente activeSession={activeSession} refreshSession={checkActiveSession} />;
      case 'journal': return <Journal />;
      case 'inventaire': return <Inventaire />;
      case 'depenses': return <Depenses />;
      case 'factures': return <Factures activeSession={activeSession} />;
      case 'produits': return <Produits />;
      case 'services': return <Services />;
      case 'clients': return <Clients clients={clients} refreshClients={fetchClients} />;
      default: return <Caisse clients={clients} refreshClients={fetchClients} activeSession={activeSession} />;
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 glass flex flex-col z-20 border-r border-border m-3 rounded-2xl">
        <div className="p-6">
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent tracking-tight drop-shadow-sm">
            SKYSTORE
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider font-bold">Terminal POS</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm font-semibold' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <Icon size={20} className={isActive ? 'drop-shadow-sm' : ''} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          <div className="text-xs text-slate-500 text-center flex flex-col space-y-1">
             <span>Version 1.0.0 - Hors Ligne</span>
             <span className="text-emerald-500 font-semibold">• Base de données connectée</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Dynamic Background Blurs */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/20 dark:bg-blue-600/10 rounded-full blur-[100px] pointer-events-none transition-colors duration-500"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-500/20 dark:bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none transition-colors duration-500"></div>
        
        <header className="h-20 flex items-center justify-between px-8 z-10 m-3 ml-0 glass rounded-2xl relative">
           <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
             <span className="text-blue-600 dark:text-blue-400">{navItems.find(i => i.id === activeTab)?.label.split(' ')[0]}</span>
             {navItems.find(i => i.id === activeTab)?.label.includes(' ') && (
               <span className="text-slate-500 dark:text-slate-400 text-lg font-medium">
                 {navItems.find(i => i.id === activeTab)?.label.substring(navItems.find(i => i.id === activeTab)?.label.indexOf(' '))}
               </span>
             )}
           </h2>
           <div className="flex items-center space-x-6">
              <button
                onClick={() => {
                  playClick();
                  setIsDarkMode(!isDarkMode);
                }}
                className="p-2.5 rounded-full bg-slate-200/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-700/50 transition-colors shadow-sm"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              {activeSession ? (
                <div className="px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-sm font-semibold flex items-center space-x-2 shadow-sm">
                   <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                   <span>Caisse Ouverte</span>
                </div>
              ) : (
                <div className="px-4 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-full text-sm font-semibold flex items-center space-x-2 shadow-sm">
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
    </div>
  );
}
