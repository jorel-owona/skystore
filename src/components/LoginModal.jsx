import React, { useState, useEffect } from 'react';
import { Lock, UserCheck, ShieldAlert, KeyRound, CheckCircle2 } from 'lucide-react';
import query from '../utils/db';
import { playClick } from '../utils/sounds';

export default function LoginModal({ isOpen, onClose, currentUser, onLoginSuccess }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setPin('');
      setError('');
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      const res = await query('SELECT * FROM utilisateurs WHERE actif = 1 ORDER BY nom ASC');
      setUsers(res || []);
      if (res && res.length > 0) {
        setSelectedUser(res[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNumberClick = (num) => {
    playClick();
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleDelete = () => {
    playClick();
    setPin(prev => prev.slice(0, -1));
  };

  const handleLogin = async () => {
    if (!selectedUser) return;
    if (selectedUser.pin_code === pin) {
      playClick();
      onLoginSuccess(selectedUser);
      onClose();
    } else {
      setError('Code PIN incorrect');
      setPin('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-500/20">
            <Lock size={32} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">Connexion Caisse</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Saisissez votre code PIN d'accès</p>
        </div>

        {/* Choix de l'utilisateur */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
            Utilisateur
          </label>
          <div className="grid grid-cols-2 gap-2">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => {
                  playClick();
                  setSelectedUser(u);
                  setPin('');
                  setError('');
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between border ${
                  selectedUser?.id === u.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>{u.nom}</span>
                <span className="opacity-75 text-[10px] uppercase">({u.role})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Affichage du code PIN */}
        <div className="mb-4 text-center">
          <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-3 px-4">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  pin.length > i
                    ? 'bg-blue-600 dark:bg-blue-400 scale-110 shadow-sm'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
            ))}
          </div>
          {error && <p className="text-xs text-rose-500 font-semibold mt-2 animate-bounce">{error}</p>}
        </div>

        {/* Pavé numérique */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xl font-bold transition active:scale-95 border border-slate-200/50 dark:border-slate-700/50"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleDelete}
            className="h-12 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-bold transition active:scale-95 border border-rose-500/20"
          >
            Effacer
          </button>
          <button
            onClick={() => handleNumberClick('0')}
            className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xl font-bold transition active:scale-95 border border-slate-200/50 dark:border-slate-700/50"
          >
            0
          </button>
          <button
            onClick={handleLogin}
            className="h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition active:scale-95 flex items-center justify-center shadow-lg shadow-blue-600/30"
          >
            <CheckCircle2 size={24} />
          </button>
        </div>

        {currentUser && (
          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
