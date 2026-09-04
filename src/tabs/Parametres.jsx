import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, CheckCircle, AlertTriangle, Globe, Key, ShieldCheck, Printer, Volume2, Sparkles, Moon, Sun, Store, Upload, Check, Radio, Lock, Smartphone, ShieldAlert } from 'lucide-react';

export default function Parametres({ addToast, isDarkMode, setIsDarkMode, globalShopName, setGlobalShopName, currentUser }) {
  // --- States Mises à Jour ---
  const [appVersion, setAppVersion] = useState('1.1.7');
  const [updaterState, setUpdaterState] = useState({
    status: 'idle', // idle, checking, available, downloading, downloaded, not-available, error
    version: null,
    percent: 0,
    error: null
  });

  // --- States Langues (i18n) ---
  const [selectedLang, setSelectedLang] = useState(() => localStorage.getItem('skystore_lang') || 'fr');

  const languages = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
  ];

  // --- States Licence & Contrôle à Distance ---
  const [licenseKey, setLicenseKey] = useState(() => localStorage.getItem('skystore_license_key') || 'SKY-2026-DEMO');
  const [remoteUrl, setRemoteUrl] = useState(() => localStorage.getItem('skystore_remote_url') || 'https://raw.githubusercontent.com/jorel-owona/skystore/main/license.json');
  const [licenseStatus, setLicenseStatus] = useState({
    status: localStorage.getItem('skystore_lic_status') || 'ACTIVE',
    expiryDate: localStorage.getItem('skystore_lic_expiry') || '2026-12-31',
    message: localStorage.getItem('skystore_lic_msg') || 'Licence active',
    clientName: 'SKYSTORE Client'
  });
  const [isSyncingLic, setIsSyncingLic] = useState(false);
  const [masterCode, setMasterCode] = useState('');

  // --- States Matériel & Impression ---
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(() => localStorage.getItem('skystore_printer') || '');
  const [autoCashDrawer, setAutoCashDrawer] = useState(() => localStorage.getItem('skystore_auto_drawer') !== 'false');
  const [scannerSound, setScannerSound] = useState(() => localStorage.getItem('skystore_scanner_sound') !== 'false');

  // --- States Branding Boutique ---
  const [shopNameInput, setShopNameInput] = useState(globalShopName || 'SKYSTORE');
  const [logoChoice, setLogoChoice] = useState(() => localStorage.getItem('skystore_logo') || 'option1');

  // Chargement initial des imprimantes et version
  useEffect(() => {
    if (window.api?.getAppVersion) {
      window.api.getAppVersion().then(v => v && setAppVersion(v)).catch(() => {});
    }

    if (window.api?.getPrinters) {
      window.api.getPrinters().then(list => {
        if (Array.isArray(list)) {
          setPrinters(list);
          if (!selectedPrinter && list.find(p => p.isDefault)) {
            setSelectedPrinter(list.find(p => p.isDefault).name);
          }
        }
      }).catch(() => {});
    }

    // Écouteur statut Auto-Updater
    if (window.api?.onUpdaterStatus) {
      const removeListener = window.api.onUpdaterStatus((data) => {
        console.log('Update Status Received:', data);
        setUpdaterState(prev => ({
          ...prev,
          status: data.status,
          version: data.version || prev.version,
          percent: data.percent ? Math.round(data.percent) : prev.percent,
          error: data.error || null
        }));
      });
      return () => removeListener();
    }
  }, []);

  // --- Handler Vérification Mise à Jour ---
  const handleCheckUpdate = async () => {
    setUpdaterState({ status: 'checking', version: null, percent: 0, error: null });
    
    if (window.api?.checkForUpdates) {
      try {
        const res = await window.api.checkForUpdates();
        if (!res.success) {
          setUpdaterState({ status: 'error', error: res.error || 'Impossible d\'interroger GitHub' });
          if (addToast) addToast('Recherche échouée ou app non packagée.', 'error');
        }
      } catch (err) {
        setUpdaterState({ status: 'error', error: err.message });
      }
    } else {
      // Simulation mode dev/browser
      setTimeout(() => {
        setUpdaterState({ status: 'not-available', version: appVersion, percent: 100, error: null });
        if (addToast) addToast('L\'application est déjà à jour (Mode Dev)', 'info');
      }, 1500);
    }
  };

  const handleInstallUpdate = () => {
    if (window.api?.quitAndInstall) {
      window.api.quitAndInstall();
    } else {
      if (addToast) addToast('Installeur disponible sur GitHub Releases.', 'info');
    }
  };

  // --- Handler Changement Langue ---
  const handleLangChange = (langCode) => {
    setSelectedLang(langCode);
    localStorage.setItem('skystore_lang', langCode);
    if (addToast) addToast(`Langue changée : ${languages.find(l => l.code === langCode)?.name}`, 'success');
  };

  // --- Handler Synchronisation Licence Distante (Contrôle à distance) ---
  const handleSyncLicense = async () => {
    setIsSyncingLic(true);
    localStorage.setItem('skystore_license_key', licenseKey);
    localStorage.setItem('skystore_remote_url', remoteUrl);

    if (window.api?.checkRemoteLicense) {
      const result = await window.api.checkRemoteLicense(licenseKey, remoteUrl);
      setIsSyncingLic(false);

      if (result.success) {
        setLicenseStatus({
          status: result.status,
          expiryDate: result.expiryDate,
          message: result.message,
          clientName: result.clientName
        });
        localStorage.setItem('skystore_lic_status', result.status);
        localStorage.setItem('skystore_lic_expiry', result.expiryDate);
        localStorage.setItem('skystore_lic_msg', result.message);

        if (result.status === 'ACTIVE') {
          if (addToast) addToast('Licence synchronisée & Active à distance !', 'success');
        } else if (result.status === 'EXPIRED' || result.blocked) {
          if (addToast) addToast('⚠️ Abonnement Expiré ou Suspendu par le serveur !', 'error');
        }
      } else {
        if (addToast) addToast(result.message || 'Serveur de licence inatteignable', 'info');
      }
    } else {
      setTimeout(() => {
        setIsSyncingLic(false);
        if (addToast) addToast('Vérification licence effectuée (Mode Dev)', 'success');
      }, 1000);
    }
  };

  // --- Handler Renouvellement Master Offline ---
  const handleMasterRenewal = () => {
    if (masterCode.trim() === 'SKYSTORE-2026-ADMIN' || masterCode.trim() === '0000') {
      const newExpiry = '2027-12-31';
      setLicenseStatus({
        status: 'ACTIVE',
        expiryDate: newExpiry,
        message: 'Licence déverrouillée manuellement par l\'Administrateur',
        clientName: 'SKYSTORE Client'
      });
      localStorage.setItem('skystore_lic_status', 'ACTIVE');
      localStorage.setItem('skystore_lic_expiry', newExpiry);
      localStorage.setItem('skystore_lic_msg', 'Déverrouillé par Code Master');
      setMasterCode('');
      if (addToast) addToast('Accès déverrouillé avec succès !', 'success');
    } else {
      if (addToast) addToast('Code Master invalide.', 'error');
    }
  };

  // --- Handler Enregistrement Préférences Matériel ---
  const handleSaveHardware = () => {
    localStorage.setItem('skystore_printer', selectedPrinter);
    localStorage.setItem('skystore_auto_drawer', autoCashDrawer.toString());
    localStorage.setItem('skystore_scanner_sound', scannerSound.toString());
    if (addToast) addToast('Paramètres matériel enregistrés !', 'success');
  };

  // --- Handler Enregistrement Boutique ---
  const handleSaveShop = () => {
    if (setGlobalShopName) setGlobalShopName(shopNameInput);
    localStorage.setItem('skystore_shop_name', shopNameInput);
    localStorage.setItem('skystore_logo', logoChoice);
    if (addToast) addToast('Paramètres boutique mis à jour !', 'success');
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full max-w-7xl mx-auto custom-scrollbar pb-24">
      {/* Header Liquid 3D */}
      <div className="liquid-card liquid-glass-3d p-6 flex items-center justify-between border border-white/50 dark:border-slate-700/50">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl border border-white/40 shadow-inner">
            <Sparkles className="text-cyan-500 animate-spin-slow" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 bg-clip-text text-transparent">
              Paramètres & Configuration Système
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Gestion des mises à jour, langues, matériel, et licence à distance.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="px-4 py-2 bg-slate-200/50 dark:bg-slate-800/50 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-2xl text-xs font-bold transition flex items-center space-x-2 border border-white/40 dark:border-slate-700"
          >
            {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-600" />}
            <span>{isDarkMode ? 'Mode Clair' : 'Mode Sombre'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* --- CARD 1 : MISES À JOUR AUTOMATIQUES (Auto-Updater) --- */}
        <div className="liquid-card liquid-glass-3d p-6 space-y-5 relative overflow-hidden border border-cyan-500/20">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-xl">
                <RefreshCw size={22} className={updaterState.status === 'checking' ? 'animate-spin' : ''} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Mises à Jour en Direct</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Version installée : <strong className="text-cyan-600 dark:text-cyan-400">v{appVersion}</strong></p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              GitHub Release
            </span>
          </div>

          <div className="p-4 bg-slate-500/5 dark:bg-slate-800/30 rounded-2xl border border-white/40 dark:border-slate-700/50 space-y-3">
            {updaterState.status === 'idle' && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Recherche automatique au démarrage active</span>
                <button
                  onClick={handleCheckUpdate}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center space-x-2"
                >
                  <RefreshCw size={14} />
                  <span>Vérifier les mises à jour</span>
                </button>
              </div>
            )}

            {updaterState.status === 'checking' && (
              <div className="flex items-center space-x-3 text-cyan-600 dark:text-cyan-400">
                <RefreshCw size={18} className="animate-spin" />
                <span className="text-xs font-bold">Vérification sur les serveurs GitHub en cours...</span>
              </div>
            )}

            {updaterState.status === 'not-available' && (
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <div className="flex items-center space-x-2">
                  <CheckCircle size={18} />
                  <span className="text-xs font-bold">Votre application est parfaitement à jour (v{appVersion}).</span>
                </div>
                <button
                  onClick={handleCheckUpdate}
                  className="px-3 py-1.5 bg-slate-200/50 dark:bg-slate-700/50 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold"
                >
                  Revérifier
                </button>
              </div>
            )}

            {updaterState.status === 'available' && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                  <Download size={18} className="animate-bounce" />
                  <span className="text-xs font-black">Nouvelle version v{updaterState.version} disponible ! Téléchargement...</span>
                </div>
              </div>
            )}

            {updaterState.status === 'downloading' && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Téléchargement de la MàJ v{updaterState.version}...</span>
                  <span>{updaterState.percent}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2.5 rounded-full transition-all duration-300" style={{ width: `${updaterState.percent}%` }}></div>
                </div>
              </div>
            )}

            {updaterState.status === 'downloaded' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle size={20} />
                  <span className="text-xs font-black">Mise à jour v{updaterState.version} prête !</span>
                </div>
                <button
                  onClick={handleInstallUpdate}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center space-x-2 animate-pulse"
                >
                  <Download size={14} />
                  <span>Installer & Redémarrer</span>
                </button>
              </div>
            )}

            {updaterState.status === 'error' && (
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                <div className="flex items-center space-x-2">
                  <AlertTriangle size={18} />
                  <span className="text-xs font-semibold">{updaterState.error || 'Erreur lors de la vérification.'}</span>
                </div>
                <button
                  onClick={handleCheckUpdate}
                  className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg text-xs font-bold"
                >
                  Réessayer
                </button>
              </div>
            )}
          </div>
        </div>

        {/* --- CARD 2 : LANGUE ET INTERNATIONALISATION (i18n) --- */}
        <div className="liquid-card liquid-glass-3d p-6 space-y-5 border border-indigo-500/20">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Globe size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Langue de l'Interface (i18n)</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Sélectionnez votre langue de travail préférée</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {languages.map((lang) => {
              const isSelected = selectedLang === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleLangChange(lang.code)}
                  className={`p-3 rounded-2xl transition flex items-center space-x-3 text-xs font-bold border ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white border-transparent shadow-md shadow-indigo-500/30'
                      : 'bg-slate-500/5 hover:bg-slate-500/10 text-slate-700 dark:text-slate-200 border-white/40 dark:border-slate-700'
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* --- CARD 3 : ABONNEMENT & CONTRÔLE À DISTANCE (Anti-Impayé) --- */}
        <div className="liquid-card liquid-glass-3d p-6 space-y-5 lg:col-span-2 border border-purple-500/20">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className={`p-2.5 rounded-xl ${
                licenseStatus.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600'
              }`}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Licence & Contrôle à Distance de l'Abonnement</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Système de gestion et synchronisation des droits d'utilisation</p>
              </div>
            </div>

            <div className={`px-3 py-1 rounded-full text-xs font-black flex items-center space-x-1.5 border ${
              licenseStatus.status === 'ACTIVE'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${licenseStatus.status === 'ACTIVE' ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`}></span>
              <span>{licenseStatus.status === 'ACTIVE' ? 'ABONNEMENT ACTIF' : 'ABONNEMENT EXPIRÉ / SUSPENDU'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3 p-4 bg-slate-500/5 dark:bg-slate-800/30 rounded-2xl border border-white/40 dark:border-slate-700/50">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                <Key size={14} className="text-purple-500" />
                <span>Clé de Licence Client</span>
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Ex: SKY-2026-CLIENT01"
                className="w-full px-3 py-2 bg-white/60 dark:bg-slate-900/60 rounded-xl text-xs font-bold border border-white/50 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />

              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center space-x-1 pt-1">
                <Globe size={14} className="text-cyan-500" />
                <span>URL Distante du Serveur de Licence</span>
              </label>
              <input
                type="text"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="https://raw.githubusercontent.com/..."
                className="w-full px-3 py-2 bg-white/60 dark:bg-slate-900/60 rounded-xl text-xs font-mono text-[11px] border border-white/50 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />

              <button
                onClick={handleSyncLicense}
                disabled={isSyncingLic}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-purple-600/30 flex items-center justify-center space-x-2"
              >
                <RefreshCw size={14} className={isSyncingLic ? 'animate-spin' : ''} />
                <span>{isSyncingLic ? 'Vérification en cours...' : 'Synchroniser la Licence à Distance'}</span>
              </button>
            </div>

            {/* Infos Statut & Déverrouillage Master */}
            <div className="space-y-3 p-4 bg-slate-500/5 dark:bg-slate-800/30 rounded-2xl border border-white/40 dark:border-slate-700/50 flex flex-col justify-between">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Détails de l'abonnement :</p>
                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 bg-white/40 dark:bg-slate-900/40 p-3 rounded-xl border border-white/30 dark:border-slate-800">
                  <p>• <strong>Statut :</strong> <span className={licenseStatus.status === 'ACTIVE' ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>{licenseStatus.status}</span></p>
                  <p>• <strong>Date d'expiration :</strong> <span className="font-bold">{licenseStatus.expiryDate}</span></p>
                  <p>• <strong>Message Serveur :</strong> {licenseStatus.message}</p>
                </div>
              </div>

              {currentUser?.role === 'ADMIN' && (
                <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                    <Lock size={12} className="text-amber-500" />
                    <span>Déverrouillage Master Hors-Ligne (Admin)</span>
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="password"
                      value={masterCode}
                      onChange={(e) => setMasterCode(e.target.value)}
                      placeholder="Code Master"
                      className="flex-1 px-3 py-1.5 bg-white/60 dark:bg-slate-900/60 rounded-xl text-xs font-bold border border-white/50 dark:border-slate-700 focus:outline-none"
                    />
                    <button
                      onClick={handleMasterRenewal}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold"
                    >
                      Activer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- CARD 4 : MATÉRIEL & IMPRESSION THERMIQUE --- */}
        <div className="liquid-card liquid-glass-3d p-6 space-y-5 border border-emerald-500/20">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Printer size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Matériel & Impression Thermique</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Imprimante de tickets et tiroir-caisse</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Imprimante de Reçus par Défaut</label>
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="w-full px-3 py-2 bg-white/60 dark:bg-slate-900/60 rounded-xl text-xs font-bold border border-white/50 dark:border-slate-700 focus:outline-none"
              >
                <option value="">Sélectionner une imprimante...</option>
                {printers.map((p, idx) => (
                  <option key={idx} value={p.name}>
                    {p.name} {p.isDefault ? '(Par défaut Windows)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-500/5 dark:bg-slate-800/30 rounded-xl border border-white/40 dark:border-slate-700/50">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Ouverture auto tiroir-caisse (ESC/POS)</span>
              <input
                type="checkbox"
                checked={autoCashDrawer}
                onChange={(e) => setAutoCashDrawer(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-500/5 dark:bg-slate-800/30 rounded-xl border border-white/40 dark:border-slate-700/50">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Effets sonores scanner webcam</span>
              <input
                type="checkbox"
                checked={scannerSound}
                onChange={(e) => setScannerSound(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
            </div>

            <button
              onClick={handleSaveHardware}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/30"
            >
              Enregistrer les Réglages Matériel
            </button>
          </div>
        </div>

        {/* --- CARD 5 : PERSONNALISATION BOUTIQUE --- */}
        <div className="liquid-card liquid-glass-3d p-6 space-y-5 border border-pink-500/20">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded-xl">
                <Store size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Personnalisation Boutique</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Nom de l'établissement et logo</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Nom de la Boutique</label>
              <input
                type="text"
                value={shopNameInput}
                onChange={(e) => setShopNameInput(e.target.value)}
                className="w-full px-3 py-2 bg-white/60 dark:bg-slate-900/60 rounded-xl text-xs font-bold border border-white/50 dark:border-slate-700 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Style de Logo 3D</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLogoChoice('option1')}
                  className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center space-x-2 ${
                    logoChoice === 'option1' ? 'bg-pink-600 text-white border-transparent' : 'bg-slate-500/10 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span>Logo Neon Cyan 3D</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLogoChoice('option2')}
                  className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center space-x-2 ${
                    logoChoice === 'option2' ? 'bg-pink-600 text-white border-transparent' : 'bg-slate-500/10 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span>Logo Glass S3D</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleSaveShop}
              className="w-full py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-pink-600/30"
            >
              Mettre à Jour la Boutique
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
