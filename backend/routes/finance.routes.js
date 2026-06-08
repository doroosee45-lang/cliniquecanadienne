// routes/finance.routes.js
const router  = require('express').Router();
const finC    = require('../controllers/finance.controller');
const { protect, authorize } = require('../middleware/auth');
const Invoice = require('../models/Invoice');

const CAN_ACCESS = ['superadmin','adminclinique','comptable'];

router.get('/stats',        protect, authorize(...CAN_ACCESS), finC.stats);

// Aliases attendus par le frontend
router.get('/kpis',         protect, authorize(...CAN_ACCESS), finC.stats);
router.get('/factures',     protect, authorize(...CAN_ACCESS), finC.getAll);
router.post('/factures',    protect, authorize(...CAN_ACCESS), finC.create);

// Enregistrer un revenu direct (crée une facture payée)
router.post('/revenus', protect, authorize(...CAN_ACCESS), async (req, res, next) => {
  try {
    const { date, service, patient, reference, montant, mode, statut, notes } = req.body;
    const montantNum = Number(montant);
    if (!montantNum || montantNum <= 0) return res.status(400).json({ success: false, message: 'Montant invalide.' });

    const mongoose = require('mongoose');
    const body = {
      created_by:    req.user._id,
      date_facture:  date ? new Date(date) : new Date(),
      service_label: service || 'Consultation',
      statut:        'payee',
      montant_direct: montantNum,
      montant_ttc:   montantNum,
      montant_paye:  montantNum,
      montant_restant: 0,
      notes:         notes || '',
      lignes: [{ libelle: service || 'Prestation médicale', categorie: (['consultation','hospitalisation','laboratoire','imagerie','pharmacie'].includes((service||'').toLowerCase()) ? (service||'').toLowerCase() : 'autre'), prix_unitaire: montantNum, quantite: 1, montant: montantNum }],
      paiements: [{ montant: montantNum, mode: mode || 'especes', reference: reference || undefined, date: date ? new Date(date) : new Date(), enregistre_par: req.user._id }],
    };

    // Patient : ObjectId valide ou nom libre
    if (patient && mongoose.Types.ObjectId.isValid(String(patient))) {
      body.patient = patient;
    } else if (patient) {
      body.patient_nom = String(patient);
    }

    const invoice = await Invoice.create(body);
    const revenu = {
      _id:       invoice._id,
      reference: reference || invoice.numero_facture || `FAC-${invoice._id.toString().slice(-6)}`,
      date:      invoice.date_facture,
      patient:   invoice.patient_nom || patient || '—',
      service:   service || '—',
      montant:   montantNum,
      mode:      mode || 'especes',
      statut:    'paye',
    };
    res.status(201).json({ success: true, revenu });
  } catch (err) { next(err); }
});

// Revenus = factures payées ou partiellement payées
router.get('/revenus', protect, authorize(...CAN_ACCESS), async (req, res, next) => {
  try {
    const { limit = 100 } = req.query;
    const items = await Invoice.find({ statut: { $in: ['payee', 'partiellement_payee'] } })
      .populate('patient', 'nom prenom').sort('-date_facture').limit(Number(limit));
    const revenus = items.map(inv => {
      const i = inv.toObject ? inv.toObject() : inv;
      const pat = i.patient && typeof i.patient === 'object' ? i.patient : null;
      return {
        _id:       i._id,
        reference: i.numero_facture || i.numero || '—',
        date:      i.date_facture   || i.createdAt,
        patient:   i.patient_nom    || (pat ? `${pat.prenom || ''} ${pat.nom || ''}`.trim() : (typeof i.patient === 'string' ? i.patient : '—')),
        service:   i.service_label  || i.service || '—',
        montant:   Number(i.montant_direct || i.montant_ttc || i.montant || 0),
        mode:      (i.paiements && i.paiements[0]?.mode) || 'especes',
        statut:    i.statut === 'payee' ? 'paye' : 'partiellement_paye',
      };
    });
    res.json({ success: true, revenus });
  } catch (err) { next(err); }
});

// Paiements = historique de paiements des factures
router.get('/paiements', protect, authorize(...CAN_ACCESS), async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    // Toutes les factures payées OU ayant des paiements enregistrés
    const invoices = await Invoice.find({
      $or: [
        { 'paiements.0': { $exists: true } },
        { statut: { $in: ['payee', 'partiellement_payee'] } },
      ],
    })
      .populate('patient', 'nom prenom')
      .populate('paiements.enregistre_par', 'nom prenom')
      .sort('-date_facture')
      .limit(Number(limit));

    const paiements = invoices.flatMap(inv => {
      const patObj = inv.patient && typeof inv.patient === 'object' ? inv.patient : null;
      const patNom = inv.patient_nom || (patObj ? `${patObj.prenom} ${patObj.nom}` : '—');

      // Paiements explicites enregistrés
      if (inv.paiements && inv.paiements.length > 0) {
        return inv.paiements.map((p, i) => {
          const userObj = p.enregistre_par && typeof p.enregistre_par === 'object' ? p.enregistre_par : null;
          const d = p.date ? new Date(p.date) : new Date(inv.date_facture || inv.createdAt);
          return {
            _id:       `${inv._id}-p${i}`,
            reference: p.reference || inv.numero_facture || `PAY-${i + 1}`,
            date:      d,
            heure:     d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            patient:   patNom,
            facture:   inv.numero_facture || '—',
            montant:   p.montant,
            mode:      p.mode || 'especes',
            caissier:  userObj ? `${userObj.prenom} ${userObj.nom}` : 'Caisse',
          };
        });
      }

      // Facture payée sans paiement explicite → enregistrement synthétique
      const d = new Date(inv.date_facture || inv.createdAt);
      return [{
        _id:       `${inv._id}-synth`,
        reference: inv.numero_facture || '—',
        date:      d,
        heure:     d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        patient:   patNom,
        facture:   inv.numero_facture || '—',
        montant:   inv.montant_paye || inv.montant_ttc || inv.montant_direct || 0,
        mode:      'especes',
        caissier:  'Caisse',
      }];
    });

    res.json({ success: true, paiements });
  } catch (err) { next(err); }
});

// Dépenses, salaires, assurances — stubs (pas de modèle dédié encore)
router.get('/depenses',   protect, authorize(...CAN_ACCESS), (req, res) => res.json({ success: true, depenses: [] }));
router.get('/salaires',   protect, authorize(...CAN_ACCESS), (req, res) => res.json({ success: true, salaires: [] }));
router.get('/assurances', protect,                           (req, res) => res.json({ success: true, assurances: [] }));
router.post('/caisse',    protect, authorize(...CAN_ACCESS), (req, res) => res.json({ success: true, message: 'Enregistré.' }));

router.get('/',             protect, authorize(...CAN_ACCESS), finC.getAll);
router.post('/',            protect, authorize(...CAN_ACCESS), finC.create);
router.get('/:id',          protect,                           finC.getOne);
router.post('/:id/paiement',protect, authorize(...CAN_ACCESS), finC.addPayment);

module.exports = router;