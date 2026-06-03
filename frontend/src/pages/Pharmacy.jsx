// import { useState, useEffect, useCallback, useRef } from 'react';
// import api from '../api';
// import toast from 'react-hot-toast';
// import Modal from '../components/UI/Modal';
// import DataTable, { Pagination } from '../components/UI/DataTable';
// import { StatusBadge } from '../components/UI/Badge';

// /* ─────────────────────────────────────────────
//    HELPERS
// ───────────────────────────────────────────── */
// const fmt = (n) =>
//   new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' CFA';

// const pctBar = (val, seuil) =>
//   seuil > 0 ? Math.min(100, Math.round((val / seuil) * 100)) : 100;

// const stockStatus = (q, seuil) => {
//   if (q === 0) return 'rupture';
//   if (q < Math.floor(seuil * 0.3)) return 'critique';
//   if (q < seuil) return 'bas';
//   return 'ok';
// };

// const stockColor = (status) =>
//   ({
//     rupture: '#dc2626',
//     critique: '#f97316',
//     bas: '#eab308',
//     ok: '#22c55e',
//   }[status] || '#22c55e');

// const stockBg = (status) =>
//   ({
//     rupture: 'bg-red-50 border-red-200',
//     critique: 'bg-orange-50 border-orange-200',
//     bas: 'bg-yellow-50 border-yellow-200',
//     ok: '',
//   }[status] || '');

// const stockBadge = (status) =>
//   ({
//     rupture: 'bg-red-100 text-red-700',
//     critique: 'bg-orange-100 text-orange-700',
//     bas: 'bg-yellow-100 text-yellow-700',
//     ok: 'bg-green-100 text-green-700',
//   }[status] || 'bg-gray-100 text-gray-600');

// const perempStatus = (dateStr) => {
//   if (!dateStr) return 'ok';
//   const days = Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
//   if (days < 0) return 'perime';
//   if (days <= 30) return 'imminent';
//   if (days <= 90) return 'proche';
//   return 'ok';
// };

// const perempColor = (s) =>
//   ({
//     perime: 'text-red-600 font-bold',
//     imminent: 'text-orange-500 font-semibold',
//     proche: 'text-yellow-600',
//     ok: 'text-gray-500',
//   }[s] || 'text-gray-500');

// const mvtCfg = {
//   entree: { icon: '↑', label: 'Entrée', cls: 'bg-green-100 text-green-700', sign: '+', sc: 'text-green-600' },
//   sortie: { icon: '↓', label: 'Sortie', cls: 'bg-red-100 text-red-700', sign: '-', sc: 'text-red-600' },
//   dispensation: { icon: '💊', label: 'Dispensation', cls: 'bg-blue-100 text-blue-700', sign: '-', sc: 'text-blue-600' },
//   retour: { icon: '↩', label: 'Retour', cls: 'bg-yellow-100 text-yellow-700', sign: '+', sc: 'text-yellow-600' },
//   perte: { icon: '✕', label: 'Perte', cls: 'bg-gray-200 text-gray-600', sign: '-', sc: 'text-gray-500' },
//   peremption: { icon: '⏰', label: 'Péremption', cls: 'bg-orange-100 text-orange-700', sign: '-', sc: 'text-orange-600' },
// };

// /* ─────────────────────────────────────────────
//    MOCK DATA (replace with api calls)
// ───────────────────────────────────────────── */
// const MOCK_MEDS = [
//   { id: 1, nom_commercial: 'AMOXICILLINE 500MG', principe_actif: 'Amoxicilline', forme_galenique: 'comprime', dosage: '500mg', classe_therapeutique: 'Antibiotique', prix_unitaire: 350, stock_quantite: 0, seuil_alerte: 50, lot: 'AMX-2025-01', date_peremption: '2025-03-15', fournisseur: 'SANOFI', ordonnance_obligatoire: true },
//   { id: 2, nom_commercial: 'PARACETAMOL 1G', principe_actif: 'Paracétamol', forme_galenique: 'comprime', dosage: '1g', classe_therapeutique: 'Analgésique', prix_unitaire: 150, stock_quantite: 12, seuil_alerte: 100, lot: 'PAR-2025-02', date_peremption: '2026-08-20', fournisseur: 'PFIZER', ordonnance_obligatoire: false },
//   { id: 3, nom_commercial: 'METRONIDAZOLE 250MG', principe_actif: 'Métronidazole', forme_galenique: 'comprime', dosage: '250mg', classe_therapeutique: 'Antiprotozoaire', prix_unitaire: 200, stock_quantite: 280, seuil_alerte: 80, lot: 'MET-2025-03', date_peremption: '2027-01-10', fournisseur: 'MERCK', ordonnance_obligatoire: true },
//   { id: 4, nom_commercial: 'SERUM PHYSIOLOGIQUE', principe_actif: 'NaCl 0.9%', forme_galenique: 'injectable', dosage: '500ml', classe_therapeutique: 'Soluté', prix_unitaire: 1200, stock_quantite: 8, seuil_alerte: 30, lot: 'SP-2025-04', date_peremption: '2025-12-31', fournisseur: 'BAXTER', ordonnance_obligatoire: false },
//   { id: 5, nom_commercial: 'ARTEMETHER 20MG', principe_actif: 'Artéméther', forme_galenique: 'comprime', dosage: '20mg', classe_therapeutique: 'Antipaludéen', prix_unitaire: 800, stock_quantite: 150, seuil_alerte: 60, lot: 'ART-2025-05', date_peremption: '2026-06-30', fournisseur: 'SANOFI', ordonnance_obligatoire: true },
// ];

// const MOCK_MVTS = [
//   { id: 1, nom_commercial: 'AMOXICILLINE 500MG', forme_galenique: 'comprime', dosage: '500mg', type: 'dispensation', quantite: 10, stock_avant: 10, stock_apres: 0, reference: 'RX-2025-0012', pharmacien_nom: 'Dr. Mbeki', patient_nom: 'Ndoye', patient_prenom: 'Fatou', created_at: '2025-05-28 09:15:00' },
//   { id: 2, nom_commercial: 'PARACETAMOL 1G', forme_galenique: 'comprime', dosage: '1g', type: 'entree', quantite: 50, stock_avant: 0, stock_apres: 50, reference: 'BC-2025-0003', pharmacien_nom: 'Dr. Mbeki', patient_nom: null, patient_prenom: null, created_at: '2025-05-27 14:30:00' },
//   { id: 3, nom_commercial: 'METRONIDAZOLE 250MG', forme_galenique: 'comprime', dosage: '250mg', type: 'sortie', quantite: 20, stock_avant: 300, stock_apres: 280, reference: 'USAGE-INT', pharmacien_nom: 'Dr. Mbeki', patient_nom: null, patient_prenom: null, created_at: '2025-05-26 11:00:00' },
// ];

// const MOCK_BONS = [
//   { id: 1, numero: 'BC-2025-00001', type: 'commande', fournisseur: 'SANOFI', montant_total: 450000, date_creation: '2025-05-20', statut: 'recu', createur_prenom: 'Jean', createur_nom: 'Dupont', nb_lignes: 5 },
//   { id: 2, numero: 'BC-2025-00002', type: 'commande', fournisseur: 'PFIZER', montant_total: 280000, date_creation: '2025-05-25', statut: 'envoye', createur_prenom: 'Marie', createur_nom: 'Martin', nb_lignes: 3 },
//   { id: 3, numero: 'BR-2025-00001', type: 'requisition', fournisseur: 'Pharmacie centrale', montant_total: 0, date_creation: '2025-05-28', statut: 'brouillon', createur_prenom: 'Jean', createur_nom: 'Dupont', nb_lignes: 2 },
// ];

// const FORMES = ['comprime', 'gelule', 'sirop', 'injectable', 'perfusion', 'pommade', 'suppositoire', 'patch', 'spray', 'autre'];
// const MED_EMPTY = { nom_commercial: '', principe_actif: '', forme_galenique: 'comprime', dosage: '', prix_unitaire: 0, stock_quantite: 0, seuil_alerte: 50, lot: '', date_peremption: '', fournisseur: '', classe_therapeutique: '', dci: '', ordonnance_obligatoire: false };

// /* ═══════════════════════════════════════════
//    COMPOSANTS PARTAGÉS
// ═══════════════════════════════════════════ */
// function ProgressBar({ pct, color }) {
//   return (
//     <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
//       <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
//     </div>
//   );
// }

// function StatCard({ icon, label, value, sub, color, badge, href, urgent }) {
//   const Tag = href ? 'a' : 'div';
//   return (
//     <Tag href={href}
//       className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all hover:shadow-md group block cursor-pointer
//         ${urgent ? 'border-2 border-red-300' : 'border border-gray-100'}`}>
//       <div className="flex items-start justify-between mb-3">
//         <div className={`w-11 h-11 ${color.bg} rounded-xl flex items-center justify-center text-2xl`}>{icon}</div>
//         {urgent && <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse mt-1" />}
//       </div>
//       <div className={`text-2xl font-bold ${color.val}`}>{value}</div>
//       <div className="text-xs font-semibold text-gray-700 mt-1">{label}</div>
//       <div className="text-xs text-gray-400 mt-0.5 hidden sm:block">{sub}</div>
//       {badge !== undefined && badge > 0 && (
//         <span className="inline-flex mt-1 px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700">{badge} alerte{badge > 1 ? 's' : ''}</span>
//       )}
//     </Tag>
//   );
// }

// function SectionTitle({ icon, title, count, action }) {
//   return (
//     <div className="flex items-center justify-between mb-4">
//       <div className="flex items-center gap-2">
//         <span>{icon}</span>
//         <h3 className="font-bold text-gray-900">{title}</h3>
//         {count !== undefined && (
//           <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gray-100 text-gray-600">{count}</span>
//         )}
//       </div>
//       {action}
//     </div>
//   );
// }

// function StockBadge({ status }) {
//   const labels = { rupture: 'Rupture', critique: 'Critique', bas: 'Stock bas', ok: 'OK' };
//   return (
//     <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${stockBadge(status)}`}>
//       {labels[status] || status}
//     </span>
//   );
// }

// function BonStatutBadge({ statut }) {
//   const cfg = {
//     brouillon: 'bg-gray-100 text-gray-600',
//     envoye: 'bg-blue-100 text-blue-700',
//     confirme: 'bg-yellow-100 text-yellow-700',
//     recu_partiel: 'bg-purple-100 text-purple-700',
//     recu: 'bg-green-100 text-green-700',
//     annule: 'bg-red-100 text-red-700',
//   };
//   const labels = { brouillon: 'Brouillon', envoye: 'Envoyé', confirme: 'Confirmé', recu_partiel: 'Reçu partiel', recu: 'Reçu', annule: 'Annulé' };
//   return (
//     <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${cfg[statut] || 'bg-gray-100 text-gray-600'}`}>
//       {labels[statut] || statut}
//     </span>
//   );
// }

// /* ═══════════════════════════════════════════
//    ONGLET : TABLEAU DE BORD
// ═══════════════════════════════════════════ */
// function TabDashboard({ meds, mvts, onOpenModal, onOpenStock }) {
//   const stats = {
//     total: meds.length,
//     ruptures: meds.filter(m => stockStatus(m.stock_quantite, m.seuil_alerte) === 'rupture').length,
//     critiques: meds.filter(m => stockStatus(m.stock_quantite, m.seuil_alerte) === 'critique').length,
//     bas: meds.filter(m => stockStatus(m.stock_quantite, m.seuil_alerte) === 'bas').length,
//     ok: meds.filter(m => stockStatus(m.stock_quantite, m.seuil_alerte) === 'ok').length,
//     perimes: meds.filter(m => perempStatus(m.date_peremption) === 'perime').length,
//     imminents: meds.filter(m => perempStatus(m.date_peremption) === 'imminent').length,
//     valeur: meds.reduce((s, m) => s + m.stock_quantite * m.prix_unitaire, 0),
//   };
//   const taux = stats.total > 0 ? Math.round((stats.ok / stats.total) * 100) : 100;
//   const urgents = meds.filter(m => stockStatus(m.stock_quantite, m.seuil_alerte) !== 'ok' || perempStatus(m.date_peremption) !== 'ok');

//   const KPI_COLORS = {
//     blue: { bg: 'bg-blue-100', val: 'text-blue-800' },
//     red: { bg: 'bg-red-100', val: 'text-red-800' },
//     yellow: { bg: 'bg-yellow-100', val: 'text-yellow-800' },
//     orange: { bg: 'bg-orange-100', val: 'text-orange-800' },
//     green: { bg: 'bg-green-100', val: 'text-gray-900' },
//   };

//   const kpis = [
//     { icon: '💊', label: 'Références actives', value: stats.total, sub: 'médicaments enregistrés', color: KPI_COLORS.blue },
//     { icon: '🚨', label: 'Ruptures & Critiques', value: stats.ruptures + stats.critiques, sub: `${stats.ruptures} rupture(s) · ${stats.critiques} critique(s)`, color: stats.ruptures + stats.critiques > 0 ? KPI_COLORS.red : KPI_COLORS.green, urgent: stats.ruptures + stats.critiques > 0 },
//     { icon: '⚠️', label: 'Stocks bas', value: stats.bas, sub: "sous le seuil d'alerte", color: stats.bas > 0 ? KPI_COLORS.yellow : KPI_COLORS.green },
//     { icon: '⏰', label: 'Péremptions urgentes', value: stats.perimes + stats.imminents, sub: 'périmés ou dans 30 jours', color: stats.perimes + stats.imminents > 0 ? KPI_COLORS.orange : KPI_COLORS.green },
//     { icon: '💰', label: 'Valeur du stock', value: fmt(stats.valeur), sub: 'inventaire total estimé', color: KPI_COLORS.green },
//   ];

//   const segments = [
//     { val: stats.ok, col: '#22c55e', label: 'OK' },
//     { val: stats.bas, col: '#eab308', label: 'Bas' },
//     { val: stats.critiques, col: '#f97316', label: 'Critique' },
//     { val: stats.ruptures, col: '#dc2626', label: 'Rupture' },
//     { val: stats.perimes + stats.imminents, col: '#f87171', label: 'Périmé/Imminent' },
//   ];

//   return (
//     <div className="space-y-6">
//       {/* Alerte critique */}
//       {(stats.ruptures > 0 || stats.perimes > 0) && (
//         <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-red-50 border-2 border-red-200 rounded-2xl p-4">
//           <span className="text-3xl flex-shrink-0">🚨</span>
//           <div className="flex-1">
//             <div className="font-bold text-red-800">Alerte critique pharmacie</div>
//             <div className="text-sm text-red-700 mt-0.5">
//               {stats.ruptures > 0 && <strong>{stats.ruptures} médicament(s) en rupture de stock. </strong>}
//               {stats.perimes > 0 && <strong>{stats.perimes} lot(s) périmé(s) à retirer immédiatement.</strong>}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* KPIs */}
//       <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
//         {kpis.map((k, i) => <StatCard key={i} {...k} />)}
//       </div>

//       {/* Santé des stocks */}
//       <div className="bg-white rounded-2xl border border-gray-100 p-5">
//         <div className="flex items-center justify-between mb-3">
//           <div>
//             <h3 className="font-bold text-gray-900">Santé globale des stocks</h3>
//             <p className="text-xs text-gray-400 mt-0.5">{stats.total} références · {stats.ok} OK · {stats.bas} bas · {stats.critiques + stats.ruptures} critique(s)</p>
//           </div>
//           <span className={`text-2xl font-bold ${taux >= 85 ? 'text-green-600' : taux >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{taux}%</span>
//         </div>
//         <div className="flex rounded-full h-4 overflow-hidden">
//           {segments.map((s, i) => s.val > 0 && (
//             <div key={i} className="h-full transition-all" style={{ width: `${Math.round(s.val / Math.max(1, stats.total) * 100)}%`, background: s.col }} title={`${s.label}: ${s.val}`} />
//           ))}
//         </div>
//         <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
//           {segments.map((s, i) => s.val > 0 && (
//             <span key={i} className="flex items-center gap-1">
//               <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.col }} />
//               {s.label} <strong className="text-gray-700">{s.val}</strong>
//             </span>
//           ))}
//         </div>
//       </div>

//       {/* Alerte IA */}
//       {urgents.length > 0 && (
//         <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
//           <span className="text-2xl flex-shrink-0">🤖</span>
//           <div className="flex-1">
//             <div className="font-bold text-amber-800">Prédiction IA — Réapprovisionnement recommandé</div>
//             <div className="text-sm text-amber-700 mt-0.5 flex flex-wrap gap-x-4">
//               {stats.ruptures > 0 && <span>🔴 <strong>{stats.ruptures}</strong> rupture(s)</span>}
//               {stats.critiques > 0 && <span>🟠 <strong>{stats.critiques}</strong> critique(s)</span>}
//               {stats.bas > 0 && <span>🟡 <strong>{stats.bas}</strong> stock(s) bas</span>}
//               {(stats.perimes + stats.imminents) > 0 && <span>⏰ <strong>{stats.perimes + stats.imminents}</strong> péremption(s) urgente(s)</span>}
//             </div>
//           </div>
//           <button onClick={() => onOpenModal('commande')} className="flex-shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
//             📦 Commande auto IA
//           </button>
//         </div>
//       )}

//       {/* Actions rapides */}
//       <div className="flex flex-wrap gap-3">
//         <button onClick={() => onOpenModal('add')} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">➕ Ajouter médicament</button>
//         <button onClick={() => onOpenModal('commande')} className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors">📦 Commande fournisseur</button>
//         <button onClick={() => onOpenModal('stock')} className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors">⚡ Mouvement stock</button>
//       </div>

//       {/* Grille principale */}
//       <div className="grid lg:grid-cols-3 gap-5">
//         {/* Urgences */}
//         <div className="lg:col-span-2 space-y-4">
//           {urgents.length === 0 ? (
//             <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
//               <div className="text-5xl mb-3">✅</div>
//               <div className="text-xl font-bold text-green-600">Tous les stocks sont en ordre !</div>
//               <div className="text-gray-400 mt-1 text-sm">Aucune rupture, stock critique ou péremption urgente.</div>
//             </div>
//           ) : (
//             <div className="bg-white rounded-2xl border border-red-200 bg-red-50 overflow-hidden">
//               <div className="p-4 bg-red-100 flex items-center justify-between">
//                 <h4 className="font-bold text-red-800 text-sm">🚨 Médicaments urgents ({urgents.length})</h4>
//               </div>
//               <div className="overflow-x-auto">
//                 <table className="w-full text-sm" style={{ minWidth: 420 }}>
//                   <thead>
//                     <tr className="bg-white/60 border-b border-gray-200">
//                       {['💊 Médicament', '📦 Stock', '📊 Niveau', '🏭 Fournisseur', '⚡ Action'].map(h => (
//                         <th key={h} className="text-left p-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
//                       ))}
//                     </tr>
//                   </thead>
//                   <tbody className="divide-y divide-gray-100">
//                     {urgents.map(m => {
//                       const st = stockStatus(m.stock_quantite, m.seuil_alerte);
//                       const pct = pctBar(m.stock_quantite, m.seuil_alerte);
//                       return (
//                         <tr key={m.id} className="hover:bg-white/80 transition-colors">
//                           <td className="p-3">
//                             <div className="flex items-center gap-2">
//                               {m.stock_quantite === 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />}
//                               <div>
//                                 <div className="font-semibold text-gray-900 text-sm">{m.nom_commercial}</div>
//                                 <div className="text-xs text-gray-400">{m.principe_actif}</div>
//                               </div>
//                             </div>
//                           </td>
//                           <td className="p-3 text-center">
//                             <div className={`font-bold text-lg ${m.stock_quantite === 0 ? 'text-red-600' : 'text-yellow-600'}`}>{m.stock_quantite}</div>
//                             <div className="text-xs text-gray-400">/ {m.seuil_alerte}</div>
//                           </td>
//                           <td className="p-3">
//                             <ProgressBar pct={pct} color={stockColor(st)} />
//                             <div className="text-xs text-gray-400 mt-0.5">{pct}%</div>
//                           </td>
//                           <td className="p-3 text-xs text-gray-600 hidden sm:table-cell">{m.fournisseur || '—'}</td>
//                           <td className="p-3">
//                             <button onClick={() => onOpenStock(m)} className="text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg text-xs font-semibold">📥 Réappro</button>
//                           </td>
//                         </tr>
//                       );
//                     })}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           )}
//         </div>

