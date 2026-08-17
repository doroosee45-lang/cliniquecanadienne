// Extrait de Laboratory.jsx (audit2-9 / P6-1) — logique et données de
// référence partagées entre la page réelle et le test backend
// auditP6-1CriticalNotificationE2E.test.js, qui importe ce même fichier
// pour prouver que ce que le frontend calcule réellement (pas un payload
// reconstitué à la main dans le test) déclenche bien la notification de
// résultat critique côté serveur.

export const REF_VALUES = {
  nfs:            { label: "NFS", unite: "", ref: "Voir détails" },
  groupe:         { label: "Groupe sanguin", unite: "", ref: "A/B/AB/O Rh±" },
  hb:             { label: "Hémoglobine", unite: "g/dL", ref: "12.0 – 17.5" },
  vs:             { label: "VS", unite: "mm/h", ref: "H:<10 F:<15" },
  glycemie:       { label: "Glycémie", unite: "g/L", ref: "0.70 – 1.10" },
  creatinine:     { label: "Créatinine", unite: "mg/L", ref: "7 – 13" },
  uree:           { label: "Urée", unite: "g/L", ref: "0.15 – 0.45" },
  cholesterol:    { label: "Cholestérol", unite: "g/L", ref: "< 2.0" },
  triglycerides:  { label: "Triglycérides", unite: "g/L", ref: "0.40 – 1.50" },
  transaminases:  { label: "ASAT/ALAT", unite: "UI/L", ref: "< 40" },
  goutte_epaisse: { label: "Goutte épaisse", unite: "", ref: "Négatif" },
  test_palu:      { label: "Test paludisme", unite: "", ref: "Négatif" },
  exam_selles:    { label: "Examen selles", unite: "", ref: "Normal" },
  vih:            { label: "VIH", unite: "", ref: "Non réactif" },
  hep_b:          { label: "AgHBs", unite: "", ref: "Non réactif" },
  hep_c:          { label: "Hépatite C", unite: "", ref: "Non réactif" },
  syphilis:       { label: "Syphilis", unite: "", ref: "Non réactif" },
  ecbu:           { label: "ECBU", unite: "UFC/mL", ref: "< 100 000" },
  bandelette:     { label: "Bandelette", unite: "", ref: "Normal" },
};

// est_critique/valeurs_critiques dérivés des statut_res déjà saisis à
// l'étape "Résultats" — même source que hasCritique utilisé pour
// l'affichage ailleurs dans Laboratory.jsx, pour qu'il n'existe jamais
// deux versions divergentes de "ce résultat est-il critique ?".
export function deriveCriticalPayload(resultats, refValues = REF_VALUES) {
  const critiques = (resultats || []).filter(r => r.statut_res === "critique");
  const est_critique = critiques.length > 0;
  const valeurs_critiques = critiques
    .map(r => `${refValues[r.exam_id]?.label || r.exam_id} : ${r.valeur}${refValues[r.exam_id]?.unite ? ' ' + refValues[r.exam_id].unite : ''} (normale : ${r.ref || '—'})`)
    .join(' ; ');
  return { est_critique, valeurs_critiques };
}

// Interop CommonJS : permet à un test backend (node:test, require())
// d'importer directement cette même fonction plutôt que d'en réécrire une
// copie qui pourrait diverger silencieusement de celle réellement utilisée
// par la page. `module` n'existe pas dans un bundle navigateur (Vite) —
// le typeof évite un ReferenceError, la branche est simplement ignorée.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REF_VALUES, deriveCriticalPayload };
}
