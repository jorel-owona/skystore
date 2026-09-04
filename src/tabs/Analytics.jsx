import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, ShoppingBag, Receipt, PieChart as PieIcon, Calendar, RefreshCw } from 'lucide-react';
import query from '../utils/db';

export default function Analytics({ addToast }) {
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [period, setPeriod] = useState('30'); // '7', '30', '365'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalyticsData();
  }, [period]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Chargement des ventes
      const salesData = await query(
        `SELECT v.id, v.date_vente, v.total_facture, v.moyen_paiement, v.statut_facture,
                (SELECT SUM(dv.quantite * p.prix_achat) 
                 FROM details_ventes dv 
                 JOIN produits p ON dv.item_id = p.id 
                 WHERE dv.vente_id = v.id AND dv.type_item = 'Produit') as total_cout_achat
         FROM ventes v
         WHERE v.statut_facture = 'Valide'
         ORDER BY v.date_vente ASC`
      );

      // Chargement des dépenses
      const expData = await query('SELECT * FROM depenses ORDER BY date_depense ASC');

      // Chargement du top 5 des produits
      const topData = await query(
        `SELECT p.nom, SUM(dv.quantite) as total_qte, SUM(dv.quantite * dv.prix_unitaire_vendu) as total_revenu
         FROM details_ventes dv
         JOIN produits p ON dv.item_id = p.id
         WHERE dv.type_item = 'Produit'
         GROUP BY p.id
         ORDER BY total_qte DESC
         LIMIT 5`
      );

      setSales(salesData || []);
      setExpenses(expData || []);
      setTopProducts(topData || []);
    } catch (err) {
      console.error('Erreur chargement analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrage selon la période
  const now = new Date();
  const daysLimit = parseInt(period, 10);
  const cutoffDate = new Date(now.getTime() - daysLimit * 24 * 60 * 60 * 1000);

  const filteredSales = sales.filter(s => new Date(s.date_vente) >= cutoffDate);
  const filteredExpenses = expenses.filter(e => new Date(e.date_depense) >= cutoffDate);

  // Calculs KPI
  const totalCA = filteredSales.reduce((acc, s) => acc + (s.total_facture || 0), 0);
  const totalCoutAchat = filteredSales.reduce((acc, s) => acc + (s.total_cout_achat || 0), 0);
  const totalDepenses = filteredExpenses.reduce((acc, e) => acc + (e.somme || 0), 0);
  const margeBrute = totalCA - totalCoutAchat;
  const margeNette = margeBrute - totalDepenses;
  const nbVentes = filteredSales.length;
  const panierMoyen = nbVentes > 0 ? Math.round(totalCA / nbVentes) : 0;

  // Préparation données du graphique d'évolution quotidienne
  const dailyDataMap = {};
  filteredSales.forEach(s => {
    const day = s.date_vente ? s.date_vente.slice(0, 10) : 'Inconnu';
    if (!dailyDataMap[day]) dailyDataMap[day] = { date: day, ventes: 0, benefice: 0 };
    dailyDataMap[day].ventes += s.total_facture;
    dailyDataMap[day].benefice += (s.total_facture - (s.total_cout_achat || 0));
  });

  const chartDailyData = Object.values(dailyDataMap).sort((a, b) => a.date.localeCompare(b.date));

  // Préparation données Répartition Moyen de Paiement
  const paymentMap = {};
  filteredSales.forEach(s => {
    const mode = s.moyen_paiement || 'Cash';
    paymentMap[mode] = (paymentMap[mode] || 0) + s.total_facture;
  });

  const paymentColors = {
    'Cash': '#10B981',
    'Orange Money': '#F97316',
    'Mobile Money': '#EAB308',
    'Carte': '#3B82F6'
  };

  const paymentChartData = Object.keys(paymentMap).map(mode => ({
    name: mode,
    value: paymentMap[mode],
    color: paymentColors[mode] || '#6B7280'
  }));

  const formatFCFA = (val) => `${Math.round(val).toLocaleString('fr-FR')} FCFA`;

  return (
    <div className="space-y-6">
      {/* En-tête avec filtres de période */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center liquid-card p-6 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center space-x-3">
            <PieIcon className="text-blue-600 dark:text-blue-400" size={28} />
            <span>Tableau de Bord Financier & Analytics</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Analyse des bénéfices réels, dépenses et tendances de vente
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {['7', '30', '365'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition shadow-sm border ${
                period === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              {p === '7' ? '7 derniers jours' : p === '30' ? '30 derniers jours' : 'Année en cours'}
            </button>
          ))}
          <button
            onClick={loadAnalyticsData}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition border border-slate-200 dark:border-slate-700"
            title="Rafraîchir"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Chiffre d'affaires */}
        <div className="liquid-card liquid-glass-3d p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chiffre d'Affaires</span>
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatFCFA(totalCA)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{nbVentes} ventes enregistrées</p>
        </div>

        {/* Marge Nette Réelle */}
        <div className="liquid-card liquid-glass-3d p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Marge Nette Réelle</span>
            <div className={`p-2 rounded-xl ${margeNette >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
              {margeNette >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
          </div>
          <p className={`text-2xl font-black ${margeNette >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatFCFA(margeNette)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Bénéfice brut ({formatFCFA(margeBrute)}) - Dépenses
          </p>
        </div>

        {/* Dépenses Totales */}
        <div className="liquid-card liquid-glass-3d p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dépenses Boutique</span>
            <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
              <Receipt size={20} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatFCFA(totalDepenses)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{filteredExpenses.length} charges déduites</p>
        </div>

        {/* Panier Moyen */}
        <div className="liquid-card liquid-glass-3d p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Panier Moyen</span>
            <div className="p-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-xl">
              <ShoppingBag size={20} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatFCFA(panierMoyen)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Moyenne par client</p>
        </div>
      </div>

      {/* Graphiques Principaux */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Évolution Ventes & Bénéfice */}
        <div className="lg:col-span-2 liquid-card p-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
            Évolution des Ventes & Bénéfices
          </h3>
          <div className="h-72 w-full">
            {chartDailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartDailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVentes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorBenefice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" stroke="#888888" fontSize={11} />
                  <YAxis stroke="#888888" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '16px', border: 'none', color: '#fff' }}
                    formatter={(val) => formatFCFA(val)}
                  />
                  <Area type="monotone" dataKey="ventes" name="Chiffre d'Affaires" stroke="#3B82F6" fillOpacity={1} fill="url(#colorVentes)" strokeWidth={3} />
                  <Area type="monotone" dataKey="benefice" name="Bénéfice Brut" stroke="#10B981" fillOpacity={1} fill="url(#colorBenefice)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                Aucune donnée de vente sur la période sélectionnée
              </div>
            )}
          </div>
        </div>

        {/* Répartition des modes de paiement */}
        <div className="liquid-card p-6 flex flex-col justify-between">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
            Modes de Paiement
          </h3>
          <div className="h-56 w-full">
            {paymentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatFCFA(val)} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                Aucun paiement
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Produits Plus Vendus */}
      <div className="liquid-card p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
          Top 5 des Produits les Plus Rentables
        </h3>
        <div className="space-y-3">
          {topProducts.map((p, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center text-sm">
                  #{idx + 1}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100">{p.nom}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{p.total_qte} unités vendues</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-extrabold text-blue-600 dark:text-blue-400">{formatFCFA(p.total_revenu)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