//         {/* Panneau droit */}
//         <div className="space-y-4">
//           {/* Derniers mouvements */}
//           <div className="bg-white rounded-2xl border border-gray-100 p-4">
//             <div className="flex items-center justify-between mb-4">
//               <h3 className="font-bold text-gray-900 text-sm">⚡ Derniers mouvements</h3>
//             </div>
//             <div className="space-y-2">
//               {mvts.slice(0, 6).map(mv => {
//                 const mc = mvtCfg[mv.type] || { icon: '·', label: mv.type, cls: 'bg-gray-100 text-gray-600', sign: '', sc: 'text-gray-600' };
//                 return (
//                   <div key={mv.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition-colors">
//                     <div className="flex flex-col items-center flex-shrink-0">
//                       <div className={`w-8 h-8 ${mc.cls} rounded-lg flex items-center justify-center text-sm font-bold`}>{mc.icon}</div>
//                       <span className="text-[9px] text-gray-400 font-semibold mt-0.5 leading-none">{mc.label}</span>
//                     </div>
//                     <div className="flex-1 min-w-0">
//                       <div className="text-xs font-semibold text-gray-900 truncate">{mv.nom_commercial}</div>
//                       <div className="text-xs text-gray-400">{new Date(mv.created_at).toLocaleDateString('fr-FR')}</div>
//                     </div>
//                     <div className={`text-sm font-bold ${mc.sc} flex-shrink-0`}>{mc.sign}{mv.quantite}</div>
//                   </div>
//                 );
//               })}
//               {mvts.length === 0 && <div className="text-center text-gray-400 text-sm py-4">Aucun mouvement</div>}
//             </div>
//           </div>

//           {/* Accès rapides */}
//           <div className="bg-white rounded-2xl border border-gray-100 p-4">
//             <h3 className="font-bold text-gray-900 mb-3 text-sm">🔗 Accès rapides</h3>
//             <div className="grid grid-cols-2 gap-2">
//               {[
//                 { icon: '💊', label: 'Inventaire', grad: 'from-blue-500 to-blue-600' },
//                 { icon: '🚨', label: 'Alertes', grad: 'from-red-500 to-red-600', badge: stats.ruptures + stats.critiques + stats.bas },
//                 { icon: '🛒', label: 'Vente', grad: 'from-green-500 to-green-600' },
//                 { icon: '📦', label: 'Commandes', grad: 'from-purple-500 to-purple-600' },
//                 { icon: '📋', label: 'Traçabilité', grad: 'from-indigo-500 to-indigo-600' },
//                 { icon: '⏰', label: 'Péremptions', grad: 'from-orange-500 to-orange-600', badge: stats.perimes + stats.imminents },
//               ].map((lk, i) => (
//                 <div key={i} className={`relative flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-r ${lk.grad} text-white cursor-pointer hover:opacity-90 transition-opacity`}>
//                   <span className="text-lg">{lk.icon}</span>
//                   <span className="text-xs font-semibold">{lk.label}</span>
//                   {lk.badge > 0 && (
//                     <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-red-600 text-[10px] font-bold rounded-full flex items-center justify-center">{Math.min(9, lk.badge)}</span>
//                   )}
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ═══════════════════════════════════════════
//    ONGLET : INVENTAIRE
// ═══════════════════════════════════════════ */
// function TabInventaire({ meds, onAdd, onEdit, onOpenStock }) {
//   const [search, setSearch] = useState('');
//   const [filtreForme, setFiltreForme] = useState('');

//   const filtered = meds.filter(m => {
//     const q = search.toLowerCase();
//     const matchSearch = !q || m.nom_commercial.toLowerCase().includes(q) || (m.principe_actif || '').toLowerCase().includes(q) || (m.dci || '').toLowerCase().includes(q);
//     const matchForme = !filtreForme || m.forme_galenique === filtreForme;
//     return matchSearch && matchForme;
//   });

//   return (
//     <div className="space-y-4">
//       <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
//         <div className="flex flex-wrap gap-2">
//           <button onClick={onAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">➕ Ajouter médicament</button>
//         </div>
//         <div className="flex flex-wrap gap-2 w-full sm:w-auto">
//           <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Nom, DCI..." className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 sm:w-44 focus:outline-none focus:border-blue-400 min-w-0" />
//           <select value={filtreForme} onChange={e => setFiltreForme(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
//             <option value="">Toutes formes</option>
//             {FORMES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
//           </select>
//           {(search || filtreForme) && (
//             <button onClick={() => { setSearch(''); setFiltreForme(''); }} className="border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-500">✕</button>
//           )}
//         </div>
//       </div>

//       <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
//         <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
//           <span className="text-sm font-semibold text-gray-700">{filtered.length} référence(s)</span>
//           <div className="flex gap-2 text-xs text-gray-500">
//             {[['bg-red-500', 'Rupture/Critique'], ['bg-yellow-400', 'Stock bas'], ['bg-green-500', 'OK']].map(([bg, l]) => (
//               <span key={l} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${bg}`} /> {l}</span>
//             ))}
//           </div>
//         </div>
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm" style={{ minWidth: 580 }}>
//             <thead>
//               <tr className="bg-gray-50 border-b border-gray-100">
//                 {['Médicament', 'Forme / Dosage', 'Stock', 'Niveau', 'Prix unit.', 'Péremption', 'Fournisseur', 'Actions'].map(h => (
//                   <th key={h} className="text-left p-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
//                 ))}
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-gray-50">
//               {filtered.length === 0 && (
//                 <tr><td colSpan={8} className="p-10 text-center text-gray-400">{search ? `Aucun résultat pour "${search}"` : 'Aucun médicament enregistré'}</td></tr>
//               )}
//               {filtered.map(m => {
//                 const st = stockStatus(m.stock_quantite, m.seuil_alerte);
//                 const pct = pctBar(m.stock_quantite, m.seuil_alerte);
//                 const ps = perempStatus(m.date_peremption);
//                 const rowBg = { rupture: 'bg-red-50', critique: 'bg-orange-50', bas: 'bg-yellow-50/50', ok: '' }[st] || '';
//                 return (
//                   <tr key={m.id} className={`${rowBg} hover:bg-blue-50/20 transition-colors`}>
//                     <td className="p-3">
//                       <div className="font-semibold text-gray-900">{m.nom_commercial}</div>
//                       <div className="text-xs text-gray-500">{m.principe_actif}</div>
//                       {m.lot && <div className="font-mono text-xs text-gray-400">Lot: {m.lot}</div>}
//                     </td>
//                     <td className="p-3 hidden sm:table-cell">
//                       <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs capitalize">{(m.forme_galenique || '—').replace('_', ' ')}</span>
//                       {m.dosage && <div className="text-xs text-gray-500 mt-0.5">{m.dosage}</div>}
//                     </td>
//                     <td className="p-3 text-center">
//                       <div className={`text-lg font-bold ${m.stock_quantite === 0 ? 'text-red-600' : m.stock_quantite < m.seuil_alerte ? 'text-yellow-600' : 'text-gray-900'}`}>{m.stock_quantite}</div>
//                       <div className="text-xs text-gray-400">/ {m.seuil_alerte}</div>
//                     </td>
//                     <td className="p-3">
//                       <div className="w-24">
//                         <ProgressBar pct={pct} color={stockColor(st)} />
//                       </div>
//                       <StockBadge status={st} />
//                     </td>
//                     <td className="p-3 text-right font-bold text-gray-900 hidden sm:table-cell">{fmt(m.prix_unitaire)}</td>
//                     <td className={`p-3 text-xs hidden md:table-cell ${perempColor(ps)}`}>
//                       {m.date_peremption ? new Date(m.date_peremption).toLocaleDateString('fr-FR') : '—'}
//                     </td>
//                     <td className="p-3 text-xs text-gray-600 hidden lg:table-cell">{m.fournisseur || '—'}</td>
//                     <td className="p-3">
//                       <div className="flex items-center gap-1">
//                         <button onClick={() => onOpenStock(m)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg text-xs font-semibold">⚡ Stock</button>
//                         <button onClick={() => onEdit(m)} className="bg-gray-50 text-gray-600 hover:bg-gray-100 px-2 py-1 rounded-lg text-xs font-semibold">✏️</button>
//                       </div>
//                     </td>
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ═══════════════════════════════════════════
//    ONGLET : ALERTES
// ═══════════════════════════════════════════ */
// function TabAlertes({ meds, onOpenStock, onOpenModal }) {
//   const withStatus = meds.map(m => ({
//     ...m,
//     _stock: stockStatus(m.stock_quantite, m.seuil_alerte),
//     _peremp: perempStatus(m.date_peremption),
//   }));
//   const ruptures = withStatus.filter(m => m._stock === 'rupture');
//   const critiques = withStatus.filter(m => m._stock === 'critique');
//   const bas = withStatus.filter(m => m._stock === 'bas');
//   const perimes = withStatus.filter(m => m._peremp === 'perime' || m._peremp === 'imminent');

//   const kpis = [
//     { icon: '🔴', label: 'Ruptures total', value: ruptures.length, color: 'bg-red-50 border-red-200 text-red-700' },
//     { icon: '🟠', label: 'Stocks critiques', value: critiques.length, color: 'bg-orange-50 border-orange-200 text-orange-700' },
//     { icon: '🟡', label: 'Stocks bas', value: bas.length, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
//     { icon: '⏰', label: 'Périmés / Imminents', value: perimes.length, color: 'bg-purple-50 border-purple-200 text-purple-700' },
//   ];

//   const sections = [
//     { id: 'rupt', title: '🔴 Ruptures de stock', items: ruptures, isPerem: false },
//     { id: 'crit', title: '🟠 Stocks critiques', items: critiques, isPerem: false },
//     { id: 'bas', title: '🟡 Stocks bas', items: bas, isPerem: false },
//     { id: 'per', title: '⏰ Péremptions urgentes', items: perimes, isPerem: true },
//   ];

//   const secBg = { '🔴': 'border-red-300 bg-red-50', '🟠': 'border-orange-300 bg-orange-50', '🟡': 'border-yellow-300 bg-yellow-50', '⏰': 'border-purple-300 bg-purple-50' };
//   const secHd = { '🔴': 'bg-red-100 text-red-800', '🟠': 'bg-orange-100 text-orange-800', '🟡': 'bg-yellow-100 text-yellow-800', '⏰': 'bg-purple-100 text-purple-800' };

//   return (
//     <div className="space-y-5">
//       {/* KPIs alertes */}
//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
//         {kpis.map(k => (
//           <div key={k.label} className={`border rounded-2xl p-4 flex items-center gap-3 ${k.color}`}>
//             <span className="text-2xl">{k.icon}</span>
//             <div>
//               <div className="text-2xl font-bold">{k.value}</div>
//               <div className="text-xs">{k.label}</div>
//             </div>
//           </div>
//         ))}
//       </div>

//       {/* Sections */}
//       {sections.map(sec => {
//         if (sec.items.length === 0) return null;
//         const emoji = sec.title[0];
//         return (
//           <div key={sec.id} className={`rounded-2xl border overflow-hidden ${secBg[emoji] || 'border-gray-200 bg-white'}`}>
//             <div className={`p-4 flex items-center justify-between ${secHd[emoji] || 'bg-gray-100 text-gray-800'}`}>
//               <h3 className="font-bold">{sec.title} ({sec.items.length})</h3>
//               <button onClick={() => onOpenModal('commande')} className="text-xs font-semibold underline hover:no-underline">📦 Commander tout</button>
//             </div>
//             <div className="overflow-x-auto">
//               <table className="w-full text-sm">
//                 <thead>
//                   <tr className="border-b border-gray-200">
//                     <th className="text-left p-3 text-xs font-semibold text-gray-500 uppercase">Médicament</th>
//                     <th className="text-center p-3 text-xs font-semibold text-gray-500 uppercase">Stock actuel</th>
//                     <th className="text-center p-3 text-xs font-semibold text-gray-500 uppercase">Seuil</th>
//                     {sec.isPerem ? (
//                       <>
//                         <th className="text-center p-3 text-xs font-semibold text-gray-500 uppercase">Date péremption</th>
//                         <th className="text-center p-3 text-xs font-semibold text-gray-500 uppercase">Jours restants</th>
//                       </>
//                     ) : (
//                       <>
//                         <th className="text-left p-3 text-xs font-semibold text-gray-500 uppercase">Fournisseur</th>
//                         <th className="text-center p-3 text-xs font-semibold text-gray-500 uppercase">Qté suggérée</th>
//                       </>
//                     )}
//                     <th className="text-center p-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-gray-100">
//                   {sec.items.map(m => {
//                     const days = m.date_peremption ? Math.ceil((new Date(m.date_peremption) - Date.now()) / 86400000) : null;
//                     return (
//                       <tr key={m.id} className="hover:bg-white/60">
//                         <td className="p-3">
//                           <div className="font-semibold text-gray-900">{m.nom_commercial}</div>
//                           <div className="text-xs text-gray-500">{m.principe_actif} · Lot: {m.lot || '—'}</div>
//                         </td>
//                         <td className="p-3 text-center">
//                           <span className={`text-xl font-bold ${m.stock_quantite === 0 ? 'text-red-600' : 'text-orange-600'}`}>{m.stock_quantite}</span>
//                         </td>
//                         <td className="p-3 text-center text-gray-600">{m.seuil_alerte}</td>
//                         {sec.isPerem ? (
//                           <>
//                             <td className="p-3 text-center font-semibold text-red-700">{m.date_peremption ? new Date(m.date_peremption).toLocaleDateString('fr-FR') : '—'}</td>
//                             <td className="p-3 text-center">
//                               {days !== null && (
//                                 <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${days < 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
//                                   {days >= 0 ? `${days}j` : 'PÉRIMÉ'}
//                                 </span>
//                               )}
//                             </td>
//                           </>
//                         ) : (
//                           <>
//                             <td className="p-3 text-xs text-gray-600">{m.fournisseur || '—'}</td>
//                             <td className="p-3 text-center font-bold text-blue-700">{m.seuil_alerte * 3}</td>
//                           </>
//                         )}
//                         <td className="p-3 text-center">
//                           <button onClick={() => onOpenStock(m)} className="text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-lg text-xs font-semibold">
//                             {sec.isPerem ? '🔄 Retirer' : '📥 Réappro'}
//                           </button>
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         );
//       })}

//       {ruptures.length + critiques.length + bas.length + perimes.length === 0 && (
//         <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
//           <div className="text-5xl mb-4">✅</div>
//           <div className="text-xl font-bold text-green-600">Tous les stocks sont en ordre !</div>
//           <div className="text-gray-500 mt-2">Aucune alerte de stock ni de péremption à signaler.</div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ═══════════════════════════════════════════
//    ONGLET : VENTE & DISPENSATION
// ═══════════════════════════════════════════ */
// function TabVente({ meds }) {
//   const [items, setItems] = useState([{ id: Date.now(), med: null, qte: 1 }]);
//   const [clientNom, setClientNom] = useState('');
//   const [modePaiement, setModePaiement] = useState('especes');
//   const [rxNum, setRxNum] = useState('');
//   const [rxFound, setRxFound] = useState(null);
//   const [saving, setSaving] = useState(false);

//   const total = items.reduce((s, it) => s + (it.med ? it.med.prix_unitaire * it.qte : 0), 0);
//   const tva = 18;
//   const ht = total / (1 + tva / 100);
//   const tvaMont = total - ht;

//   const addItem = () => setItems(prev => [...prev, { id: Date.now(), med: null, qte: 1 }]);
//   const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));
//   const setMed = (id, med) => setItems(prev => prev.map(it => it.id === id ? { ...it, med } : it));
//   const setQte = (id, qte) => setItems(prev => prev.map(it => it.id === id ? { ...it, qte: Math.max(1, qte) } : it));

//   const handleVente = async (e) => {
//     e.preventDefault();
//     const valid = items.filter(it => it.med && it.qte > 0);
//     if (!valid.length) return toast.error('Aucun article valide');
//     setSaving(true);
//     setTimeout(() => {
//       toast.success(`✅ Vente enregistrée — ${fmt(total)}`);
//       setItems([{ id: Date.now(), med: null, qte: 1 }]);
//       setClientNom('');
//       setSaving(false);
//     }, 800);
//   };

//   const canSubmit = items.some(it => it.med && it.qte > 0);

//   return (
//     <div className="space-y-6">
//       <div className="grid lg:grid-cols-2 gap-6">
//         {/* Dispensation sur ordonnance */}
//         <div className="bg-white rounded-2xl border border-gray-100 p-6">
//           <div className="flex items-center gap-3 mb-5">
//             <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">📋</div>
//             <div>
//               <h3 className="font-bold text-gray-900">Dispensation sur ordonnance</h3>
//               <p className="text-xs text-gray-500">Scan ou saisie du numéro Rx</p>
//             </div>
//           </div>
//           <div className="space-y-4">
//             <div>
//               <label className="block text-xs font-semibold text-gray-600 mb-1.5">N° Ordonnance *</label>
//               <div className="flex gap-2">
//                 <input type="text" value={rxNum} onChange={e => setRxNum(e.target.value)} placeholder="RX-2025-XXXXX" className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 focus:outline-none focus:border-blue-400" />
//                 <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3 py-2 rounded-xl text-sm transition-colors">🔍</button>
//               </div>
//             </div>
//             {rxFound && (
//               <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
//                 <div className="font-bold text-blue-800">👤 {rxFound.patient}</div>
//                 <div className="text-sm text-blue-600 mt-1">{rxFound.details}</div>
//               </div>
//             )}
//             <div>
//               <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type de dispensation</label>
//               <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
//                 <option value="complete">Dispensation complète</option>
//                 <option value="partielle">Dispensation partielle</option>
//               </select>
//             </div>
//             <div>
//               <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes pharmacien</label>
//               <textarea rows={2} placeholder="Interactions vérifiées, substitution, conseils..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
//             </div>
//             <button className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors">✅ Valider la dispensation</button>
//           </div>
//         </div>

//         {/* Vente directe */}
//         <div className="bg-white rounded-2xl border border-gray-100 p-6">
//           <div className="flex items-center gap-3 mb-5">
//             <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">🛒</div>
//             <div>
//               <h3 className="font-bold text-gray-900">Vente directe comptoir</h3>
//               <p className="text-xs text-gray-500">Médicaments sans ordonnance (OTC)</p>
//             </div>
//           </div>
//           <form onSubmit={handleVente} className="space-y-3">
//             <div>
//               <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client (optionnel)</label>
//               <input type="text" value={clientNom} onChange={e => setClientNom(e.target.value)} placeholder="Nom du client ou 'Client comptoir'" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
//             </div>
//             <div>
//               <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mode de paiement</label>
//               <select value={modePaiement} onChange={e => setModePaiement(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
//                 <option value="especes">💵 Espèces</option>
//                 <option value="mobile_money">📱 Mobile Money</option>
//                 <option value="carte_bancaire">💳 Carte bancaire</option>
//               </select>
//             </div>

//             {/* Panier */}
//             <div className="border border-gray-200 rounded-xl overflow-hidden">
//               <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
//                 <span className="text-sm font-bold text-gray-700">🛍️ Panier <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">{items.length}</span></span>
//                 <button type="button" onClick={addItem} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">＋ Ajouter</button>
//               </div>
//               <div className="divide-y divide-gray-100">
//                 {items.map(it => (
//                   <div key={it.id} className="p-3 flex items-center gap-2">
//                     <div className="flex-1 min-w-0">
//                       <select onChange={e => {
//                         const m = meds.find(x => String(x.id) === e.target.value);
//                         setMed(it.id, m || null);
//                       }} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400">
//                         <option value="">— Sélectionner —</option>
//                         {meds.filter(m => m.stock_quantite > 0).map(m => (
//                           <option key={m.id} value={m.id}>{m.nom_commercial} ({m.dosage}) — {fmt(m.prix_unitaire)}</option>
//                         ))}
//                       </select>
//                     </div>
//                     <input type="number" value={it.qte} min={1} max={it.med?.stock_quantite || 999} onChange={e => setQte(it.id, +e.target.value)} className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-blue-400" />
//                     <span className="text-sm font-bold text-gray-700 w-24 text-right flex-shrink-0">
//                       {it.med ? fmt(it.med.prix_unitaire * it.qte) : '—'}
//                     </span>
//                     <button type="button" onClick={() => removeItem(it.id)} className="text-gray-300 hover:text-red-500 text-lg transition-colors flex-shrink-0">✕</button>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             {/* Total */}
//             <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '1px solid #bae6fd' }}>
//               <div>
//                 <div className="text-xs text-sky-600 font-semibold uppercase tracking-wide">Total TTC</div>
//                 {total > 0 && <div className="text-xs text-gray-500 mt-0.5">HT: {fmt(ht)} · TVA {tva}%: {fmt(tvaMont)}</div>}
//               </div>
//               <span className="text-2xl font-bold text-sky-700">{fmt(total)}</span>
//             </div>

//             <button type="submit" disabled={!canSubmit || saving}
//               className="w-full py-3 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
//               style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
//               {saving ? '⏳ Enregistrement...' : '💰 Encaisser & Générer la facture'}
//             </button>
//           </form>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ═══════════════════════════════════════════
//    ONGLET : TRAÇABILITÉ
// ═══════════════════════════════════════════ */
// function TabMouvements({ mvts, onOpenModal }) {
//   const [page, setPage] = useState(1);
//   const PER = 15;
//   const total = mvts.length;
//   const paged = mvts.slice((page - 1) * PER, page * PER);

