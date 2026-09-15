const router = require('express').Router();
const boC    = require('../controllers/blocoperatoireController');
const { protect, authorize } = require('../middleware/auth');

const BLOC_ROLES    = ['superadmin', 'adminclinique', 'medecin', 'infirmier'];
// SPEC-14 (correction du 12 sept. 2026, audit indépendant) — analysé :
// l'infirmier est exclu de BLOC_MANAGE (planification, compte-rendu
// opératoire, entrée/sortie de salle). Décision documentée : CONSERVÉ tel
// quel. Contrairement à hospitalization.routes.js (CLIN-08, où le même
// groupe large gère tout le cycle de vie du séjour sans distinction), ce
// module sépare déjà délibérément lecture (BLOC_ROLES, infirmier inclus)
// et actes de décision opératoire (BLOC_MANAGE, réservé à
// medecin/adminclinique/superadmin) — cohérent avec un contexte
// chirurgical à risque plus élevé. Aucune preuve dans ce projet qu'un rôle
// infirmier de bloc spécialisé (IBODE) distinct soit modélisé ici ; ouvrir
// ces permissions élargirait l'accès sans justification métier
// documentée, contrairement à l'instruction reçue.
const BLOC_MANAGE   = ['superadmin', 'adminclinique', 'medecin'];

// Salles & planning
router.get('/salles',          protect, authorize(...BLOC_ROLES),  boC.getSalles);
router.get('/planning',        protect, authorize(...BLOC_ROLES),  boC.getPlanning);
router.post('/planning',       protect, authorize(...BLOC_MANAGE), boC.scheduleIntervention);
router.put('/planning/:id',    protect, authorize(...BLOC_MANAGE), boC.updateIntervention);

// Alias racine (utilisé par la page Blocoperatoire.jsx)
router.get('/',                protect, authorize(...BLOC_ROLES),  boC.getPlanning);
router.post('/',               protect, authorize(...BLOC_MANAGE), boC.createIntervention);
router.put('/:id',             protect, authorize(...BLOC_MANAGE), boC.updateIntervention);

// Sous-ressources
router.get('/:id/facture',     protect, authorize(...BLOC_ROLES),  boC.getFacture);
router.post('/:id/cr',         protect, authorize(...BLOC_MANAGE), boC.saveCR);
router.post('/:id/reveil',     protect, authorize(...BLOC_MANAGE), boC.saveReveil);
// AUDIT-ANALYTICS-P5 — occupation réelle de salle
router.put('/:id/entree-salle', protect, authorize(...BLOC_MANAGE), boC.entreeSalle);
router.put('/:id/sortie-salle', protect, authorize(...BLOC_MANAGE), boC.sortieSalle);

// Matériel / consommables (correction Sous-phase Bloc Opératoire)
router.get('/materiels',                     protect, authorize(...BLOC_ROLES),  boC.getMateriels);
router.post('/:id/materiel',                 protect, authorize(...BLOC_MANAGE), boC.addConsommation);
router.get('/statistiques/consommation',     protect, authorize(...BLOC_ROLES),  boC.getConsommationStats);

module.exports = router;
