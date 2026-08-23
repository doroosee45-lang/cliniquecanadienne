// AUDIT-M-A3 (Groupe A, Point 3) — ADMIN/STAFF étaient redéclarés à
// l'identique dans 6 fichiers de routes (archive/audit/document/dashboard/
// hr/settings.routes.js), jamais divergents en valeur (juste un espacement
// cosmétique différent entre deux groupes de fichiers) — une simple
// omission au fil des chantiers successifs, pas une divergence délibérée.
// Séparé de middleware/auth.js par choix : la taxonomie des rôles (métier)
// ne doit pas partager un fichier avec la mécanique d'authentification,
// surtout si la liste des rôles évolue un jour indépendamment — cohérent
// avec ROLES.* déjà séparé côté frontend (App.jsx).
const ADMIN = ['superadmin', 'adminclinique'];

// Données de référence (services, salles, assurances, tableau de bord...)
// consultées par de nombreux formulaires métier — ouvert à tout le
// personnel, jamais aux patients.
const STAFF = ['superadmin', 'adminclinique', 'medecin', 'infirmier', 'sage_femme',
               'laborantin', 'radiologue', 'pharmacien', 'comptable', 'receptionniste'];

module.exports = { ADMIN, STAFF };