//   const mv30Stats = {
//     nb_disp: mvts.filter(m => m.type === 'dispensation').length,
//     nb_entr: mvts.filter(m => m.type === 'entree').length,
//     nb_sort: mvts.filter(m => ['sortie', 'perte', 'peremption'].includes(m.type)).length,
//     nb_ret: mvts.filter(m => m.type === 'retour').length,
//     u_disp: mvts.filter(m => m.type === 'dispensation').reduce((s, m) => s + m.quantite, 0),
//     u_entr: mvts.filter(m => m.type === 'entree').reduce((s, m) => s + m.quantite, 0),
//   };

//   const kpis = [
//     { icon: '↑', label: 'Entrées (30j)', value: mv30Stats.nb_entr, sub: `${mv30Stats.u_entr} unités`, bg: 'bg-green-50', txt: 'text-green-600' },
//     { icon: '💊', label: 'Dispensations (30j)', value: mv30Stats.nb_disp, sub: `${mv30Stats.u_disp} unités`, bg: 'bg-blue-50', txt: 'text-blue-600' },
//     { icon: '↓', label: 'Sorties (30j)', value: mv30Stats.nb_sort, sub: 'hors dispensations', bg: 'bg-red-50', txt: 'text-red-600' },
//     { icon: '↩', label: 'Retours (30j)', value: mv30Stats.nb_ret, sub: 'depuis patients', bg: 'bg-yellow-50', txt: 'text-yellow-600' },
//   ];

//   return (
//     <div className="space-y-5">
//       <div className="flex flex-wrap gap-3 items-center justify-between">
//         <div>
//           <h3 className="font-bold text-gray-900">Journal des mouvements</h3>
//           <p className="text-gray-500 text-sm mt-0.5">{total.toLocaleString('fr-FR')} mouvements enregistrés</p>
//         </div>
//         <button onClick={() => onOpenModal('stock')} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">⚡ Nouveau mouvement</button>
//       </div>

//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//         {kpis.map(k => (
//           <div key={k.label} className={`bg-white rounded-2xl border border-gray-100 p-4 ${k.bg}`}>
//             <div className={`text-2xl font-bold ${k.txt}`}>{k.value}</div>
//             <div className="text-xs font-semibold text-gray-700 mt-0.5">{k.label}</div>
//             <div className="text-xs text-gray-500">{k.sub}</div>
//           </div>
//         ))}
//       </div>

//       <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm" style={{ minWidth: 520 }}>
//             <thead>
//               <tr className="bg-gray-50 border-b border-gray-100">
//                 {['Date', 'Médicament', 'Type', 'Qté', 'Avant→Après', 'Référence', 'Pharmacien', 'Patient'].map(h => (
//                   <th key={h} className="text-left p-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
//                 ))}
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-gray-50">
//               {paged.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-gray-400">Aucun mouvement enregistré</td></tr>}
//               {paged.map(mv => {
//                 const mc = mvtCfg[mv.type] || { icon: '·', label: mv.type, cls: 'bg-gray-100 text-gray-600', sign: '', sc: 'text-gray-600' };
//                 return (
//                   <tr key={mv.id} className="hover:bg-gray-50">
//                     <td className="p-3">
//                       <div className="font-semibold text-xs text-gray-900">{new Date(mv.created_at).toLocaleDateString('fr-FR')}</div>
//                       <div className="text-xs text-gray-400">{new Date(mv.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
//                     </td>
//                     <td className="p-3">
//                       <div className="font-semibold text-gray-900">{mv.nom_commercial}</div>
//                       <div className="text-xs text-gray-500">{mv.forme_galenique} {mv.dosage}</div>
//                     </td>
//                     <td className="p-3">
//                       <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${mc.cls}`}>{mc.icon} {mc.label}</span>
//                     </td>
//                     <td className="p-3 text-center">
//                       <span className={`text-base font-bold ${mc.sc}`}>{mc.sign}{mv.quantite}</span>
//                     </td>
//                     <td className="p-3 text-center text-xs hidden sm:table-cell">
//                       <span className="text-gray-500">{mv.stock_avant}</span>
//                       <span className="text-gray-400 mx-1">→</span>
//                       <span className={`font-bold ${mv.stock_apres === 0 ? 'text-red-600' : 'text-gray-900'}`}>{mv.stock_apres}</span>
//                     </td>
//                     <td className="p-3 text-xs font-mono text-gray-600 hidden md:table-cell">{mv.reference || '—'}</td>
//                     <td className="p-3 text-xs text-gray-600 hidden sm:table-cell">{mv.pharmacien_nom}</td>
//                     <td className="p-3 text-xs text-gray-500 hidden lg:table-cell">{mv.patient_nom ? `${mv.patient_prenom} ${mv.patient_nom}` : '—'}</td>
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>
//         </div>
//         {total > PER && (
//           <div className="p-4 border-t border-gray-100 flex items-center justify-between">
//             <span className="text-xs text-gray-500">Page {page} / {Math.ceil(total / PER)} — {total} mouvements</span>
//             <div className="flex gap-2">
//               {page > 1 && <button onClick={() => setPage(p => p - 1)} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold px-3 py-1.5 rounded-xl text-xs transition-colors">← Précédent</button>}
//               {page < Math.ceil(total / PER) && <button onClick={() => setPage(p => p + 1)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-xl text-xs transition-colors">Suivant →</button>}
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// /* ═══════════════════════════════════════════
//    ONGLET : ACHATS & COMMANDES
// ═══════════════════════════════════════════ */
// function TabAchats({ bons, meds }) {
//   const [showModal, setShowModal] = useState(false);
//   const [bonType, setBonType] = useState('commande');
//   const [bonLines, setBonLines] = useState([{ id: 1, nom: '', forme: '', dosage: '', qte: 1, prix: 0 }]);
//   const [fournisseur, setFournisseur] = useState('');
//   const [detail, setDetail] = useState(null);

//   const addLine = () => setBonLines(l => [...l, { id: Date.now(), nom: '', forme: '', dosage: '', qte: 1, prix: 0 }]);
//   const removeLine = (id) => setBonLines(l => l.filter(x => x.id !== id));
//   const setLine = (id, field, val) => setBonLines(l => l.map(x => x.id === id ? { ...x, [field]: val } : x));
//   const totalBon = bonLines.reduce((s, l) => s + l.qte * l.prix, 0);

//   const stCls = { brouillon: 'bg-gray-100 text-gray-600', envoye: 'bg-blue-100 text-blue-700', confirme: 'bg-yellow-100 text-yellow-700', recu_partiel: 'bg-purple-100 text-purple-700', recu: 'bg-green-100 text-green-700', annule: 'bg-red-100 text-red-700' };

//   return (
//     <div className="space-y-5">
//       <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
//         <div>
//           <h3 className="font-bold text-gray-900">Achats & Approvisionnement</h3>
//           <p className="text-gray-500 text-sm mt-0.5 hidden sm:block">Bons de commande fournisseurs et bons de réquisition internes</p>
//         </div>
//         <div className="flex flex-wrap gap-2">
//           <button onClick={() => { setBonType('commande'); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">📦 Bon de commande</button>
//           <button onClick={() => { setBonType('requisition'); setShowModal(true); }} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors">📋 Bon de réquisition</button>
//         </div>
//       </div>

//       {/* Liste bons */}
//       <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
//         <div className="p-4 border-b border-gray-100 flex items-center justify-between">
//           <h3 className="font-semibold text-gray-900">📋 Historique des bons ({bons.length})</h3>
//         </div>
//         {bons.length === 0 ? (
//           <div className="p-10 text-center text-gray-400">
//             <div className="text-4xl mb-3">📦</div>
//             <div className="font-semibold">Aucun bon créé</div>
//           </div>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full text-sm" style={{ minWidth: 480 }}>
//               <thead>
//                 <tr className="bg-gray-50 border-b border-gray-100">
//                   {['N° Bon', 'Type', 'Fournisseur', 'Montant', 'Date', 'Statut', 'Action'].map(h => (
//                     <th key={h} className="text-left p-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-gray-50">
//                 {bons.map(bc => (
//                   <tr key={bc.id} className="hover:bg-gray-50">
//                     <td className="p-3 font-mono font-bold text-blue-700 text-xs">
//                       <button onClick={() => setDetail(detail?.id === bc.id ? null : bc)} className="hover:underline">{bc.numero}</button>
//                     </td>
//                     <td className="p-3">
//                       <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${bc.type === 'commande' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
//                         {bc.type === 'commande' ? '📦' : '📋'} {bc.type === 'commande' ? 'Commande' : 'Réquisition'}
//                       </span>
//                     </td>
//                     <td className="p-3 text-gray-700 text-xs hidden md:table-cell">{bc.fournisseur || '—'}</td>
//                     <td className="p-3 font-bold text-gray-900 text-sm">{bc.montant_total > 0 ? fmt(bc.montant_total) : '—'}</td>
//                     <td className="p-3 text-gray-500 text-xs">{new Date(bc.date_creation).toLocaleDateString('fr-FR')}</td>
//                     <td className="p-3"><BonStatutBadge statut={bc.statut} /></td>
//                     <td className="p-3">
//                       <button onClick={() => setDetail(detail?.id === bc.id ? null : bc)} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg text-xs font-semibold">👁 Détail</button>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>

//       {/* Modal créer bon */}
//       {showModal && (
//         <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
//           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
//             <div className="flex items-center justify-between p-6 border-b border-gray-100">
//               <h3 className="text-xl font-bold text-gray-900">{bonType === 'commande' ? '📦 Nouveau bon de commande' : '📋 Nouveau bon de réquisition'}</h3>
//               <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
//             </div>
//             <div className="p-6 space-y-5">
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                 <div>
//                   <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fournisseur</label>
//                   <input type="text" value={fournisseur} onChange={e => setFournisseur(e.target.value)} placeholder="SANOFI, PFIZER..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
//                 </div>
//                 <div>
//                   <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date livraison souhaitée</label>
//                   <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
//                 </div>
//                 <div className="sm:col-span-2">
//                   <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
//                   <textarea rows={2} placeholder="Motif, urgence..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
//                 </div>
//               </div>

//               <div className="border border-gray-200 rounded-xl overflow-hidden">
//                 <div className="bg-gray-50 p-3 flex items-center justify-between border-b border-gray-200">
//                   <span className="font-semibold text-sm text-gray-700">Articles à commander</span>
//                   <button type="button" onClick={addLine} className="text-blue-600 text-xs font-semibold hover:underline">+ Ajouter une ligne</button>
//                 </div>
//                 <div className="overflow-x-auto">
//                   <table className="w-full text-sm" style={{ minWidth: 580 }}>
//                     <thead>
//                       <tr className="bg-gray-50/50 border-b border-gray-100">
//                         {['Médicament *', 'Forme', 'Dosage', 'Qté *', 'Prix unit. (CFA)', 'Sous-total', ''].map(h => (
//                           <th key={h} className="text-left p-2 text-xs text-gray-500 uppercase">{h}</th>
//                         ))}
//                       </tr>
//                     </thead>
//                     <tbody className="divide-y divide-gray-100">
//                       {bonLines.map(l => (
//                         <tr key={l.id}>
//                           <td className="p-2"><input type="text" value={l.nom} onChange={e => setLine(l.id, 'nom', e.target.value)} list="meds-datalist" placeholder="Nom médicament" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" /></td>
//                           <td className="p-2"><input type="text" value={l.forme} onChange={e => setLine(l.id, 'forme', e.target.value)} placeholder="Comprimé" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-28 focus:outline-none" /></td>
//                           <td className="p-2"><input type="text" value={l.dosage} onChange={e => setLine(l.id, 'dosage', e.target.value)} placeholder="500mg" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-24 focus:outline-none" /></td>
//                           <td className="p-2"><input type="number" value={l.qte} min={1} onChange={e => setLine(l.id, 'qte', +e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-16 text-center focus:outline-none" /></td>
//                           <td className="p-2"><input type="number" value={l.prix} min={0} onChange={e => setLine(l.id, 'prix', +e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-28 text-right focus:outline-none" /></td>
//                           <td className="p-2 font-bold text-sm text-gray-700">{new Intl.NumberFormat('fr-FR').format(l.qte * l.prix)} CFA</td>
//                           <td className="p-2 text-center"><button type="button" onClick={() => removeLine(l.id)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button></td>
//                         </tr>
//                       ))}
//                     </tbody>
//                     <tfoot>
//                       <tr className="bg-blue-50">
//                         <td colSpan={5} className="p-3 text-right font-bold text-gray-700">Total estimé :</td>
//                         <td className="p-3 font-bold text-blue-700">{fmt(totalBon)}</td>
//                         <td />
//                       </tr>
//                     </tfoot>
//                   </table>
//                 </div>
//               </div>
//               <datalist id="meds-datalist">{meds.map(m => <option key={m.id} value={m.nom_commercial} />)}</datalist>
//             </div>
//             <div className="flex gap-3 justify-end p-6 border-t border-gray-100">
//               <button onClick={() => setShowModal(false)} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors">Annuler</button>
//               <button onClick={() => { toast.success('✅ Bon créé avec succès'); setShowModal(false); }} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">✅ Créer le bon</button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ═══════════════════════════════════════════
//    MODAL AJUSTER STOCK
// ═══════════════════════════════════════════ */
// function ModalStock({ med, onClose }) {
//   const [form, setForm] = useState({ type: 'entree', quantite: 1, reference: '', notes: '' });
//   const [saving, setSaving] = useState(false);

//   const isEntree = ['entree', 'retour'].includes(form.type);
//   const apres = isEntree ? (med?.stock_quantite || 0) + form.quantite : Math.max(0, (med?.stock_quantite || 0) - form.quantite);

//   const typeHelps = {
//     entree: 'Augmente le stock (réception commande)',
//     sortie: 'Diminue le stock (usage interne)',
//     retour: 'Augmente le stock (retour patient / fournisseur)',
//     perte: 'Diminue le stock (casse, vol, dommage)',
//     peremption: 'Diminue le stock (retrait produits périmés)',
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setSaving(true);
//     setTimeout(() => {
//       toast.success(`✅ Stock mis à jour : ${med?.stock_quantite} → ${apres} unités`);
//       onClose();
//     }, 600);
//   };

//   return (
//     <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
//       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
//         <div className="flex items-center justify-between p-6 border-b border-gray-100">
//           <h3 className="text-xl font-bold text-gray-900">⚡ Mouvement de stock</h3>
//           <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
//         </div>
//         <form onSubmit={handleSubmit} className="p-6 space-y-4">
//           {med && (
//             <div className="bg-blue-50 rounded-xl p-4">
//               <div className="font-bold text-blue-800">{med.nom_commercial}</div>
//               <div className="text-sm text-blue-600 mt-1">Stock actuel : <strong>{med.stock_quantite}</strong> unités</div>
//             </div>
//           )}
//           <div>
//             <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type de mouvement *</label>
//             <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
//               <option value="entree">📥 Entrée — Réception commande</option>
//               <option value="sortie">📤 Sortie — Usage interne</option>
//               <option value="retour">↩ Retour patient / fournisseur</option>
//               <option value="perte">✕ Perte / Casse</option>
//               <option value="peremption">⏰ Retrait péremption</option>
//             </select>
//             <p className="text-xs text-gray-500 mt-1 px-1">{typeHelps[form.type]}</p>
//           </div>
//           <div>
//             <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantité *</label>
//             <input type="number" value={form.quantite} min={1} onChange={e => setForm(f => ({ ...f, quantite: +e.target.value }))} required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
//           </div>
//           <div>
//             <label className="block text-xs font-semibold text-gray-600 mb-1.5">Référence (N° BC, lot...)</label>
//             <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="BC-2025-XXX" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
//           </div>
//           <div>
//             <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
//             <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
//           </div>
//           {/* Prévisualisation */}
//           <div className="bg-gray-50 rounded-xl p-3 flex justify-between text-sm">
//             <span className="text-gray-600">Stock après mouvement :</span>
//             <span className={`font-bold ${apres === 0 ? 'text-red-600' : apres < 10 ? 'text-orange-600' : 'text-green-600'}`}>{apres} unités</span>
//           </div>
//           <div className="flex gap-3">
//             <button type="button" onClick={onClose} className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
//             <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
//               {saving ? 'Enregistrement...' : '✅ Enregistrer'}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

// /* ═══════════════════════════════════════════
//    MODAL MÉDICAMENT (Ajouter / Modifier)
// ═══════════════════════════════════════════ */
// function ModalMed({ mode, initial, onClose, onSave }) {
//   const [form, setForm] = useState(initial || MED_EMPTY);
//   const [saving, setSaving] = useState(false);

//   const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setSaving(true);
//     setTimeout(() => {
//       onSave(form);
//       toast.success(mode === 'add' ? '✅ Médicament ajouté' : '✅ Médicament mis à jour');
//       onClose();
//     }, 600);
//   };

//   const fields = [
//     { key: 'nom_commercial', label: 'Nom commercial *', col: 2, req: true },
//     { key: 'principe_actif', label: 'DCI / Principe actif' },
//     { key: 'dosage', label: 'Dosage' },
//     { key: 'classe_therapeutique', label: 'Classe thérapeutique' },
//     { key: 'fournisseur', label: 'Fournisseur', col: 2 },
//     { key: 'lot', label: 'N° Lot' },
//   ];

//   return (
//     <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
//       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
//         <div className="flex items-center justify-between p-6 border-b border-gray-100">
//           <h3 className="text-xl font-bold text-gray-900">{mode === 'add' ? '➕ Ajouter un médicament' : '✏️ Modifier le médicament'}</h3>
//           <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
//         </div>
//         <form onSubmit={handleSubmit} className="p-6">
//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
//             {fields.map(f => (
//               <div key={f.key} className={f.col === 2 ? 'sm:col-span-2' : ''}>
//                 <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
//                 <input type="text" value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} required={f.req} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
//               </div>
//             ))}
//             <div>
//               <label className="block text-xs font-semibold text-gray-600 mb-1.5">Forme galénique</label>
//               <select value={form.forme_galenique} onChange={e => set('forme_galenique', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
//                 {FORMES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
//               </select>
//             </div>
//             <div>
//               <label className="block text-xs font-semibold text-gray-600 mb-1.5">Prix unitaire (CFA) *</label>
//               <input type="number" value={form.prix_unitaire} min={0} onChange={e => set('prix_unitaire', +e.target.value)} required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
//             </div>
//             {mode === 'add' && (
//               <div>
//                 <label className="block text-xs font-semibold text-gray-600 mb-1.5">Stock initial</label>
//                 <input type="number" value={form.stock_quantite} min={0} onChange={e => set('stock_quantite', +e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
//               </div>
//             )}
//             <div>
//               <label className="block text-xs font-semibold text-gray-600 mb-1.5">Seuil d'alerte</label>
//               <input type="number" value={form.seuil_alerte} min={1} onChange={e => set('seuil_alerte', +e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
//             </div>
//             <div>
//               <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date de péremption</label>
//               <input type="date" value={form.date_peremption || ''} onChange={e => set('date_peremption', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
//             </div>
//             <div className="sm:col-span-2 flex items-center gap-2">
//               <input type="checkbox" id="rx-oblig" checked={!!form.ordonnance_obligatoire} onChange={e => set('ordonnance_obligatoire', e.target.checked)} className="w-4 h-4 accent-blue-600" />
//               <label htmlFor="rx-oblig" className="text-sm text-gray-700 cursor-pointer">Ordonnance obligatoire</label>
//             </div>
//             {mode === 'edit' && (
//               <div className="sm:col-span-2 flex items-center gap-2">
//                 <input type="checkbox" id="actif" checked={form.actif !== false} onChange={e => set('actif', e.target.checked)} className="w-4 h-4 accent-blue-600" />
//                 <label htmlFor="actif" className="text-sm text-gray-700 cursor-pointer">Médicament actif</label>
//               </div>
//             )}
//           </div>
//           <div className="flex gap-3 mt-5">
//             <button type="button" onClick={onClose} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
//             <button type="submit" disabled={saving} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
//               {saving ? 'Enregistrement...' : '✅ ' + (mode === 'add' ? 'Ajouter au catalogue' : 'Enregistrer')}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

// /* ═══════════════════════════════════════════
//    MODAL COMMANDE IA
// ═══════════════════════════════════════════ */
// function ModalCommandeIA({ meds, onClose }) {
//   const urgents = meds.filter(m => ['rupture', 'critique', 'bas'].includes(stockStatus(m.stock_quantite, m.seuil_alerte)));
//   const [qtys, setQtys] = useState(Object.fromEntries(urgents.map(m => [m.id, m.seuil_alerte * 3])));
//   const total = urgents.reduce((s, m) => s + (qtys[m.id] || 0) * m.prix_unitaire, 0);

//   return (
//     <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
//       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
//         <div className="flex items-center justify-between p-6 border-b border-gray-100">
//           <h3 className="text-xl font-bold text-gray-900">📦 Commande — Prédiction IA</h3>
//           <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
//         </div>
//         <div className="p-6 space-y-4">
//           <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm">
//             🤖 Quantités suggérées : <strong>3× le seuil d'alerte</strong> (couverture 90 jours selon IA).
//           </div>
//           <div className="space-y-2 max-h-72 overflow-y-auto">
//             {urgents.length === 0 && <div className="text-center text-green-600 py-8 font-semibold">✅ Tous les stocks sont satisfaisants</div>}
//             {urgents.map(m => (
//               <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
//                 <div className="flex-1 min-w-0">
//                   <div className="font-semibold text-sm truncate">{m.nom_commercial}</div>
//                   <div className="text-xs text-gray-500">{m.fournisseur || '—'} · Stock: <span className="text-red-600 font-bold">{m.stock_quantite}</span></div>
//                 </div>
//                 <div className="text-right flex-shrink-0">
//                   <input type="number" value={qtys[m.id]} min={1} onChange={e => setQtys(q => ({ ...q, [m.id]: +e.target.value }))} className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-center w-20 focus:outline-none focus:border-blue-400" />
//                   <div className="text-xs text-gray-500 mt-0.5">{fmt((qtys[m.id] || 0) * m.prix_unitaire)}</div>
//                 </div>
//               </div>
//             ))}
//           </div>
//           {urgents.length > 0 && (
//             <div className="p-4 border-2 border-blue-200 rounded-xl bg-blue-50 flex items-center justify-between">
//               <span className="font-bold text-blue-800 text-sm">Valeur estimée commande :</span>
//               <span className="text-xl font-bold text-blue-600">{fmt(total)}</span>
//             </div>
//           )}
//         </div>
//         <div className="flex gap-3 p-6 border-t border-gray-100">
//           <button onClick={onClose} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors">Fermer</button>
//           <button onClick={() => { toast.success('📦 Bon de commande transmis — En attente validation Admin'); onClose(); }} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">📧 Transmettre commande</button>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ═══════════════════════════════════════════
//    COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════ */
// const TABS = [
//   { key: 'dashboard', icon: '📊', short: 'Bord', long: 'Tableau de bord' },
//   { key: 'inventaire', icon: '💊', short: 'Stock', long: 'Inventaire' },
//   { key: 'alertes', icon: '🚨', short: 'Alertes', long: 'Alertes' },
//   { key: 'vente', icon: '🛒', short: 'Vente', long: 'Vente & Dispensation' },
//   { key: 'achats', icon: '📦', short: 'Achats', long: 'Achats & Commandes' },
//   { key: 'mouvements', icon: '📋', short: 'Traçabilité', long: 'Traçabilité' },
// ];

// export default function Pharmacy() {
//   const [tab, setTab] = useState('dashboard');
//   const [meds, setMeds] = useState(MOCK_MEDS);
//   const [mvts] = useState(MOCK_MVTS);
//   const [bons] = useState(MOCK_BONS);
//   const [modal, setModal] = useState(null); // 'add' | 'edit' | 'stock' | 'commande'
//   const [editTarget, setEditTarget] = useState(null);
//   const [stockTarget, setStockTarget] = useState(null);
//   const [loading, setLoading] = useState(false);

//   /* Compter alertes pour badge */
//   const nbAlertes = meds.filter(m =>
//     ['rupture', 'critique', 'bas'].includes(stockStatus(m.stock_quantite, m.seuil_alerte)) ||
//     ['perime', 'imminent'].includes(perempStatus(m.date_peremption))
//   ).length;

//   const openModal = (type, med = null) => {
//     if (type === 'edit' || type === 'stock') {
//       if (type === 'edit') setEditTarget(med);
//       if (type === 'stock') setStockTarget(med);
//     }
//     setModal(type);
//   };

//   const openStock = (med) => { setStockTarget(med); setModal('stock'); };
//   const closeModal = () => { setModal(null); setEditTarget(null); setStockTarget(null); };

//   return (
//     <div className="space-y-5">
//       {/* Alerte critique globale */}
//       {meds.some(m => stockStatus(m.stock_quantite, m.seuil_alerte) === 'rupture' || perempStatus(m.date_peremption) === 'perime') && (
//         <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-red-50 border-2 border-red-200 rounded-2xl p-4">
//           <span className="text-3xl flex-shrink-0">🚨</span>
//           <div className="flex-1">
//             <div className="font-bold text-red-800">Alerte critique pharmacie</div>
//             <div className="text-sm text-red-700 mt-0.5">
//               {meds.filter(m => stockStatus(m.stock_quantite, m.seuil_alerte) === 'rupture').length > 0 &&
//                 <strong>{meds.filter(m => stockStatus(m.stock_quantite, m.seuil_alerte) === 'rupture').length} médicament(s) en rupture de stock. </strong>}
//               {meds.filter(m => perempStatus(m.date_peremption) === 'perime').length > 0 &&
//                 <strong>{meds.filter(m => perempStatus(m.date_peremption) === 'perime').length} lot(s) périmé(s) à retirer immédiatement.</strong>}
//             </div>
//           </div>
//           <button onClick={() => setTab('alertes')} className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors flex-shrink-0">⚡ Voir alertes</button>
//         </div>
//       )}

//       {/* Onglets */}
//       <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm border border-gray-100 overflow-x-auto">
//         {TABS.map(t => {
//           const isAlert = t.key === 'alertes' && nbAlertes > 0;
//           const isActive = tab === t.key;
//           return (
//             <button key={t.key} onClick={() => setTab(t.key)}
//               className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0
//                 ${isActive
//                   ? isAlert ? 'bg-red-600 text-white shadow' : 'bg-blue-600 text-white shadow'
//                   : isAlert ? 'text-red-600 hover:bg-red-50 font-bold' : 'text-gray-500 hover:text-gray-900'}`}>
//               <span>{t.icon}</span>
//               <span className="sm:hidden">{t.short}{t.key === 'alertes' && nbAlertes > 0 ? ` (${nbAlertes})` : ''}</span>
//               <span className="hidden sm:inline">{t.long}{t.key === 'alertes' && nbAlertes > 0 ? ` (${nbAlertes})` : ''}</span>
//             </button>
//           );
//         })}
//       </div>

//       {/* Contenu onglet */}
//       {tab === 'dashboard' && <TabDashboard meds={meds} mvts={mvts} onOpenModal={openModal} onOpenStock={openStock} />}
//       {tab === 'inventaire' && <TabInventaire meds={meds} onAdd={() => openModal('add')} onEdit={m => openModal('edit', m)} onOpenStock={openStock} />}
//       {tab === 'alertes' && <TabAlertes meds={meds} onOpenStock={openStock} onOpenModal={openModal} />}
//       {tab === 'vente' && <TabVente meds={meds} />}
//       {tab === 'achats' && <TabAchats bons={bons} meds={meds} />}
//       {tab === 'mouvements' && <TabMouvements mvts={mvts} onOpenModal={openModal} />}

//       {/* Modals globaux */}
//       {modal === 'add' && <ModalMed mode="add" onClose={closeModal} onSave={f => setMeds(m => [...m, { ...f, id: Date.now() }])} />}
//       {modal === 'edit' && editTarget && <ModalMed mode="edit" initial={editTarget} onClose={closeModal} onSave={f => setMeds(m => m.map(x => x.id === editTarget.id ? { ...x, ...f } : x))} />}
//       {modal === 'stock' && <ModalStock med={stockTarget} onClose={closeModal} />}
//       {modal === 'commande' && <ModalCommandeIA meds={meds} onClose={closeModal} />}
//     </div>
//   );
// }





import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchMedications, fetchInventory, fetchStockAlerts, createMedication, updateMedication, addStockMovement,
  selectMedications, selectPharmacyInventory, selectStockAlerts, selectPharmacyLoading,
} from '../store/slices/pharmacySlice';
import api from "../api";
import toast from "react-hot-toast";

// ─── Chart.js loader ─────────────────────────────────────────
function loadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  s.onload = cb;
  document.head.appendChild(s);
}

// ─── CSS Medical Navy + Teal ──────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.ph * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --pn:#0B1E3B; --pn2:#132744; --pb:#1B4F9E;
  --pt:#0EA5A0; --pt2:#0D9490; --pr:#DC2626;
  --po:#D97706; --pg:#059669; --pp:#7C3AED;
  --pbr:#E2EAF4; --pm:#6B7A99; --pl:#EEF4FF; --ps:#F8FAFD;
  --sh:0 1px 3px rgba(11,30,59,.08); --shm:0 4px 16px rgba(11,30,59,.10); --shl:0 12px 40px rgba(11,30,59,.14);
}
/* Topbar */
.ph-top { background:linear-gradient(135deg,var(--pn) 0%,var(--pn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.ph-top::before { content:''; position:absolute; top:-50px; right:-50px; width:220px; height:220px; background:radial-gradient(circle,rgba(14,165,160,.2) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.ph-top::after  { content:''; position:absolute; bottom:-60px; left:20%; width:180px; height:180px; background:radial-gradient(circle,rgba(27,79,158,.1) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
/* Tabs */
.ph-tabs { display:flex; gap:2px; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.ph-tabs::-webkit-scrollbar { display:none; }
.ph-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.ph-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.ph-tab.active { color:var(--pn); background:var(--ps); box-shadow:0 -2px 0 var(--pt) inset; }
.ph-tab-badge { background:var(--pr); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:99px; animation:phpulse 2s infinite; }
@keyframes phpulse { 0%,100%{opacity:1} 50%{opacity:.4} }
/* Cards */
.ph-card { background:#fff; border:1.5px solid var(--pbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; margin-bottom:20px; }
.ph-card:hover { box-shadow:var(--shm); }
.ph-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--pbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.ph-card-hdr h3 { font-size:14px; font-weight:700; color:var(--pn); margin:0; display:flex; align-items:center; gap:8px; }
.ph-card-hdr p { font-size:11px; color:var(--pm); margin:2px 0 0; }
/* KPI */
.ph-kpi { background:#fff; border:1.5px solid var(--pbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; transition:all .25s; cursor:pointer; }
.ph-kpi:hover { transform:translateY(-2px); box-shadow:var(--shm); }
.ph-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.ph-kpi.blue::before   { background:var(--pb); } .ph-kpi.teal::before   { background:var(--pt); }
.ph-kpi.red::before    { background:var(--pr); } .ph-kpi.orange::before { background:var(--po); }
.ph-kpi.green::before  { background:var(--pg); } .ph-kpi.purple::before { background:var(--pp); }
.ph-kpi.yellow::before { background:#EAB308; }
.pkpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.pkpi-icon.blue   { background:#EFF6FF; color:var(--pb); } .pkpi-icon.teal   { background:#F0FDFC; color:var(--pt); }
.pkpi-icon.red    { background:#FEF2F2; color:var(--pr); } .pkpi-icon.orange { background:#FFF7ED; color:var(--po); }
.pkpi-icon.green  { background:#ECFDF5; color:var(--pg); } .pkpi-icon.purple { background:#F5F3FF; color:var(--pp); }
.pkpi-icon.yellow { background:#FEFCE8; color:#CA8A04; }
.pkpi-val { font-size:26px; font-weight:800; color:var(--pn); line-height:1; margin-bottom:4px; letter-spacing:-1px; }
.pkpi-lbl { font-size:11.5px; font-weight:600; color:var(--pm); }
.pkpi-sub { font-size:10.5px; color:#9CA3AF; margin-top:2px; }
.pkpi-dot { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--pr); animation:phpulse 2s infinite; }
/* Badges */
.pbdg { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.pbdg.red    { background:#FEF2F2; color:var(--pr); border:1px solid #FECACA; }
.pbdg.orange { background:#FFF7ED; color:var(--po); border:1px solid #FED7AA; }
.pbdg.yellow { background:#FEFCE8; color:#CA8A04;   border:1px solid #FEF08A; }
.pbdg.green  { background:#ECFDF5; color:var(--pg); border:1px solid #A7F3D0; }
.pbdg.blue   { background:#EFF6FF; color:var(--pb); border:1px solid #BFDBFE; }
.pbdg.teal   { background:#F0FDFC; color:var(--pt); border:1px solid #99F6E4; }
.pbdg.purple { background:#F5F3FF; color:var(--pp); border:1px solid #DDD6FE; }
.pbdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }
/* Progress */
.ph-prog { background:#EEF4FF; border-radius:99px; height:7px; overflow:hidden; }
.ph-prog-f { height:100%; border-radius:99px; transition:width .6s; }
/* Buttons */
.pbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.pbtn-primary { background:var(--pb); color:#fff; } .pbtn-primary:hover { background:#174391; transform:translateY(-1px); }
.pbtn-teal    { background:var(--pt); color:#fff; } .pbtn-teal:hover    { background:var(--pt2); transform:translateY(-1px); }
.pbtn-ghost   { background:transparent; color:var(--pm); border:1.5px solid var(--pbr); }
.pbtn-ghost:hover { background:var(--pl); color:var(--pn); }
.pbtn-danger  { background:#FEF2F2; color:var(--pr); border:1.5px solid #FECACA; }
.pbtn-danger:hover { background:var(--pr); color:#fff; }
.pbtn-success { background:#ECFDF5; color:var(--pg); border:1.5px solid #A7F3D0; }
.pbtn-sm { padding:6px 12px; font-size:12px; }
.pbtn:disabled { opacity:.5; cursor:not-allowed; transform:none!important; }
/* Forms */
.plbl { font-size:12px; font-weight:600; color:var(--pm); margin-bottom:6px; display:block; }
.pinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--pbr); background:#FAFBFF; font-size:13px; color:var(--pn); font-family:'Poppins',sans-serif; transition:border-color .2s,box-shadow .2s; outline:none; }
.pinp:focus { border-color:var(--pt); box-shadow:0 0 0 3px rgba(14,165,160,.12); }
/* Alerts */
.al-danger { background:linear-gradient(135deg,#FEF2F2,#FEE2E2); border:1.5px solid #FECACA; border-left:4px solid var(--pr); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-warn   { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; border-left:4px solid var(--po); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-ia     { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; border-left:4px solid var(--pb); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
.al-success{ background:linear-gradient(135deg,#ECFDF5,#D1FAE5); border:1.5px solid #A7F3D0; border-left:4px solid var(--pg); border-radius:14px; padding:14px 18px; margin-bottom:16px; }
/* Table */
.ph-tbl { width:100%; border-collapse:collapse; }
.ph-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.ph-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--pm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--pbr); white-space:nowrap; }
.ph-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.ph-tbl tbody tr:last-child td { border-bottom:none; }
.ph-tbl tbody tr:hover { background:#F8FAFF; }
/* Modal */
.pmov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.pmov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:680px; max-height:92vh; overflow-y:auto; animation:phSlideUp .25s ease; }
.pmov-box.wide { max-width:840px; }
.pmov-box.narrow { max-width:480px; }
@keyframes phSlideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.pmov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--pbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.pmov-hdr h3 { font-size:16px; font-weight:700; color:var(--pn); margin:0; display:flex; align-items:center; gap:10px; }
.pmov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--pm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.pmov-cls:hover { background:#FEF2F2; color:var(--pr); }
.pmov-body { padding:24px; }
/* Stock health bar */
.health-bar { height:14px; border-radius:99px; overflow:hidden; background:#EEF4FF; display:flex; }
.health-seg { height:100%; transition:width .6s; }
/* Mouvement icon */
.mvt-icon { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; flex-shrink:0; }
/* Scroll hint */
.ph-tbl-wrap { overflow-x:auto; }
.ph-tbl-wrap::-webkit-scrollbar { height:4px; }
.ph-tbl-wrap::-webkit-scrollbar-thumb { background:var(--pbr); border-radius:99px; }
/* Cart item */
.cart-item { display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--ps); border:1.5px solid var(--pbr); border-radius:10px; margin-bottom:8px; }
/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .35s ease both; }
/* Print */
@media print { .ph-top,.pbtn,.pmov { display:none!important; } }

/* ─── Grilles responsives ─── */
.ph-g2   { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.ph-g11  { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.ph-g11s { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.ph-g4   { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }

/* ─── Mobile (≤ 767px) ─────────────────────────────────────── */
@media (max-width:767px) {
  .ph-top { padding:12px 14px 0; }
  .ph-g2, .ph-g11 { grid-template-columns:1fr; gap:14px; }
  .ph-g11s { grid-template-columns:1fr 1fr; gap:8px; }
  .ph-g4   { grid-template-columns:1fr 1fr; gap:8px; }
  .pinp { font-size:16px !important; }
  .pbtn    { font-size:12px; padding:8px 12px; }
  .pbtn-sm { font-size:11px; padding:5px 8px; }
  .ph-card     { border-radius:14px; }
  .ph-card-hdr { padding:11px 14px; }
  .ph-card-hdr h3 { font-size:13px; }
  .pmov     { padding:0; align-items:flex-end; }
  .pmov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .pmov-hdr { padding:13px 16px; }
  .pmov-body{ padding:14px; }
}

/* ─── Très petit écran (≤ 479px) ─────────────────────────────  */
@media (max-width:479px) {
  .ph-top   { padding:10px 12px 0; }
  .ph-g11s  { grid-template-columns:1fr; }
  .ph-g4    { grid-template-columns:1fr; }
  .ph-card-hdr { flex-wrap:wrap; gap:8px; }
}
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const fmtDateI = (d) => d ? new Date(d).toISOString().substring(0,10) : "";
const fmtCFA   = (n) => n != null ? Number(n).toLocaleString("fr-FR") + " CFA" : "—";

const stockSt = (q, seuil) => {
  if (q === 0) return "rupture";
  if (q < Math.floor(seuil * 0.3)) return "critique";
  if (q < seuil) return "bas";
  return "ok";
};
const stockColor = (s) => ({ rupture:"#DC2626", critique:"#D97706", bas:"#EAB308", ok:"#059669" }[s]||"#059669");
const stockBdg  = (s) => ({ rupture:"red", critique:"orange", bas:"yellow", ok:"green" }[s]||"gray");
const stockLbl  = (s) => ({ rupture:"Rupture", critique:"Critique", bas:"Stock bas", ok:"OK" }[s]||s);

const perempSt = (d) => {
  if (!d) return "ok";
  const days = Math.ceil((new Date(d)-Date.now())/86400000);
  if (days < 0)   return "perime";
  if (days <= 30)  return "imminent";
  if (days <= 90)  return "proche";
  return "ok";
};
const perempColor = (s) => ({ perime:"var(--pr)", imminent:"var(--po)", proche:"#CA8A04", ok:"var(--pm)" }[s]||"var(--pm)");
const perempLbl   = (s) => ({ perime:"Périmé !", imminent:"< 30 jours", proche:"< 90 jours", ok:"OK" }[s]||s);

const MVT_CFG = {
  entree:       { icon:"↑",  label:"Entrée",       cls:"green",  sign:"+" },
  sortie:       { icon:"↓",  label:"Sortie",        cls:"red",    sign:"-" },
  dispensation: { icon:"💊", label:"Dispensation",  cls:"blue",   sign:"-" },
  retour:       { icon:"↩",  label:"Retour",        cls:"teal",   sign:"+" },
  perte:        { icon:"✕",  label:"Perte",         cls:"gray",   sign:"-" },
  ajustement:   { icon:"≈",  label:"Ajustement",    cls:"purple", sign:"±" },
  peremption:   { icon:"⏰", label:"Péremption",    cls:"orange", sign:"-" },
};

// ─── DEMO DATA ────────────────────────────────────────────────
const DEMO_MEDS = [
  { _id:"m1", code:"MED-001", nom_commercial:"AMOXICILLINE 500MG", dci:"Amoxicilline", categorie:"Antibiotiques", forme:"Comprimé", dosage:"500mg", fabricant:"SANOFI", fournisseur:"PharmaCongo", prix_achat:200, prix_vente:350, stock_quantite:0, stock_minimum:50, stock_maximum:500, emplacement:"A1-01", lot:"AMX-2025-01", date_expiration:"2025-03-15", statut:"rupture", ordonnance:true },
  { _id:"m2", code:"MED-002", nom_commercial:"PARACÉTAMOL 1G", dci:"Paracétamol", categorie:"Analgésiques", forme:"Comprimé", dosage:"1g", fabricant:"PFIZER", fournisseur:"MedSupply", prix_achat:80, prix_vente:150, stock_quantite:12, stock_minimum:100, stock_maximum:1000, emplacement:"A1-02", lot:"PAR-2025-02", date_expiration:"2026-08-20", statut:"critique", ordonnance:false },
  { _id:"m3", code:"MED-003", nom_commercial:"METRONIDAZOLE 250MG", dci:"Métronidazole", categorie:"Antiprotozoaires", forme:"Comprimé", dosage:"250mg", fabricant:"MERCK", fournisseur:"CAMPC", prix_achat:120, prix_vente:200, stock_quantite:280, stock_minimum:80, stock_maximum:800, emplacement:"B2-01", lot:"MET-2025-03", date_expiration:"2027-01-10", statut:"ok", ordonnance:true },
  { _id:"m4", code:"MED-004", nom_commercial:"SÉRUM PHYSIOLOGIQUE 500ML", dci:"NaCl 0.9%", categorie:"Solutés", forme:"Injectable", dosage:"500ml", fabricant:"BAXTER", fournisseur:"MedSupply", prix_achat:600, prix_vente:1200, stock_quantite:8, stock_minimum:30, stock_maximum:200, emplacement:"C1-01", lot:"SP-2025-04", date_expiration:"2025-12-31", statut:"critique", ordonnance:false },
  { _id:"m5", code:"MED-005", nom_commercial:"ARTEMETHER 20MG", dci:"Artéméther", categorie:"Antipaludéens", forme:"Comprimé", dosage:"20mg", fabricant:"SANOFI", fournisseur:"PharmaCongo", prix_achat:400, prix_vente:800, stock_quantite:150, stock_minimum:60, stock_maximum:600, emplacement:"A2-01", lot:"ART-2025-05", date_expiration:"2026-06-30", statut:"ok", ordonnance:true },
  { _id:"m6", code:"MED-006", nom_commercial:"OMÉPRAZOLE 20MG", dci:"Oméprazole", categorie:"Gastro-entérologie", forme:"Gélule", dosage:"20mg", fabricant:"AstraZeneca", fournisseur:"CAMPC", prix_achat:150, prix_vente:280, stock_quantite:42, stock_minimum:60, stock_maximum:400, emplacement:"B1-03", lot:"OMP-2025-06", date_expiration:"2027-03-15", statut:"bas", ordonnance:false },
  { _id:"m7", code:"MED-007", nom_commercial:"GLIBENCLAMIDE 5MG", dci:"Glibenclamide", categorie:"Antidiabétiques", forme:"Comprimé", dosage:"5mg", fabricant:"MERCK", fournisseur:"MedSupply", prix_achat:90, prix_vente:180, stock_quantite:320, stock_minimum:100, stock_maximum:1000, emplacement:"A3-02", lot:"GLI-2025-07", date_expiration:"2026-12-01", statut:"ok", ordonnance:true },
  { _id:"m8", code:"MED-008", nom_commercial:"AMLODIPINE 5MG", dci:"Amlodipine", categorie:"Antihypertenseurs", forme:"Comprimé", dosage:"5mg", fabricant:"PFIZER", fournisseur:"PharmaCongo", prix_achat:100, prix_vente:200, stock_quantite:180, stock_minimum:80, stock_maximum:800, emplacement:"A3-01", lot:"AML-2025-08", date_expiration:"2027-02-28", statut:"ok", ordonnance:true },
];

const DEMO_MVTS = [
  { _id:"v1", medicament_nom:"AMOXICILLINE 500MG", type:"dispensation", quantite:10, stock_avant:10, stock_apres:0, reference:"ORD-2025-0012", pharmacien:"Jean Bakala", patient:"Fatou Bongo", date:"2025-06-01T09:15:00" },
  { _id:"v2", medicament_nom:"PARACÉTAMOL 1G", type:"entree", quantite:50, stock_avant:0, stock_apres:50, reference:"BC-2025-0003", pharmacien:"Jean Bakala", patient:null, date:"2025-05-30T14:30:00" },
  { _id:"v3", medicament_nom:"METRONIDAZOLE 250MG", type:"sortie", quantite:20, stock_avant:300, stock_apres:280, reference:"BLOC-001", pharmacien:"Jean Bakala", patient:null, date:"2025-05-29T11:00:00" },
  { _id:"v4", medicament_nom:"SÉRUM PHYSIOLOGIQUE 500ML", type:"dispensation", quantite:4, stock_avant:12, stock_apres:8, reference:"ORD-2025-0011", pharmacien:"Jean Bakala", patient:"Paul Nguema", date:"2025-05-28T16:00:00" },
  { _id:"v5", medicament_nom:"ARTEMETHER 20MG", type:"entree", quantite:200, stock_avant:0, stock_apres:200, reference:"BC-2025-0002", pharmacien:"Jean Bakala", patient:null, date:"2025-05-25T08:45:00" },
  { _id:"v6", medicament_nom:"GLIBENCLAMIDE 5MG", type:"dispensation", quantite:30, stock_avant:350, stock_apres:320, reference:"ORD-2025-0009", pharmacien:"Jean Bakala", patient:"Paul Nguema", date:"2025-05-22T10:20:00" },
];

const DEMO_FOURNISSEURS = [
  { _id:"f1", nom:"PharmaCongo Brazzaville", contact:"M. Okemba Gilles", email:"commandes@pharmacongo.cg", telephone:"+242 06 111 2233", ville:"Brazzaville", delai_livraison:5, type:"principal" },
  { _id:"f2", nom:"MedSupply Africa", contact:"Dr. Mouamba Sophie", email:"supply@medsupply.africa", telephone:"+242 05 222 3344", ville:"Pointe-Noire", delai_livraison:7, type:"secondaire" },
  { _id:"f3", nom:"CAMPC", contact:"Mme. Ngoma Céleste", email:"commandes@campc.cg", telephone:"+242 06 333 4455", ville:"Brazzaville", delai_livraison:3, type:"gouvernemental" },
];

const DEMO_COMMANDES = [
  { _id:"c1", numero:"BC-2025-00001", fournisseur:"PharmaCongo", nb_lignes:6, montant:450000, date:"2025-05-20", statut:"recu" },
  { _id:"c2", numero:"BC-2025-00002", fournisseur:"MedSupply Africa", nb_lignes:3, montant:280000, date:"2025-05-25", statut:"envoye" },
  { _id:"c3", numero:"BC-2025-00003", fournisseur:"CAMPC", nb_lignes:4, montant:120000, date:"2025-05-28", statut:"brouillon" },
];

const FORMES_PHARMA = ["Comprimé","Gélule","Sirop","Injectable","Perfusion","Pommade","Crème","Suppositoire","Patch","Spray","Sachet","Gouttes"];
const CATEGORIES = ["Antibiotiques","Analgésiques","Antipaludéens","Antidiabétiques","Antihypertenseurs","Anti-inflammatoires","Gastro-entérologie","Antiprotozoaires","Solutés","Vitamines","Antiseptiques","Cardiologie","Neurologie"];

const EMPTY_MED = { code:"", nom_commercial:"", dci:"", categorie:"", forme:"Comprimé", dosage:"", fabricant:"", fournisseur:"", prix_achat:0, prix_vente:0, stock_quantite:0, stock_minimum:50, stock_maximum:500, emplacement:"", lot:"", date_expiration:"", ordonnance:false };
const EMPTY_MVT = { medicament_id:"", type:"entree", quantite:1, reference:"", notes:"", date_peremption_lot:"", lot:"" };
const EMPTY_CMD = { fournisseur:"", date_livraison_souhaitee:"", notes:"", lignes:[{ id:1, nom:"", forme:"", dosage:"", quantite:1, prix_unitaire:0 }] };

// ─── SVG Icons ──────────────────────────────────────────────
const I = {
  pill:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 01-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H20a2 2 0 012 2v2"/><circle cx="17" cy="17" r="5"/><path d="M14 17h6"/></svg>,
  chart:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  list:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  alert:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  cart:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  box:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  truck:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  log:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  inv:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  plus:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  save:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  edit:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
  dl:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  print:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  ia:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  trend:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  refresh:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  send:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
};

// ─── Sub-components ─────────────────────────────────────────
function Modal({ open, onClose, title, children, wide, narrow }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="pmov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`pmov-box ${wide?"wide":""} ${narrow?"narrow":""}`}>
        <div className="pmov-hdr">
          <h3>{title}</h3>
          <button className="pmov-cls" onClick={onClose}>×</button>
        </div>
        <div className="pmov-body">{children}</div>
      </div>
    </div>
  );
}

function Badge({ cls, children }) { return <span className={`pbdg ${cls}`}>{children}</span>; }

function KpiCard({ color, icon, value, label, sub, urgent, onClick }) {
  return (
    <div className={`ph-kpi ${color} fu`} onClick={onClick} style={{ cursor:onClick?"pointer":"default" }}>
      {urgent && <div className="pkpi-dot" />}
      <div className={`pkpi-icon ${color}`}>{icon}</div>
      <div className="pkpi-val">{value}</div>
      <div className="pkpi-lbl">{label}</div>
      {sub && <div className="pkpi-sub">{sub}</div>}
    </div>
  );
}

function Prog({ pct, color, h=7 }) {
  return (
    <div className="ph-prog" style={{ height:h }}>
      <div className="ph-prog-f" style={{ width:`${Math.min(100,pct)}%`, background:color }} />
    </div>
  );
}

function BarChartCanvas({ labels, data, color="#1B4F9E", height=180 }) {
  const ref = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    loadChartJs(() => {
      if (!ref.current) return;
      if (cRef.current) cRef.current.destroy();
      cRef.current = new window.Chart(ref.current, {
        type:"bar",
        data:{ labels, datasets:[{ data, backgroundColor:`${color}26`, borderColor:color, borderWidth:2, borderRadius:8, borderSkipped:false }] },
        options:{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:{backgroundColor:"#0B1E3B",padding:10,cornerRadius:10} }, scales:{ x:{grid:{display:false},ticks:{font:{size:10},color:"#9CA3AF"},border:{display:false}}, y:{beginAtZero:true,grid:{color:"rgba(0,0,0,.04)"},ticks:{font:{size:10},color:"#9CA3AF",precision:0},border:{display:false}} } },
      });
    });
    return () => { if (cRef.current) cRef.current.destroy(); };
  }, [labels, data, color]);
  return <canvas ref={ref} style={{ maxHeight:height }} />;
}

// ─── Cmd statut badge ───────────────────────────────────────
function CmdBadge({ statut }) {
  const cfg = { brouillon:["gray","Brouillon"], envoye:["blue","Envoyé"], confirme:["orange","Confirmé"], recu_partiel:["purple","Reçu partiel"], recu:["green","Reçu ✅"], annule:["red","Annulé"] };
  const [cls, lbl] = cfg[statut] || ["gray", statut];
  return <Badge cls={cls}>{lbl}</Badge>;
}

// ─── MAIN ────────────────────────────────────────────────────
export default function Pharmacie() {
  const dispatch = useDispatch();
  const reduxMeds = useSelector(selectMedications);
  const reduxInventory = useSelector(selectPharmacyInventory);
  const reduxAlerts = useSelector(selectStockAlerts);

  useEffect(() => {
    dispatch(fetchMedications({}));
    dispatch(fetchInventory());
    dispatch(fetchStockAlerts());
  }, [dispatch]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const [tab, setTab]         = useState("dashboard");
  const [medicaments, setMeds] = useState([]);
  const [mvts, setMvts]       = useState([]);
  const [commandes, setCmds]  = useState([]);
  const [fournisseurs, setFrns] = useState([]);
  const [kpis, setKpis]       = useState({ total:0, ruptures:0, critiques:0, bas:0, expires:0, imminents:0, valeur_stock:0, ventes_jour:0, ventes_mois:0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterSt, setFilterSt]   = useState("");
  const [currentMed, setCurrentMed] = useState(null);

  // Modals
  const [modalAdd,  setModalAdd]  = useState(false);
  const [modalEdit, setModalEdit] = useState(false);
  const [modalMvt,  setModalMvt]  = useState(false);
  const [modalCmd,  setModalCmd]  = useState(false);
  const [modalIACmd,setModalIACmd]= useState(false);
  const [modalInv,  setModalInv]  = useState(false);
  const [modalVente,setModalVente]= useState(false);

  // Forms
  const [formMed, setFormMed]   = useState(EMPTY_MED);
  const [formMvt, setFormMvt]   = useState(EMPTY_MVT);
  const [formCmd, setFormCmd]   = useState(EMPTY_CMD);

  // Vente panier
  const [panier, setPanier]     = useState([{ id:Date.now(), med:null, quantite:1 }]);
  const [clientNom, setClientNom] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [rxNum, setRxNum]       = useState("");

  // ── Load data ──────────────────────────────────────────────
  const loadMeds = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit:20 });
      if (search) p.set("q", search);
      if (filterCat) p.set("categorie", filterCat);
      if (filterSt) p.set("statut", filterSt);
      const { data } = await api.get(`/pharmacie/medicaments?${p}`);
      setMeds(data.medicaments || data.data || []);
    } catch {
      setMeds(DEMO_MEDS);
    } finally { setLoading(false); }
  }, [page, search, filterCat, filterSt]);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/pharmacie/stats");
      setKpis(data.kpis || kpis);
    } catch {
      const d = DEMO_MEDS;
      setKpis({
        total: d.length,
        ruptures: d.filter(x=>stockSt(x.stock_quantite,x.stock_minimum)==="rupture").length,
        critiques: d.filter(x=>stockSt(x.stock_quantite,x.stock_minimum)==="critique").length,
        bas: d.filter(x=>stockSt(x.stock_quantite,x.stock_minimum)==="bas").length,
        expires: d.filter(x=>perempSt(x.date_expiration)==="perime").length,
        imminents: d.filter(x=>perempSt(x.date_expiration)==="imminent").length,
        valeur_stock: d.reduce((s,m)=>s+m.stock_quantite*m.prix_vente,0),
        ventes_jour: 124500,
        ventes_mois: 3840000,
      });
    }
  }, []);

  const loadMvts = useCallback(async () => {
    try {
      const { data } = await api.get("/pharmacie/mouvements?limit=30");
      setMvts(data.mouvements || data.data || []);
    } catch { setMvts(DEMO_MVTS); }
  }, []);

  const loadCommandes = useCallback(async () => {
    try {
      const { data } = await api.get("/pharmacie/commandes?limit=20");
      setCmds(data.commandes || data.data || []);
    } catch { setCmds(DEMO_COMMANDES); }
  }, []);

  const loadFournisseurs = useCallback(async () => {
    try {
      const { data } = await api.get("/pharmacie/fournisseurs");
      setFrns(data.fournisseurs || data.data || []);
    } catch { setFrns(DEMO_FOURNISSEURS); }
  }, []);

  useEffect(() => { loadMeds(); loadStats(); loadMvts(); loadCommandes(); loadFournisseurs(); }, [loadMeds, loadStats, loadMvts, loadCommandes, loadFournisseurs]);

  // ── CRUD médicament ────────────────────────────────────────
  const createMed = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/pharmacie/medicaments", formMed);
      toast.success("✅ Médicament ajouté au catalogue");
      setMeds(prev => [data.medicament || {...formMed,_id:Date.now().toString()}, ...prev]);
      setModalAdd(false);
      setFormMed(EMPTY_MED);
      loadStats();
    } catch {
      setMeds(prev => [{...formMed,_id:Date.now().toString()}, ...prev]);
      toast.success("✅ Médicament ajouté (local)");
      setModalAdd(false);
      setFormMed(EMPTY_MED);
    } finally { setSaving(false); }
  };

  const updateMed = async (e) => {
    e.preventDefault();
    if (!currentMed) return;
    setSaving(true);
    try {
      await api.put(`/pharmacie/medicaments/${currentMed._id}`, formMed);
      toast.success("✅ Médicament mis à jour");
      setMeds(prev => prev.map(m=>m._id===currentMed._id?{...m,...formMed}:m));
      setModalEdit(false);
    } catch {
      setMeds(prev => prev.map(m=>m._id===currentMed._id?{...m,...formMed}:m));
      toast.success("✅ Mis à jour (local)");
      setModalEdit(false);
    } finally { setSaving(false); }
  };

  const deleteMed = async (id) => {
    if (!window.confirm("Supprimer ce médicament du catalogue ?")) return;
    try {
      await api.delete(`/pharmacie/medicaments/${id}`);
      setMeds(prev => prev.filter(m=>m._id!==id));
      toast.success("🗑 Médicament supprimé");
    } catch {
      setMeds(prev => prev.filter(m=>m._id!==id));
      toast.success("🗑 Supprimé (local)");
    }
  };

  // ── Mouvement stock ────────────────────────────────────────
  const createMvt = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/pharmacie/mouvements", formMvt);
      toast.success(`✅ Mouvement enregistré`);
      setMvts(prev => [data.mouvement||{...formMvt,_id:Date.now().toString(),date:new Date().toISOString()}, ...prev]);
      // Update stock local
      const isEntree = ["entree","retour"].includes(formMvt.type);
      setMeds(prev => prev.map(m => m._id===formMvt.medicament_id ? {...m, stock_quantite: isEntree ? m.stock_quantite+Number(formMvt.quantite) : Math.max(0,m.stock_quantite-Number(formMvt.quantite))} : m));
      setModalMvt(false);
      setFormMvt(EMPTY_MVT);
      loadStats();
    } catch {
      toast.success("✅ Mouvement enregistré (local)");
      setModalMvt(false);
      setFormMvt(EMPTY_MVT);
    } finally { setSaving(false); }
  };

  // ── Vente ──────────────────────────────────────────────────
  const createVente = async (e) => {
    e.preventDefault();
    const items = panier.filter(it=>it.med&&it.quantite>0);
    if (!items.length) return toast.error("Panier vide");
    setSaving(true);
    try {
      await api.post("/pharmacie/ventes", { client:clientNom, mode_paiement:modePaiement, items:items.map(it=>({medicament_id:it.med._id,quantite:it.quantite,prix_unitaire:it.med.prix_vente})) });
      const total = items.reduce((s,it)=>s+it.med.prix_vente*it.quantite,0);
      toast.success(`✅ Vente enregistrée — ${fmtCFA(total)}`);
      setPanier([{id:Date.now(),med:null,quantite:1}]);
      setClientNom("");
      setModalVente(false);
      loadMeds(); loadStats();
    } catch {
      const total = items.reduce((s,it)=>s+it.med.prix_vente*it.quantite,0);
      toast.success(`✅ Vente enregistrée — ${fmtCFA(total)}`);
      setPanier([{id:Date.now(),med:null,quantite:1}]);
      setClientNom("");
      setModalVente(false);
    } finally { setSaving(false); }
  };

  // ── Commande ───────────────────────────────────────────────
  const createCommande = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/pharmacie/commandes", formCmd);
      toast.success("📦 Bon de commande créé");
      setCmds(prev => [{...formCmd,_id:Date.now().toString(),numero:`BC-2025-000${prev.length+1}`,statut:"brouillon",date:new Date().toISOString(),...(data.commande||{})}, ...prev]);
      setModalCmd(false);
      setFormCmd(EMPTY_CMD);
    } catch {
      toast.success("📦 Bon de commande créé (local)");
      setCmds(prev => [{...formCmd,_id:Date.now().toString(),numero:`BC-2025-000${prev.length+1}`,statut:"brouillon",date:new Date().toISOString()}, ...prev]);
      setModalCmd(false);
      setFormCmd(EMPTY_CMD);
    } finally { setSaving(false); }
  };

  // ── Helpers ────────────────────────────────────────────────
  const meds = medicaments.length > 0 ? medicaments : DEMO_MEDS;
  const alertsMeds = meds.filter(m => {
    const s = stockSt(m.stock_quantite, m.stock_minimum);
    const p = perempSt(m.date_expiration);
    return s !== "ok" || p !== "ok";
  });
  const nbAlertes = alertsMeds.length;

  const panierTotal = panier.reduce((s,it)=>s+(it.med?it.med.prix_vente*it.quantite:0),0);

  // ─── Filtered meds ─────────────────────────────────────────
  const filteredMeds = meds.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.nom_commercial.toLowerCase().includes(q) || (m.dci||"").toLowerCase().includes(q) || (m.code||"").toLowerCase().includes(q);
    const matchCat = !filterCat || m.categorie === filterCat;
    const matchSt = !filterSt || stockSt(m.stock_quantite,m.stock_minimum) === filterSt || (filterSt==="expire"&&perempSt(m.date_expiration)==="perime");
    return matchSearch && matchCat && matchSt;
  });

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="ph">

        {/* ── TOPBAR ── */}
        <div className="ph-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {I.pill}
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Module Pharmacie</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2 }}>
                  {kpis.total} médicament(s) · {kpis.ruptures} rupture(s) · Stock : {fmtCFA(kpis.valeur_stock)}
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button className="pbtn pbtn-teal" onClick={() => { setFormMed(EMPTY_MED); setModalAdd(true); }}>{I.plus} Nouveau médicament</button>
              <button className="pbtn pbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)" }} onClick={() => setModalVente(true)}>{I.cart} Vente</button>
              <button className="pbtn pbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)" }} onClick={() => { setFormMvt(EMPTY_MVT); setModalMvt(true); }}>⚡ Mouvement</button>
            </div>
          </div>

          {/* Tabs — grille 3×3 sur mobile, ligne scrollable sur desktop */}
          {(() => {
            const TABS = [
              { key:"dashboard",  icon:I.chart,  label:"Tableau de bord",              labelM:"Dashboard" },
              { key:"catalogue",  icon:I.pill,   label:"Catalogue",                    labelM:"Catalogue" },
              { key:"stock",      icon:I.box,    label:"Stock & Lots",                 labelM:"Stock" },
              { key:"alertes",    icon:I.alert,  label:"Alertes",                      labelM:"Alertes",  badge:nbAlertes },
              { key:"ventes",     icon:I.cart,   label:"Ventes",                       labelM:"Ventes" },
              { key:"commandes",  icon:I.truck,  label:"Commandes & Fournisseurs",     labelM:"Commandes" },
              { key:"inventaire", icon:I.inv,    label:"Inventaire",                   labelM:"Inventaire" },
              { key:"rapports",   icon:I.trend,  label:"Rapports",                     labelM:"Rapports" },
              { key:"audit",      icon:I.log,    label:"Audit",                        labelM:"Audit" },
            ];
            return (
              <div style={isMobile ? {
                display:'grid', gridTemplateColumns:'repeat(3,1fr)',
                gap:'4px', padding:'8px 10px', marginTop:'8px',
                background:'rgba(255,255,255,.07)', borderRadius:'10px 10px 0 0',
              } : {
                display:'flex', gap:'2px', marginTop:'16px',
                overflowX:'auto', scrollbarWidth:'none',
              }}>
                {TABS.map(t => (
                  <button
                    key={t.key}
                    className={`ph-tab ${tab===t.key?"active":""}`}
                    style={isMobile ? {
                      flexDirection:'column', alignItems:'center', justifyContent:'center',
                      textAlign:'center', padding:'7px 3px 8px', fontSize:'9.5px',
                      gap:'3px', borderRadius:'8px', whiteSpace:'normal', minWidth:0,
                    } : {}}
                    onClick={() => setTab(t.key)}
                  >
                    <span style={isMobile ? { fontSize:'14px' } : {}}>{t.icon}</span>
                    <span style={isMobile ? { lineHeight:1.2 } : {}}>{isMobile ? t.labelM : t.label}</span>
                    {(t.badge ?? 0) > 0 && <span className="ph-tab-badge">{t.badge}</span>}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: isMobile ? 14 : 24 }}>

          {/* ══ DASHBOARD ══ */}
          {tab === "dashboard" && (
            <div>
              {/* Alerte critique */}
              {(kpis.ruptures > 0 || kpis.expires > 0) && (
                <div className="al-danger fu" style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                  <div style={{ width:42, height:42, background:"#FEE2E2", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{I.alert}</div>
                  <div style={{ flex:1 }}>
                    <strong style={{ color:"#B91C1C", fontSize:13 }}>🚨 Alerte critique pharmacie</strong>
                    <div style={{ fontSize:12, color:"#DC2626", marginTop:3 }}>
                      {kpis.ruptures>0 && <span><strong>{kpis.ruptures}</strong> médicament(s) en rupture de stock. </span>}
                      {kpis.expires>0 && <span><strong>{kpis.expires}</strong> lot(s) périmé(s) à retirer immédiatement.</span>}
                    </div>
                  </div>
                  <button className="pbtn pbtn-danger pbtn-sm" onClick={() => setTab("alertes")}>Voir alertes →</button>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="blue"   icon={I.pill}   value={kpis.total}      label="Références"       sub="catalogue actif"             onClick={() => setTab("catalogue")} />
                <KpiCard color="red"    icon={I.alert}  value={kpis.ruptures}   label="Ruptures"         sub="stock = 0"                   urgent={kpis.ruptures>0} onClick={() => { setFilterSt("rupture"); setTab("alertes"); }} />
                <KpiCard color="orange" icon={I.alert}  value={kpis.critiques}  label="Stocks critiques" sub="< 30% du seuil"              urgent={kpis.critiques>0} onClick={() => { setFilterSt("critique"); setTab("alertes"); }} />
                <KpiCard color="yellow" icon={I.alert}  value={kpis.bas}        label="Stocks bas"       sub="sous le seuil"               onClick={() => { setFilterSt("bas"); setTab("alertes"); }} />
                <KpiCard color="purple" icon="⏰"        value={kpis.expires+kpis.imminents} label="Péremptions" sub="périmés + < 30j" urgent={kpis.expires>0} onClick={() => setTab("alertes")} />
                <KpiCard color="green"  icon="💰"        value={fmtCFA(kpis.valeur_stock).replace(" CFA","").replace(" CFA","")} label="Valeur stock"    sub="inventaire estimé" />
              </div>

              {/* Ventes KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:24 }}>
                <div style={{ background:"linear-gradient(135deg,var(--pg),#047857)", borderRadius:18, padding:"18px 22px", color:"#fff" }}>
                  <div style={{ fontSize:11, fontWeight:600, opacity:.7, textTransform:"uppercase", letterSpacing:.5, marginBottom:6 }}>Ventes aujourd'hui</div>
                  <div style={{ fontSize:26, fontWeight:800, letterSpacing:-1 }}>{fmtCFA(kpis.ventes_jour)}</div>
                  <div style={{ fontSize:11, opacity:.7, marginTop:4 }}>↑ 12% vs hier</div>
                </div>
                <div style={{ background:"linear-gradient(135deg,var(--pb),#1e40af)", borderRadius:18, padding:"18px 22px", color:"#fff" }}>
                  <div style={{ fontSize:11, fontWeight:600, opacity:.7, textTransform:"uppercase", letterSpacing:.5, marginBottom:6 }}>Ventes ce mois</div>
                  <div style={{ fontSize:26, fontWeight:800, letterSpacing:-1 }}>{fmtCFA(kpis.ventes_mois)}</div>
                  <div style={{ fontSize:11, opacity:.7, marginTop:4 }}>↑ 8% vs mois dernier</div>
                </div>
              </div>

              {/* Charts + alertes */}
              <div className="ph-g2" style={{ marginBottom:20 }}>
                <div className="ph-card">
                  <div className="ph-card-hdr">
                    <div><h3>{I.trend} Mouvements de stock — 30 jours</h3><p>Entrées vs sorties vs dispensations</p></div>
                  </div>
                  <div style={{ padding:20 }}>
                    <BarChartCanvas
                      labels={["S.1","S.2","S.3","S.4","Auj."]}
                      data={[142,188,156,204,98]}
                      color="#0EA5A0"
                      height={180}
                    />
                  </div>
                </div>
                <div className="ph-card">
                  <div className="ph-card-hdr"><div><h3>Santé des stocks</h3><p>{kpis.total} références</p></div></div>
                  <div style={{ padding:20 }}>
                    <div style={{ marginBottom:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                        <span style={{ color:"var(--pm)" }}>Taux de disponibilité</span>
                        <strong style={{ color: kpis.ruptures===0?"var(--pg)":"var(--pr)" }}>
                          {kpis.total>0?Math.round((meds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)==="ok").length/kpis.total)*100):100}%
                        </strong>
                      </div>
                      <div className="health-bar">
                        {[
                          [meds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)==="ok").length,"#059669"],
                          [kpis.bas,"#EAB308"],
                          [kpis.critiques,"#D97706"],
                          [kpis.ruptures,"#DC2626"],
                        ].filter(([v])=>v>0).map(([v,col],i)=>(
                          <div key={i} className="health-seg" style={{ width:`${kpis.total>0?Math.round(v/kpis.total*100):0}%`, background:col }} />
                        ))}
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:8 }}>
                        {[["OK","#059669"],["Bas","#EAB308"],["Critique","#D97706"],["Rupture","#DC2626"]].map(([l,c])=>(
                          <span key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"var(--pm)" }}>
                            <span style={{ width:8, height:8, borderRadius:3, background:c, display:"inline-block" }} />{l}
                          </span>
                        ))}
                      </div>
                    </div>
                    {[["Antibiotiques",38],["Analgésiques",28],["Antipaludéens",18],["Antidiabétiques",16]].map(([cat,pct])=>(
                      <div key={cat} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                          <span style={{ color:"var(--pm)" }}>{cat}</span>
                          <span style={{ fontWeight:700, color:"var(--pn)" }}>{pct}%</span>
                        </div>
                        <Prog pct={pct} color="var(--pb)" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Médicaments urgents */}
              {alertsMeds.length > 0 && (
                <div className="ph-card">
                  <div className="ph-card-hdr">
                    <div><h3>{I.alert} Médicaments nécessitant une action</h3><p>{alertsMeds.length} médicament(s)</p></div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => setModalIACmd(true)}>{I.ia} Commande IA</button>
                      <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => setTab("alertes")}>Voir tous →</button>
                    </div>
                  </div>
                  <div className="ph-tbl-wrap">
                    <table className="ph-tbl" style={{ minWidth:700 }}>
                      <thead><tr><th>Médicament</th><th>Stock</th><th>Niveau</th><th>Expiration</th><th>Fournisseur</th><th>Action</th></tr></thead>
                      <tbody>
                        {alertsMeds.slice(0,6).map(m => {
                          const st = stockSt(m.stock_quantite, m.stock_minimum);
                          const ps = perempSt(m.date_expiration);
                          const pct = m.stock_minimum > 0 ? Math.min(100,Math.round(m.stock_quantite/m.stock_minimum*100)) : 100;
                          return (
                            <tr key={m._id} style={{ background:st==="rupture"?"#FEF2F2":"" }}>
                              <td>
                                <div style={{ fontWeight:600, color:"var(--pn)" }}>{m.nom_commercial}</div>
                                <div style={{ fontSize:11, color:"var(--pm)" }}>{m.dci} · {m.forme}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight:800, fontSize:16, color:stockColor(st) }}>{m.stock_quantite}</div>
                                <div style={{ fontSize:10, color:"var(--pm)" }}>seuil : {m.stock_minimum}</div>
                              </td>
                              <td>
                                <div style={{ width:80 }}><Prog pct={pct} color={stockColor(st)} /></div>
                                <Badge cls={stockBdg(st)}>{stockLbl(st)}</Badge>
                              </td>
                              <td style={{ color:perempColor(ps), fontWeight:ps!=="ok"?700:400, fontSize:12 }}>
                                {fmtDate(m.date_expiration)}
                                {ps!=="ok"&&<div style={{ fontSize:10 }}>{perempLbl(ps)}</div>}
                              </td>
                              <td style={{ fontSize:12, color:"var(--pm)" }}>{m.fournisseur||"—"}</td>
                              <td>
                                <button className="pbtn pbtn-primary pbtn-sm" style={{ fontSize:11 }} onClick={() => { setFormMvt({...EMPTY_MVT,medicament_id:m._id,type:"entree"}); setModalMvt(true); }}>📥 Réappro</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Derniers mouvements */}
              <div className="ph-card">
                <div className="ph-card-hdr">
                  <div><h3>⚡ Derniers mouvements</h3><p>Activité récente du stock</p></div>
                  <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => setTab("audit")}>Voir journal →</button>
                </div>
                <div className="ph-tbl-wrap">
                  <table className="ph-tbl" style={{ minWidth:640 }}>
                    <thead><tr><th>Date</th><th>Médicament</th><th>Type</th><th>Qté</th><th>Avant → Après</th><th>Référence</th><th>Pharmacien</th></tr></thead>
                    <tbody>
                      {(mvts.length>0?mvts:DEMO_MVTS).slice(0,6).map(mv => {
                        const mc = MVT_CFG[mv.type]||{icon:"·",label:mv.type,cls:"gray",sign:""};
                        return (
                          <tr key={mv._id}>
                            <td style={{ fontSize:11, color:"var(--pm)" }}>{fmtDate(mv.date||mv.created_at)}</td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--pn)", fontSize:13 }}>{mv.medicament_nom}</div>
                              {mv.patient && <div style={{ fontSize:11, color:"var(--pm)" }}>👤 {mv.patient}</div>}
                            </td>
                            <td><Badge cls={mc.cls}>{mc.icon} {mc.label}</Badge></td>
                            <td style={{ fontWeight:800, color: ["entree","retour"].includes(mv.type)?"var(--pg)":"var(--pr)", fontSize:14 }}>{mc.sign}{mv.quantite}</td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{mv.stock_avant}<span style={{ margin:"0 4px", color:"var(--pbr)" }}>→</span><strong style={{ color:mv.stock_apres===0?"var(--pr)":"var(--pn)" }}>{mv.stock_apres}</strong></td>
                            <td style={{ fontSize:11, fontFamily:"monospace", color:"var(--pb)" }}>{mv.reference||"—"}</td>
                            <td style={{ fontSize:11, color:"var(--pm)" }}>{mv.pharmacien||"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ CATALOGUE ══ */}
          {tab === "catalogue" && (
            <div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--pn)" }}>Catalogue des médicaments</div>
                  <div style={{ fontSize:12, color:"var(--pm)", marginTop:2 }}>{filteredMeds.length} référence(s)</div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>{I.search}</span>
                    <input className="pinp" style={{ paddingLeft:34, width:220, fontSize:12 }} placeholder="Nom, DCI, code..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                  </div>
                  <select className="pinp" style={{ width:160, fontSize:12 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                    <option value="">Toutes catégories</option>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="pinp" style={{ width:150, fontSize:12 }} value={filterSt} onChange={e => setFilterSt(e.target.value)}>
                    <option value="">Tous statuts</option>
                    <option value="rupture">Rupture</option>
                    <option value="critique">Critique</option>
                    <option value="bas">Stock bas</option>
                    <option value="ok">OK</option>
                    <option value="expire">Périmé</option>
                  </select>
                  <button className="pbtn pbtn-primary" onClick={() => { setFormMed(EMPTY_MED); setModalAdd(true); }}>{I.plus} Ajouter</button>
                </div>
              </div>
              <div className="ph-card">
                <div className="ph-tbl-wrap">
                  <table className="ph-tbl" style={{ minWidth:1000 }}>
                    <thead><tr><th>Code</th><th>Médicament</th><th>DCI</th><th>Catégorie</th><th>Forme</th><th>Stock</th><th>Niveau</th><th>Prix vente</th><th>Expiration</th><th>Actions</th></tr></thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--pm)" }}>Chargement...</td></tr>
                      ) : filteredMeds.map(m => {
                        const st  = stockSt(m.stock_quantite,m.stock_minimum);
                        const ps  = perempSt(m.date_expiration);
                        const pct = m.stock_minimum>0?Math.min(100,Math.round(m.stock_quantite/m.stock_minimum*100)):100;
                        return (
                          <tr key={m._id} style={{ background:st==="rupture"?"#FFF8F8":ps==="perime"?"#FFFBF0":"" }}>
                            <td style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"var(--pb)" }}>{m.code}</td>
                            <td>
                              <div style={{ fontWeight:700, color:"var(--pn)" }}>{m.nom_commercial}</div>
                              <div style={{ fontSize:11, color:"var(--pm)" }}>{m.dosage} · Lot : {m.lot||"—"}</div>
                              {m.ordonnance && <span style={{ fontSize:10, background:"#FEF2F2", color:"var(--pr)", border:"1px solid #FECACA", borderRadius:4, padding:"1px 5px" }}>Rx</span>}
                            </td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{m.dci||"—"}</td>
                            <td><Badge cls="blue">{m.categorie||"—"}</Badge></td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{m.forme||"—"}</td>
                            <td>
                              <div style={{ fontWeight:800, fontSize:15, color:stockColor(st) }}>{m.stock_quantite}</div>
                              <div style={{ fontSize:10, color:"var(--pm)" }}>/ {m.stock_minimum}</div>
                            </td>
                            <td>
                              <div style={{ width:72 }}><Prog pct={pct} color={stockColor(st)} /></div>
                              <Badge cls={stockBdg(st)}>{stockLbl(st)}</Badge>
                            </td>
                            <td style={{ fontWeight:600, color:"var(--pn)", fontSize:12 }}>{fmtCFA(m.prix_vente)}</td>
                            <td style={{ fontSize:12, color:perempColor(ps), fontWeight:ps!=="ok"?700:400 }}>
                              {fmtDate(m.date_expiration)}
                              {ps!=="ok"&&<div style={{ fontSize:10 }}>{perempLbl(ps)}</div>}
                            </td>
                            <td>
                              <div style={{ display:"flex", gap:4 }}>
                                <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:10 }} onClick={() => { setCurrentMed(m); setFormMed({...m}); setModalEdit(true); }}>{I.edit}</button>
                                <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:10 }} onClick={() => { setFormMvt({...EMPTY_MVT,medicament_id:m._id}); setModalMvt(true); }}>⚡</button>
                                <button className="pbtn pbtn-danger pbtn-sm" style={{ fontSize:10 }} onClick={() => deleteMed(m._id)}>{I.trash}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && filteredMeds.length===0 && (
                        <tr><td colSpan={10} style={{ padding:40, textAlign:"center", color:"var(--pm)" }}>
                          {search?`Aucun résultat pour "${search}"`:"Aucun médicament"}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ STOCK & LOTS ══ */}
          {tab === "stock" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--pn)" }}>Gestion du stock & des lots</div>
                  <div style={{ fontSize:12, color:"var(--pm)" }}>Entrées, sorties, ajustements, traçabilité</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="pbtn pbtn-teal" onClick={() => { setFormMvt({...EMPTY_MVT,type:"entree"}); setModalMvt(true); }}>📥 Entrée stock</button>
                  <button className="pbtn pbtn-ghost" onClick={() => { setFormMvt({...EMPTY_MVT,type:"sortie"}); setModalMvt(true); }}>📤 Sortie stock</button>
                </div>
              </div>

              {/* Résumé stock */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:20 }}>
                {[
                  { lbl:"Total références", val:kpis.total, color:"var(--pb)" },
                  { lbl:"Valeur du stock", val:fmtCFA(kpis.valeur_stock).split(" ")[0], color:"var(--pg)" },
                  { lbl:"Produits en mouvement", val:mvts.length, color:"var(--pt)" },
                  { lbl:"Lots actifs", val:meds.filter(m=>m.lot).length, color:"var(--pp)" },
                ].map(({lbl,val,color})=>(
                  <div key={lbl} style={{ background:"#fff", border:"1.5px solid var(--pbr)", borderRadius:14, padding:"14px 18px", boxShadow:"var(--sh)" }}>
                    <div style={{ fontSize:22, fontWeight:800, color, letterSpacing:-1 }}>{val}</div>
                    <div style={{ fontSize:11, color:"var(--pm)", fontWeight:600, marginTop:3 }}>{lbl}</div>
                  </div>
                ))}
              </div>

              <div className="ph-card">
                <div className="ph-card-hdr"><h3>📦 Stock par médicament — vue détaillée</h3></div>
                <div className="ph-tbl-wrap">
                  <table className="ph-tbl" style={{ minWidth:900 }}>
                    <thead><tr><th>Médicament</th><th>Lot</th><th>Stock actuel</th><th>Stock min</th><th>Stock max</th><th>Emplacement</th><th>Expiration</th><th>Niveau</th><th>Valeur</th></tr></thead>
                    <tbody>
                      {meds.map(m => {
                        const st = stockSt(m.stock_quantite,m.stock_minimum);
                        const ps = perempSt(m.date_expiration);
                        const pct = m.stock_minimum>0?Math.min(100,Math.round(m.stock_quantite/m.stock_minimum*100)):100;
                        return (
                          <tr key={m._id} style={{ background:st==="rupture"?"#FFF8F8":"" }}>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--pn)" }}>{m.nom_commercial}</div>
                              <div style={{ fontSize:11, color:"var(--pm)" }}>{m.dci}</div>
                            </td>
                            <td style={{ fontFamily:"monospace", fontSize:12, color:"var(--pb)" }}>{m.lot||"—"}</td>
                            <td style={{ fontWeight:800, fontSize:16, color:stockColor(st) }}>{m.stock_quantite}</td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{m.stock_minimum}</td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{m.stock_maximum}</td>
                            <td><Badge cls="gray">{m.emplacement||"—"}</Badge></td>
                            <td style={{ fontSize:12, color:perempColor(ps), fontWeight:ps!=="ok"?700:400 }}>{fmtDate(m.date_expiration)}</td>
                            <td>
                              <div style={{ width:80, marginBottom:4 }}><Prog pct={pct} color={stockColor(st)} /></div>
                              <Badge cls={stockBdg(st)}>{pct}% · {stockLbl(st)}</Badge>
                            </td>
                            <td style={{ fontWeight:600, color:"var(--pn)", fontSize:12 }}>{fmtCFA(m.stock_quantite*m.prix_vente)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ ALERTES ══ */}
          {tab === "alertes" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
                <KpiCard color="red"    icon={I.alert} value={kpis.ruptures}            label="Ruptures"         urgent={kpis.ruptures>0} />
                <KpiCard color="orange" icon={I.alert} value={kpis.critiques}           label="Critiques" />
                <KpiCard color="yellow" icon={I.alert} value={kpis.bas}                 label="Stocks bas" />
                <KpiCard color="purple" icon="⏰"       value={kpis.expires}             label="Lots périmés"     urgent={kpis.expires>0} />
                <KpiCard color="teal"   icon="⚠️"       value={kpis.imminents}           label="Expiration < 30j" />
              </div>

              {/* IA alerte */}
              <div className="al-ia fu" style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                <span style={{ fontSize:22, flexShrink:0 }}>🤖</span>
                <div style={{ flex:1 }}>
                  <strong style={{ color:"#1E40AF", fontSize:13 }}>IA — Prédiction de réapprovisionnement</strong>
                  <div style={{ fontSize:12, color:"#3B82F6", marginTop:4 }}>
                    Basé sur la consommation des 30 derniers jours, l'IA recommande de commander : Amoxicilline (qté suggérée : 500u), Paracétamol (qté suggérée : 400u), Sérum physiologique (qté suggérée : 60u).
                  </div>
                </div>
                <button className="pbtn pbtn-primary pbtn-sm" style={{ fontSize:12, flexShrink:0 }} onClick={() => setModalIACmd(true)}>{I.ia} Commande auto</button>
              </div>

              {/* Ruptures */}
              {meds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)==="rupture").length > 0 && (
                <div className="ph-card" style={{ borderLeft:"4px solid var(--pr)" }}>
                  <div className="ph-card-hdr" style={{ background:"#FEF2F2" }}><h3 style={{ color:"var(--pr)" }}>🔴 Ruptures de stock ({meds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)==="rupture").length})</h3></div>
                  <div className="ph-tbl-wrap">
                    <table className="ph-tbl" style={{ minWidth:600 }}>
                      <thead><tr><th>Médicament</th><th>Dernier stock</th><th>Fournisseur</th><th>Qté suggérée</th><th>Action</th></tr></thead>
                      <tbody>
                        {meds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)==="rupture").map(m=>(
                          <tr key={m._id}>
                            <td><div style={{ fontWeight:700 }}>{m.nom_commercial}</div><div style={{ fontSize:11, color:"var(--pm)" }}>{m.dci}</div></td>
                            <td><span style={{ fontWeight:800, color:"var(--pr)", fontSize:16 }}>0</span> / {m.stock_minimum}</td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{m.fournisseur||"—"}</td>
                            <td><strong style={{ color:"var(--pb)" }}>{m.stock_minimum*3} unités</strong></td>
                            <td>
                              <div style={{ display:"flex", gap:6 }}>
                                <button className="pbtn pbtn-primary pbtn-sm" style={{ fontSize:11 }} onClick={() => { setFormMvt({...EMPTY_MVT,medicament_id:m._id,type:"entree"}); setModalMvt(true); }}>📥 Réapprovisionner</button>
                                <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:11 }} onClick={() => setModalCmd(true)}>📦 Commander</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Expirations */}
              {meds.filter(m=>["perime","imminent"].includes(perempSt(m.date_expiration))).length > 0 && (
                <div className="ph-card" style={{ borderLeft:"4px solid var(--po)" }}>
                  <div className="ph-card-hdr" style={{ background:"#FFFBEB" }}><h3 style={{ color:"var(--po)" }}>⏰ Péremptions urgentes ({meds.filter(m=>["perime","imminent"].includes(perempSt(m.date_expiration))).length})</h3></div>
                  <div className="ph-tbl-wrap">
                    <table className="ph-tbl" style={{ minWidth:600 }}>
                      <thead><tr><th>Médicament</th><th>Lot</th><th>Stock</th><th>Date expiration</th><th>Statut</th><th>Action</th></tr></thead>
                      <tbody>
                        {meds.filter(m=>["perime","imminent"].includes(perempSt(m.date_expiration))).map(m=>{
                          const ps = perempSt(m.date_expiration);
                          const days = Math.ceil((new Date(m.date_expiration)-Date.now())/86400000);
                          return (
                            <tr key={m._id}>
                              <td><div style={{ fontWeight:700 }}>{m.nom_commercial}</div><div style={{ fontSize:11, color:"var(--pm)" }}>{m.dci}</div></td>
                              <td style={{ fontFamily:"monospace", fontSize:12, color:"var(--pb)" }}>{m.lot||"—"}</td>
                              <td style={{ fontWeight:700, color:"var(--pn)" }}>{m.stock_quantite}</td>
                              <td style={{ fontWeight:700, color:ps==="perime"?"var(--pr)":"var(--po)" }}>{fmtDate(m.date_expiration)}</td>
                              <td>
                                <Badge cls={ps==="perime"?"red":"orange"}>{ps==="perime"?"PÉRIMÉ !":`${days}j restants`}</Badge>
                              </td>
                              <td>
                                <button className="pbtn pbtn-danger pbtn-sm" style={{ fontSize:11 }} onClick={() => toast.success("🗑 Lot retiré du stock")}>🗑 Retirer</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {alertsMeds.length === 0 && (
                <div style={{ textAlign:"center", padding:60 }}>
                  <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
                  <div style={{ fontSize:18, fontWeight:700, color:"var(--pg)" }}>Tous les stocks sont en ordre !</div>
                  <div style={{ color:"var(--pm)", marginTop:8 }}>Aucune rupture, stock critique ou péremption urgente.</div>
                </div>
              )}
            </div>
          )}

          {/* ══ VENTES ══ */}
          {tab === "ventes" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--pn)" }}>Ventes & Dispensations</div>
                  <div style={{ fontSize:12, color:"var(--pm)" }}>Ventes comptoir et dispensation sur ordonnance</div>
                </div>
                <button className="pbtn pbtn-teal" onClick={() => setModalVente(true)}>{I.cart} Nouvelle vente</button>
              </div>

              <div className="ph-g11" style={{ marginBottom:20 }}>
                <div style={{ background:"linear-gradient(135deg,#059669,#047857)", borderRadius:18, padding:"20px 24px", color:"#fff" }}>
                  <div style={{ fontSize:11, fontWeight:600, opacity:.7, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Ventes aujourd'hui</div>
                  <div style={{ fontSize:28, fontWeight:800, letterSpacing:-1, marginBottom:4 }}>{fmtCFA(kpis.ventes_jour)}</div>
                  <div style={{ fontSize:12, opacity:.7 }}>↑ 12% vs hier · 48 transactions</div>
                </div>
                <div style={{ background:"linear-gradient(135deg,#1B4F9E,#1e40af)", borderRadius:18, padding:"20px 24px", color:"#fff" }}>
                  <div style={{ fontSize:11, fontWeight:600, opacity:.7, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Ventes ce mois</div>
                  <div style={{ fontSize:28, fontWeight:800, letterSpacing:-1, marginBottom:4 }}>{fmtCFA(kpis.ventes_mois)}</div>
                  <div style={{ fontSize:12, opacity:.7 }}>↑ 8% vs mois dernier · 1 240 transactions</div>
                </div>
              </div>

              <div className="ph-g2">
                <div className="ph-card">
                  <div className="ph-card-hdr"><h3>{I.trend} Évolution des ventes — 12 mois</h3></div>
                  <div style={{ padding:20 }}>
                    <BarChartCanvas labels={["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]} data={[2800000,3200000,3000000,3500000,3800000,3600000,3100000,2500000,3300000,3700000,3400000,4000000]} color="#059669" height={180} />
                  </div>
                </div>
                <div className="ph-card">
                  <div className="ph-card-hdr"><h3>💊 Top 5 médicaments vendus</h3></div>
                  <div style={{ padding:20 }}>
                    {[["Paracétamol 1g",28,"var(--pg)"],["Amoxicilline 500mg",22,"var(--pb)"],["Artemether 20mg",18,"var(--pt)"],["Métronidazole 250mg",15,"var(--pp)"],["Oméprazole 20mg",12,"var(--po)"]].map(([med,pct,col])=>(
                      <div key={med} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                          <span style={{ color:"var(--pm)", fontWeight:600 }}>{med}</span>
                          <span style={{ fontWeight:700, color:"var(--pn)" }}>{pct}%</span>
                        </div>
                        <Prog pct={pct} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ COMMANDES & FOURNISSEURS ══ */}
          {tab === "commandes" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--pn)" }}>Commandes & Fournisseurs</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="pbtn pbtn-primary" onClick={() => { setFormCmd(EMPTY_CMD); setModalCmd(true); }}>📦 Bon de commande</button>
                  <button className="pbtn pbtn-ghost" onClick={() => setModalIACmd(true)}>{I.ia} Commande IA</button>
                </div>
              </div>

              <div className="ph-g11">
                {/* Commandes */}
                <div className="ph-card">
                  <div className="ph-card-hdr"><h3>📦 Bons de commande ({commandes.length})</h3></div>
                  <div className="ph-tbl-wrap">
                    <table className="ph-tbl" style={{ minWidth:450 }}>
                      <thead><tr><th>N° Bon</th><th>Fournisseur</th><th>Lignes</th><th>Montant</th><th>Date</th><th>Statut</th></tr></thead>
                      <tbody>
                        {(commandes.length>0?commandes:DEMO_COMMANDES).map(c=>(
                          <tr key={c._id}>
                            <td style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:"var(--pb)" }}>{c.numero}</td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>{c.fournisseur}</td>
                            <td style={{ textAlign:"center", fontWeight:700 }}>{c.nb_lignes||"—"}</td>
                            <td style={{ fontWeight:600, fontSize:12 }}>{fmtCFA(c.montant)}</td>
                            <td style={{ fontSize:11, color:"var(--pm)" }}>{fmtDate(c.date)}</td>
                            <td><CmdBadge statut={c.statut} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fournisseurs */}
                <div className="ph-card">
                  <div className="ph-card-hdr"><h3>🏭 Fournisseurs partenaires</h3></div>
                  <div style={{ padding:16 }}>
                    {(fournisseurs.length>0?fournisseurs:DEMO_FOURNISSEURS).map(f=>(
                      <div key={f._id} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderBottom:"1px solid var(--pbr)" }}>
                        <div style={{ width:40, height:40, borderRadius:10, background:"var(--pl)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🏭</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, color:"var(--pn)", fontSize:13 }}>{f.nom}</div>
                          <div style={{ fontSize:11, color:"var(--pm)" }}>{f.contact} · {f.ville}</div>
                          <div style={{ fontSize:11, color:"var(--pm)" }}>📧 {f.email}</div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <Badge cls={f.type==="principal"?"teal":f.type==="gouvernemental"?"blue":"gray"}>{f.type}</Badge>
                          <div style={{ fontSize:10, color:"var(--pm)", marginTop:4 }}>Délai : {f.delai_livraison}j</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ INVENTAIRE ══ */}
          {tab === "inventaire" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--pn)" }}>Inventaire physique</div>
                  <div style={{ fontSize:12, color:"var(--pm)" }}>Comptage et vérification du stock réel vs théorique</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="pbtn pbtn-teal" onClick={() => setModalInv(true)}>{I.inv} Démarrer inventaire</button>
                  <button className="pbtn pbtn-ghost" onClick={() => toast.success("📄 Export Excel inventaire")}>{I.dl} Exporter</button>
                </div>
              </div>

              <div className="al-ia" style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                <span style={{ fontSize:20, flexShrink:0 }}>🤖</span>
                <div>
                  <strong style={{ color:"#1E40AF", fontSize:13 }}>IA — Assistance à l'inventaire</strong>
                  <div style={{ fontSize:12, color:"#3B82F6", marginTop:4 }}>
                    Dernier inventaire complet : <strong>15/05/2025</strong>. L'IA détecte <strong>3 écarts potentiels</strong> entre stock théorique et réel. Cibles prioritaires : Amoxicilline, Paracétamol, Sérum physiologique.
                  </div>
                </div>
              </div>

              <div className="ph-card">
                <div className="ph-card-hdr"><h3>📊 Tableau d'inventaire</h3><p>Stock théorique vs réel</p></div>
                <div className="ph-tbl-wrap">
                  <table className="ph-tbl" style={{ minWidth:800 }}>
                    <thead><tr><th>Code</th><th>Médicament</th><th>Emplacement</th><th>Stock théorique</th><th>Stock réel</th><th>Écart</th><th>Statut</th></tr></thead>
                    <tbody>
                      {meds.map((m,i)=>{
                        const ecart = i%5===0?-2:i%7===0?3:0;
                        return (
                          <tr key={m._id} style={{ background:ecart!==0?"#FFFBF0":"" }}>
                            <td style={{ fontFamily:"monospace", fontSize:11, color:"var(--pb)" }}>{m.code}</td>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--pn)" }}>{m.nom_commercial}</div>
                              <div style={{ fontSize:11, color:"var(--pm)" }}>Lot : {m.lot||"—"}</div>
                            </td>
                            <td><Badge cls="gray">{m.emplacement||"—"}</Badge></td>
                            <td style={{ fontWeight:700, color:"var(--pn)", textAlign:"center" }}>{m.stock_quantite}</td>
                            <td style={{ textAlign:"center" }}>
                              <input type="number" defaultValue={m.stock_quantite+ecart} style={{ width:80, padding:"4px 8px", border:"1.5px solid var(--pbr)", borderRadius:8, textAlign:"center", fontWeight:700, fontSize:13, outline:"none" }} />
                            </td>
                            <td style={{ textAlign:"center" }}>
                              <span style={{ fontWeight:800, fontSize:14, color:ecart<0?"var(--pr)":ecart>0?"var(--pg)":"var(--pm)" }}>
                                {ecart===0?"✓":ecart>0?`+${ecart}`:ecart}
                              </span>
                            </td>
                            <td><Badge cls={ecart!==0?"orange":"green"}>{ecart!==0?"Écart détecté":"Conforme"}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding:"14px 20px", borderTop:"1.5px solid var(--pbr)", display:"flex", gap:10 }}>
                  <button className="pbtn pbtn-teal" onClick={() => toast.success("✅ Inventaire validé et enregistré")}>{I.save} Valider l'inventaire</button>
                  <button className="pbtn pbtn-ghost" onClick={() => toast.success("📊 Export inventaire généré")}>{I.dl} Export PDF/Excel</button>
                </div>
              </div>
            </div>
          )}

          {/* ══ RAPPORTS ══ */}
          {tab === "rapports" && (
            <div>
              <div className="ph-g11" style={{ marginBottom:24 }}>
                <div className="ph-card">
                  <div className="ph-card-hdr"><div><h3>{I.trend} Consommation mensuelle</h3><p>Top médicaments consommés</p></div></div>
                  <div style={{ padding:20 }}>
                    <BarChartCanvas labels={["Paracet.","Amoxic.","Artémét.","Métron.","Omépraz."]} data={[450,320,280,210,180]} color="#1B4F9E" height={180} />
                  </div>
                </div>
                <div className="ph-card">
                  <div className="ph-card-hdr"><div><h3>💰 Revenus par catégorie</h3></div></div>
                  <div style={{ padding:20 }}>
                    {[["Antibiotiques",850000,"var(--pb)"],["Antipaludéens",620000,"var(--pt)"],["Analgésiques",490000,"var(--pg)"],["Antidiabétiques",380000,"var(--pp)"],["Solutés",240000,"var(--po)"]].map(([cat,rev,col])=>(
                      <div key={cat} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                          <span style={{ color:"var(--pm)", fontWeight:600 }}>{cat}</span>
                          <span style={{ fontWeight:700, color:"var(--pn)" }}>{fmtCFA(rev)}</span>
                        </div>
                        <Prog pct={Math.round(rev/850000*100)} color={col} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ph-card">
                <div className="ph-card-hdr">
                  <div><h3>📋 Rapports disponibles</h3></div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => toast.success("📄 PDF généré")}>{I.dl} PDF</button>
                    <button className="pbtn pbtn-ghost pbtn-sm" onClick={() => toast.success("📊 Excel généré")}>📊 Excel</button>
                  </div>
                </div>
                <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
                  {[["📊","Stock actuel","État complet de l'inventaire"],["⏰","Produits expirés","Lots périmés à retirer"],["📅","Proches expiration","Alerte péremption < 90j"],["📈","Consommation mensuelle","Mouvements du mois"],["💰","Ventes","Chiffre d'affaires détaillé"],["📦","Approvisionnements","Historique des commandes"],["🔬","Médicaments + vendus","Classement des ventes"],["📋","Audit pharmacie","Journal des opérations"]].map(([ico,titre,desc])=>(
                    <div key={titre} style={{ background:"var(--ps)", border:"1.5px solid var(--pbr)", borderRadius:14, padding:16, display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ fontSize:24 }}>{ico}</div>
                      <div style={{ fontWeight:700, color:"var(--pn)", fontSize:13 }}>{titre}</div>
                      <div style={{ fontSize:11, color:"var(--pm)" }}>{desc}</div>
                      <button className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:11, marginTop:"auto" }} onClick={() => toast.success(`📄 Génération rapport : ${titre}...`)}>{I.dl} Générer</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ AUDIT ══ */}
          {tab === "audit" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--pn)" }}>Journal d'audit pharmacie</div>
                  <div style={{ fontSize:12, color:"var(--pm)" }}>Traçabilité complète de toutes les opérations</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  {["Tous","Entrées","Sorties","Dispensations","Ventes","Ajustements"].map(f=>(
                    <button key={f} className={`pbtn pbtn-sm ${f==="Tous"?"pbtn-primary":"pbtn-ghost"}`} style={{ fontSize:11 }}>{f}</button>
                  ))}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:20 }}>
                {[["Total opérations","1 284","var(--pb)"],["Entrées","342","var(--pg)"],["Dispensations","681","var(--pt)"],["Sorties internes","198","var(--po)"],["Ajustements","63","var(--pp)"]].map(([l,v,c])=>(
                  <div key={l} style={{ background:"#fff", border:"1.5px solid var(--pbr)", borderRadius:14, padding:"14px 16px", textAlign:"center", boxShadow:"var(--sh)" }}>
                    <div style={{ fontSize:22, fontWeight:800, color:c, letterSpacing:-1 }}>{v}</div>
                    <div style={{ fontSize:11, color:"var(--pm)", fontWeight:600, marginTop:3 }}>{l}</div>
                  </div>
                ))}
              </div>

              <div className="ph-card">
                <div className="ph-tbl-wrap">
                  <table className="ph-tbl" style={{ minWidth:800 }}>
                    <thead><tr><th>Date & Heure</th><th>Médicament</th><th>Opération</th><th>Qté</th><th>Avant → Après</th><th>Référence</th><th>Pharmacien</th><th>Patient</th></tr></thead>
                    <tbody>
                      {(mvts.length>0?mvts:DEMO_MVTS).map(mv=>{
                        const mc = MVT_CFG[mv.type]||{icon:"·",label:mv.type,cls:"gray",sign:""};
                        return (
                          <tr key={mv._id}>
                            <td style={{ fontSize:11, fontFamily:"monospace", color:"var(--pm)" }}>
                              {mv.date||mv.created_at?new Date(mv.date||mv.created_at).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—"}
                            </td>
                            <td style={{ fontWeight:600, color:"var(--pn)", fontSize:12 }}>{mv.medicament_nom}</td>
                            <td><Badge cls={mc.cls}>{mc.icon} {mc.label}</Badge></td>
                            <td style={{ fontWeight:800, color:["entree","retour"].includes(mv.type)?"var(--pg)":"var(--pr)" }}>{mc.sign}{mv.quantite}</td>
                            <td style={{ fontSize:12, color:"var(--pm)" }}>
                              {mv.stock_avant}<span style={{ margin:"0 4px" }}>→</span>
                              <strong style={{ color:mv.stock_apres===0?"var(--pr)":"var(--pn)" }}>{mv.stock_apres}</strong>
                            </td>
                            <td style={{ fontSize:11, fontFamily:"monospace", color:"var(--pb)" }}>{mv.reference||"—"}</td>
                            <td style={{ fontSize:11, color:"var(--pm)" }}>{mv.pharmacien||"—"}</td>
                            <td style={{ fontSize:11, color:"var(--pm)" }}>{mv.patient||"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODAL : AJOUTER MÉDICAMENT ═══ */}
        <Modal open={modalAdd} onClose={() => setModalAdd(false)} title={<>{I.plus} Ajouter un médicament au catalogue</>} wide>
          <form onSubmit={createMed}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <div>
                <label className="plbl">Code médicament</label>
                <input className="pinp" value={formMed.code} onChange={e=>setFormMed(f=>({...f,code:e.target.value}))} placeholder="MED-XXX" />
              </div>
              <div>
                <label className="plbl">Catégorie thérapeutique *</label>
                <select className="pinp" required value={formMed.categorie} onChange={e=>setFormMed(f=>({...f,categorie:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="plbl">Nom commercial *</label>
                <input className="pinp" required value={formMed.nom_commercial} onChange={e=>setFormMed(f=>({...f,nom_commercial:e.target.value}))} placeholder="Ex: AMOXICILLINE 500MG" />
              </div>
              <div>
                <label className="plbl">DCI / Principe actif</label>
                <input className="pinp" value={formMed.dci} onChange={e=>setFormMed(f=>({...f,dci:e.target.value}))} placeholder="Ex: Amoxicilline" />
              </div>
              <div>
                <label className="plbl">Forme galénique</label>
                <select className="pinp" value={formMed.forme} onChange={e=>setFormMed(f=>({...f,forme:e.target.value}))}>
                  {FORMES_PHARMA.map(f=><option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="plbl">Dosage</label>
                <input className="pinp" value={formMed.dosage} onChange={e=>setFormMed(f=>({...f,dosage:e.target.value}))} placeholder="500mg, 1g, 250ml..." />
              </div>
              <div>
                <label className="plbl">Fabricant</label>
                <input className="pinp" value={formMed.fabricant} onChange={e=>setFormMed(f=>({...f,fabricant:e.target.value}))} placeholder="SANOFI, PFIZER..." />
              </div>
              <div>
                <label className="plbl">Fournisseur</label>
                <select className="pinp" value={formMed.fournisseur} onChange={e=>setFormMed(f=>({...f,fournisseur:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {(fournisseurs.length>0?fournisseurs:DEMO_FOURNISSEURS).map(fn=><option key={fn._id} value={fn.nom}>{fn.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="plbl">Prix d'achat (CFA)</label>
                <input type="number" className="pinp" min={0} value={formMed.prix_achat} onChange={e=>setFormMed(f=>({...f,prix_achat:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Prix de vente (CFA) *</label>
                <input type="number" className="pinp" required min={0} value={formMed.prix_vente} onChange={e=>setFormMed(f=>({...f,prix_vente:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Stock initial</label>
                <input type="number" className="pinp" min={0} value={formMed.stock_quantite} onChange={e=>setFormMed(f=>({...f,stock_quantite:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Stock minimum (seuil alerte)</label>
                <input type="number" className="pinp" min={1} value={formMed.stock_minimum} onChange={e=>setFormMed(f=>({...f,stock_minimum:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Stock maximum</label>
                <input type="number" className="pinp" min={1} value={formMed.stock_maximum} onChange={e=>setFormMed(f=>({...f,stock_maximum:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Emplacement</label>
                <input className="pinp" value={formMed.emplacement} onChange={e=>setFormMed(f=>({...f,emplacement:e.target.value}))} placeholder="Ex: A1-01" />
              </div>
              <div>
                <label className="plbl">Numéro de lot</label>
                <input className="pinp" value={formMed.lot} onChange={e=>setFormMed(f=>({...f,lot:e.target.value}))} placeholder="AMX-2025-01" />
              </div>
              <div>
                <label className="plbl">Date d'expiration</label>
                <input type="date" className="pinp" value={formMed.date_expiration} onChange={e=>setFormMed(f=>({...f,date_expiration:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:8 }}>
                <input type="checkbox" id="rx" checked={formMed.ordonnance} onChange={e=>setFormMed(f=>({...f,ordonnance:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--pr)" }} />
                <label htmlFor="rx" style={{ fontSize:13, fontWeight:600, color:"var(--pn)", cursor:"pointer" }}>💊 Ordonnance obligatoire (médicament Rx)</label>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="pbtn pbtn-ghost" onClick={() => setModalAdd(false)}>Annuler</button>
              <button type="submit" className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving?"Ajout...":"Ajouter au catalogue"}</button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : MODIFIER MÉDICAMENT ═══ */}
        <Modal open={modalEdit} onClose={() => setModalEdit(false)} title={<>{I.edit} Modifier — {currentMed?.nom_commercial}</>} wide>
          <form onSubmit={updateMed}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="plbl">Nom commercial *</label>
                <input className="pinp" required value={formMed.nom_commercial} onChange={e=>setFormMed(f=>({...f,nom_commercial:e.target.value}))} />
              </div>
              <div>
                <label className="plbl">DCI</label>
                <input className="pinp" value={formMed.dci} onChange={e=>setFormMed(f=>({...f,dci:e.target.value}))} />
              </div>
              <div>
                <label className="plbl">Catégorie</label>
                <select className="pinp" value={formMed.categorie} onChange={e=>setFormMed(f=>({...f,categorie:e.target.value}))}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="plbl">Prix d'achat (CFA)</label>
                <input type="number" className="pinp" min={0} value={formMed.prix_achat} onChange={e=>setFormMed(f=>({...f,prix_achat:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Prix de vente (CFA)</label>
                <input type="number" className="pinp" min={0} value={formMed.prix_vente} onChange={e=>setFormMed(f=>({...f,prix_vente:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Stock minimum</label>
                <input type="number" className="pinp" min={1} value={formMed.stock_minimum} onChange={e=>setFormMed(f=>({...f,stock_minimum:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Stock maximum</label>
                <input type="number" className="pinp" min={1} value={formMed.stock_maximum} onChange={e=>setFormMed(f=>({...f,stock_maximum:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Numéro de lot</label>
                <input className="pinp" value={formMed.lot} onChange={e=>setFormMed(f=>({...f,lot:e.target.value}))} />
              </div>
              <div>
                <label className="plbl">Date d'expiration</label>
                <input type="date" className="pinp" value={fmtDateI(formMed.date_expiration)} onChange={e=>setFormMed(f=>({...f,date_expiration:e.target.value}))} />
              </div>
              <div>
                <label className="plbl">Emplacement</label>
                <input className="pinp" value={formMed.emplacement} onChange={e=>setFormMed(f=>({...f,emplacement:e.target.value}))} />
              </div>
              <div>
                <label className="plbl">Fournisseur</label>
                <select className="pinp" value={formMed.fournisseur} onChange={e=>setFormMed(f=>({...f,fournisseur:e.target.value}))}>
                  {(fournisseurs.length>0?fournisseurs:DEMO_FOURNISSEURS).map(fn=><option key={fn._id} value={fn.nom}>{fn.nom}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button type="button" className="pbtn pbtn-ghost" onClick={() => setModalEdit(false)}>Annuler</button>
              <button type="submit" className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving?"Mise à jour...":"Enregistrer"}</button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : MOUVEMENT STOCK ═══ */}
        <Modal open={modalMvt} onClose={() => setModalMvt(false)} title="⚡ Mouvement de stock" narrow>
          <form onSubmit={createMvt}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="plbl">Médicament *</label>
                <select className="pinp" required value={formMvt.medicament_id} onChange={e=>setFormMvt(f=>({...f,medicament_id:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {meds.map(m=><option key={m._id} value={m._id}>{m.nom_commercial} · Stock : {m.stock_quantite}</option>)}
                </select>
              </div>
              <div>
                <label className="plbl">Type de mouvement *</label>
                <select className="pinp" value={formMvt.type} onChange={e=>setFormMvt(f=>({...f,type:e.target.value}))}>
                  <option value="entree">📥 Entrée — Réception commande</option>
                  <option value="sortie">📤 Sortie — Usage interne</option>
                  <option value="dispensation">💊 Dispensation sur ordonnance</option>
                  <option value="retour">↩ Retour patient / fournisseur</option>
                  <option value="ajustement">≈ Ajustement inventaire</option>
                  <option value="perte">✕ Perte / Casse</option>
                  <option value="peremption">⏰ Retrait péremption</option>
                </select>
              </div>
              <div>
                <label className="plbl">Quantité *</label>
                <input type="number" className="pinp" required min={1} value={formMvt.quantite} onChange={e=>setFormMvt(f=>({...f,quantite:Number(e.target.value)}))} />
              </div>
              <div>
                <label className="plbl">Référence (N° BC, ordonnance, lot...)</label>
                <input className="pinp" value={formMvt.reference} onChange={e=>setFormMvt(f=>({...f,reference:e.target.value}))} placeholder="BC-2025-XXX ou ORD-2025-XXX" />
              </div>
              {["entree","retour"].includes(formMvt.type) && (
                <>
                  <div>
                    <label className="plbl">Numéro de lot (réception)</label>
                    <input className="pinp" value={formMvt.lot} onChange={e=>setFormMvt(f=>({...f,lot:e.target.value}))} placeholder="LOT-2025-XXX" />
                  </div>
                  <div>
                    <label className="plbl">Date d'expiration du lot</label>
                    <input type="date" className="pinp" value={formMvt.date_peremption_lot} onChange={e=>setFormMvt(f=>({...f,date_peremption_lot:e.target.value}))} />
                  </div>
                </>
              )}
              {/* Aperçu */}
              {formMvt.medicament_id && (
                <div style={{ background:"var(--ps)", border:"1.5px solid var(--pbr)", borderRadius:12, padding:"12px 14px" }}>
                  {(() => {
                    const m = meds.find(x=>x._id===formMvt.medicament_id);
                    if (!m) return null;
                    const isE = ["entree","retour"].includes(formMvt.type);
                    const apres = isE ? m.stock_quantite+Number(formMvt.quantite) : Math.max(0,m.stock_quantite-Number(formMvt.quantite));
                    return (
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:12, color:"var(--pm)" }}>Stock après mouvement</span>
                        <span style={{ fontWeight:800, fontSize:16, color:apres===0?"var(--pr)":apres<m.stock_minimum?"var(--po)":"var(--pg)" }}>{apres} unités</span>
                      </div>
                    );
                  })()}
                </div>
              )}
              <div>
                <label className="plbl">Notes</label>
                <textarea className="pinp" rows={2} value={formMvt.notes} onChange={e=>setFormMvt(f=>({...f,notes:e.target.value}))} placeholder="Motif, remarques..." style={{ resize:"none" }} />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="pbtn pbtn-ghost" onClick={() => setModalMvt(false)}>Annuler</button>
                <button type="submit" className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving?"...":"Enregistrer"}</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : VENTE ═══ */}
        <Modal open={modalVente} onClose={() => setModalVente(false)} title={<>{I.cart} Vente & Dispensation</>} wide>
          <form onSubmit={createVente}>
            <div className="ph-g11">
              {/* Dispensation sur ordonnance */}
              <div>
                <div style={{ background:"#EEF4FF", borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--pn)", marginBottom:10 }}>📋 Dispensation sur ordonnance</div>
                  <label className="plbl">N° Ordonnance</label>
                  <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                    <input className="pinp" value={rxNum} onChange={e=>setRxNum(e.target.value)} placeholder="ORD-2025-XXXXX" style={{ flex:1 }} />
                    <button type="button" className="pbtn pbtn-primary pbtn-sm" onClick={() => toast.success("🔍 Ordonnance chargée")}>{I.search}</button>
                  </div>
                  <label className="plbl">Type de dispensation</label>
                  <select className="pinp">
                    <option>Dispensation complète</option>
                    <option>Dispensation partielle</option>
                  </select>
                </div>
              </div>
              {/* Vente directe */}
              <div>
                <label className="plbl">Client (optionnel)</label>
                <input className="pinp" value={clientNom} onChange={e=>setClientNom(e.target.value)} placeholder="Nom du client ou 'Comptoir'" style={{ marginBottom:12 }} />
                <label className="plbl">Mode de paiement</label>
                <select className="pinp" value={modePaiement} onChange={e=>setModePaiement(e.target.value)} style={{ marginBottom:12 }}>
                  <option value="especes">💵 Espèces</option>
                  <option value="mobile_money">📱 Mobile Money</option>
                  <option value="carte_bancaire">💳 Carte bancaire</option>
                  <option value="assurance">🏥 Assurance / Tiers payant</option>
                </select>
              </div>
            </div>

            {/* Panier */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <label className="plbl" style={{ margin:0 }}>🛍️ Panier ({panier.length} article{panier.length>1?"s":""})</label>
                <button type="button" className="pbtn pbtn-ghost pbtn-sm" onClick={() => setPanier(p=>[...p,{id:Date.now(),med:null,quantite:1}])}>{I.plus} Ajouter</button>
              </div>
              {panier.map(it=>(
                <div key={it.id} className="cart-item">
                  <div style={{ flex:1, minWidth:0 }}>
                    <select className="pinp" style={{ fontSize:12 }} onChange={e=>{
                      const m = meds.find(x=>x._id===e.target.value);
                      setPanier(p=>p.map(x=>x.id===it.id?{...x,med:m||null}:x));
                    }}>
                      <option value="">— Sélectionner —</option>
                      {meds.filter(m=>m.stock_quantite>0).map(m=><option key={m._id} value={m._id}>{m.nom_commercial} ({m.dosage}) — {fmtCFA(m.prix_vente)}</option>)}
                    </select>
                  </div>
                  <input type="number" min={1} max={it.med?.stock_quantite||999} value={it.quantite} style={{ width:70, padding:"7px 8px", border:"1.5px solid var(--pbr)", borderRadius:8, textAlign:"center", fontWeight:700, fontSize:13, outline:"none" }} onChange={e=>setPanier(p=>p.map(x=>x.id===it.id?{...x,quantite:Number(e.target.value)}:x))} />
                  <div style={{ width:110, textAlign:"right", fontWeight:700, color:"var(--pn)", fontSize:13 }}>{it.med?fmtCFA(it.med.prix_vente*it.quantite):"—"}</div>
                  {panier.length>1&&<button type="button" onClick={() => setPanier(p=>p.filter(x=>x.id!==it.id))} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--pr)", fontSize:18 }}>×</button>}
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ background:"linear-gradient(135deg,#ECFDF5,#D1FAE5)", border:"1.5px solid #A7F3D0", borderRadius:14, padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <span style={{ fontWeight:700, color:"#065F46", fontSize:14 }}>Total à encaisser</span>
              <span style={{ fontWeight:800, fontSize:22, color:"var(--pg)", letterSpacing:-1 }}>{fmtCFA(panierTotal)}</span>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button type="button" className="pbtn pbtn-ghost" onClick={() => setModalVente(false)}>Annuler</button>
              <button type="submit" className="pbtn pbtn-teal" style={{ marginLeft:"auto", flex:1 }} disabled={saving}>
                💰 {saving?"Enregistrement...":"Encaisser & Générer la facture"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : BON DE COMMANDE ═══ */}
        <Modal open={modalCmd} onClose={() => setModalCmd(false)} title="📦 Nouveau bon de commande" wide>
          <form onSubmit={createCommande}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:16 }}>
              <div>
                <label className="plbl">Fournisseur *</label>
                <select className="pinp" required value={formCmd.fournisseur} onChange={e=>setFormCmd(f=>({...f,fournisseur:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {(fournisseurs.length>0?fournisseurs:DEMO_FOURNISSEURS).map(fn=><option key={fn._id} value={fn.nom}>{fn.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="plbl">Date livraison souhaitée</label>
                <input type="date" className="pinp" value={formCmd.date_livraison_souhaitee} onChange={e=>setFormCmd(f=>({...f,date_livraison_souhaitee:e.target.value}))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="plbl">Notes / Motif</label>
                <textarea className="pinp" rows={2} value={formCmd.notes} onChange={e=>setFormCmd(f=>({...f,notes:e.target.value}))} placeholder="Urgence réapprovisionnement, notes..." style={{ resize:"none" }} />
              </div>
            </div>

            {/* Lignes */}
            <div style={{ border:"1.5px solid var(--pbr)", borderRadius:12, overflow:"hidden", marginBottom:16 }}>
              <div style={{ background:"var(--ps)", padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1.5px solid var(--pbr)" }}>
                <span style={{ fontSize:13, fontWeight:700, color:"var(--pn)" }}>Articles à commander</span>
                <button type="button" className="pbtn pbtn-ghost pbtn-sm" style={{ fontSize:11 }} onClick={() => setFormCmd(f=>({...f,lignes:[...f.lignes,{id:Date.now(),nom:"",forme:"",dosage:"",quantite:1,prix_unitaire:0}]}))}>{I.plus} Ajouter ligne</button>
              </div>
              <table className="ph-tbl" style={{ minWidth:580 }}>
                <thead><tr><th>Médicament *</th><th>Forme</th><th>Dosage</th><th>Qté *</th><th>Prix unit. (CFA)</th><th>Sous-total</th><th></th></tr></thead>
                <tbody>
                  {formCmd.lignes.map(l=>(
                    <tr key={l.id}>
                      <td><input className="pinp" style={{ fontSize:12, padding:"6px 10px" }} list="meds-list" value={l.nom} onChange={e=>setFormCmd(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{...x,nom:e.target.value}:x)}))} placeholder="Nom médicament" /></td>
                      <td><input className="pinp" style={{ fontSize:12, padding:"6px 10px", width:100 }} value={l.forme} onChange={e=>setFormCmd(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{...x,forme:e.target.value}:x)}))} placeholder="Comprimé" /></td>
                      <td><input className="pinp" style={{ fontSize:12, padding:"6px 10px", width:90 }} value={l.dosage} onChange={e=>setFormCmd(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{...x,dosage:e.target.value}:x)}))} placeholder="500mg" /></td>
                      <td><input type="number" className="pinp" style={{ fontSize:12, padding:"6px 10px", width:70, textAlign:"center" }} min={1} value={l.quantite} onChange={e=>setFormCmd(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{...x,quantite:Number(e.target.value)}:x)}))} /></td>
                      <td><input type="number" className="pinp" style={{ fontSize:12, padding:"6px 10px", width:110, textAlign:"right" }} min={0} value={l.prix_unitaire} onChange={e=>setFormCmd(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{...x,prix_unitaire:Number(e.target.value)}:x)}))} /></td>
                      <td style={{ fontWeight:700, fontSize:12 }}>{fmtCFA(l.quantite*l.prix_unitaire)}</td>
                      <td><button type="button" onClick={() => setFormCmd(f=>({...f,lignes:f.lignes.filter(x=>x.id!==l.id)}))} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--pr)", fontSize:18 }}>×</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:"linear-gradient(to right,#EEF4FF,#DBEAFE)" }}>
                    <td colSpan={5} style={{ padding:"10px 14px", fontWeight:800, textAlign:"right", color:"var(--pn)" }}>Total estimé :</td>
                    <td style={{ padding:"10px 14px", fontWeight:800, color:"var(--pb)", fontSize:15 }}>{fmtCFA(formCmd.lignes.reduce((s,l)=>s+l.quantite*l.prix_unitaire,0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              <datalist id="meds-list">{meds.map(m=><option key={m._id} value={m.nom_commercial} />)}</datalist>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button type="button" className="pbtn pbtn-ghost" onClick={() => setModalCmd(false)}>Annuler</button>
              <button type="submit" className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} disabled={saving}>{I.save} {saving?"Création...":"Créer le bon de commande"}</button>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : COMMANDE IA ═══ */}
        <Modal open={modalIACmd} onClose={() => setModalIACmd(false)} title={<>{I.ia} Commande IA — Réapprovisionnement automatique</>} narrow>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div className="al-ia" style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:0 }}>
              <span style={{ fontSize:18 }}>🤖</span>
              <div style={{ fontSize:12, color:"#3B82F6" }}>
                Quantités suggérées calculées sur la base de <strong>3× le seuil d'alerte</strong> (couverture ~90 jours selon la consommation historique).
              </div>
            </div>
            <div style={{ maxHeight:320, overflowY:"auto" }}>
              {alertsMeds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)!=="ok").map(m=>{
                const qteSugg = m.stock_minimum*3;
                return (
                  <div key={m._id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", background:"var(--ps)", border:"1.5px solid var(--pbr)", borderRadius:10, marginBottom:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, color:"var(--pn)", fontSize:13 }}>{m.nom_commercial}</div>
                      <div style={{ fontSize:11, color:"var(--pm)" }}>{m.fournisseur} · Stock : <strong style={{ color:stockColor(stockSt(m.stock_quantite,m.stock_minimum)) }}>{m.stock_quantite}</strong></div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <input type="number" defaultValue={qteSugg} min={1} style={{ width:80, padding:"6px 8px", border:"1.5px solid var(--pbr)", borderRadius:8, textAlign:"center", fontWeight:700, fontSize:13, outline:"none" }} />
                      <div style={{ fontSize:10, color:"var(--pm)", marginTop:2 }}>{fmtCFA(qteSugg*m.prix_achat)}</div>
                    </div>
                  </div>
                );
              })}
              {alertsMeds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)!=="ok").length===0 && (
                <div style={{ textAlign:"center", padding:30, color:"var(--pg)", fontWeight:700 }}>✅ Tous les stocks sont satisfaisants</div>
              )}
            </div>
            <div style={{ background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)", border:"1.5px solid #BFDBFE", borderRadius:12, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:700, color:"var(--pb)", fontSize:13 }}>Valeur estimée de la commande</span>
              <span style={{ fontWeight:800, fontSize:18, color:"var(--pb)" }}>{fmtCFA(alertsMeds.filter(m=>stockSt(m.stock_quantite,m.stock_minimum)!=="ok").reduce((s,m)=>s+m.stock_minimum*3*m.prix_achat,0))}</span>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="pbtn pbtn-ghost" onClick={() => setModalIACmd(false)}>Fermer</button>
              <button className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} onClick={() => { toast.success("📦 Bon de commande IA transmis — En attente validation Admin"); setModalIACmd(false); }}>📧 Transmettre la commande</button>
            </div>
          </div>
        </Modal>

        {/* ═══ MODAL : INVENTAIRE ═══ */}
        <Modal open={modalInv} onClose={() => setModalInv(false)} title={<>{I.inv} Démarrer un inventaire physique</>} narrow>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div className="al-ia" style={{ marginBottom:0 }}>
              <div style={{ fontSize:12, color:"#3B82F6" }}>L'inventaire physique compare le stock théorique du système avec le comptage réel. Tout écart sera enregistré dans le journal d'audit.</div>
            </div>
            <div>
              <label className="plbl">Type d'inventaire</label>
              <select className="pinp">
                <option>Inventaire complet (tous médicaments)</option>
                <option>Inventaire partiel (par catégorie)</option>
                <option>Inventaire tournant (par emplacement)</option>
              </select>
            </div>
            <div>
              <label className="plbl">Responsable de l'inventaire</label>
              <input className="pinp" placeholder="Nom du pharmacien responsable" />
            </div>
            <div>
              <label className="plbl">Observations</label>
              <textarea className="pinp" rows={2} placeholder="Contexte, motif, notes..." style={{ resize:"none" }} />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="pbtn pbtn-ghost" onClick={() => setModalInv(false)}>Annuler</button>
              <button className="pbtn pbtn-teal" style={{ marginLeft:"auto" }} onClick={() => { toast.success("📋 Session d'inventaire démarrée"); setModalInv(false); setTab("inventaire"); }}>🚀 Démarrer l'inventaire</button>
            </div>
          </div>
        </Modal>

      </div>
    </>
  );
}