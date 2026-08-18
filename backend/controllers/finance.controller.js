const Invoice = require('../models/Invoice');
const Depense = require('../models/Depense');
const Salaire = require('../models/Salaire');
const Staff = require('../models/Staff');
const { logAction, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');

// Mapper Invoice (modèle) → objet frontend
function normalizeInvoice(inv) {
  const pat = inv.patient && typeof inv.patient === 'object' ? inv.patient : null;
  const statutMap = { emise:'non_paye', payee:'paye', partiellement_payee:'partiellement_paye', annulee:'annule', contentieux:'non_paye', brouillon:'non_paye' };
  return {
    ...inv,
    numero:   inv.numero_facture  || inv.numero   || '—',
    date:     inv.date_facture    || inv.date      || inv.createdAt,
    echeance: inv.date_echeance   || inv.echeance  || null,
    patient:  inv.patient_nom     || (pat ? `${pat.prenom} ${pat.nom}` : (typeof inv.patient === 'string' ? inv.patient : '—')),
    service:  inv.service_label   || inv.service   || '—',
    montant:  inv.montant_direct  || inv.montant_ttc || inv.montant || 0,
    statut:   statutMap[inv.statut] || inv.statut  || 'non_paye',
  };
}

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, statut, patient } = req.query;
    const filter = {};
    const statutRevMap = { non_paye:'emise', paye:'payee', partiellement_paye:'partiellement_payee', annule:'annulee' };
    if (statut) filter.statut = statutRevMap[statut] || statut;
    if (patient) filter.$or = [{ patient }, { patient_nom: { $regex: patient, $options: 'i' } }];
    const total = await Invoice.countDocuments(filter);
    const raw = await paginate(
      Invoice.find(filter)
        .populate('patient', 'nom prenom numero_dossier')
        .populate('created_by', 'nom prenom')
        .sort('-date_facture'),
      page, limit
    );
    const invoices = raw.map(i => normalizeInvoice(i.toObject ? i.toObject() : i));
    res.json({ success: true, total, invoices });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('patient').populate('created_by', 'nom prenom');
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable.' });
    res.json({ success: true, invoice });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const body = { ...req.body, created_by: req.user._id };

    // Mapper statuts frontend → modèle (enum valide)
    const VALID_STATUTS = ['brouillon','emise','partiellement_payee','payee','annulee','contentieux'];
    const statutMap = { non_paye:'emise', paye:'payee', partiellement_paye:'partiellement_payee', annule:'annulee', annulee:'annulee', payee:'payee', emise:'emise' };
    if (body.statut) body.statut = statutMap[body.statut] || (VALID_STATUTS.includes(body.statut) ? body.statut : 'emise');

    // patient_nom passé directement (formulaire avec sélecteur)
    if (body.patient_nom && !body.patient) {
      body.service_label = body.service || body.service_label || '';
    }
    // patient : texte libre → patient_nom, ObjectId valide → garder
    if (body.patient) {
      if (!mongoose.Types.ObjectId.isValid(String(body.patient))) {
        body.patient_nom   = String(body.patient);
        body.service_label = body.service || body.service_label || '';
        delete body.patient;
      }
      // sinon ObjectId valide — on garde tel quel
    }
    delete body.service;

    // Si montant direct fourni (sans lignes détaillées), créer une ligne synthétique
    const montantDirect = Number(body.montant) || 0;
    if (montantDirect > 0 && (!body.lignes || body.lignes.length === 0)) {
      body.lignes = [{ libelle: body.service_label || 'Prestation médicale', categorie: 'autre', prix_unitaire: montantDirect, quantite: 1, montant: montantDirect }];
      body.montant_direct = montantDirect;
    }
    delete body.montant;

    // Echeance
    if (body.echeance) { body.date_echeance = body.echeance; delete body.echeance; }

    body.montant_ht      = body.lignes?.reduce((s, l) => s + (Number(l.prix_unitaire) * (l.quantite || 1)), 0) || montantDirect;
    body.montant_ttc     = body.montant_ht * (1 + (body.tva || 0) / 100);

    // montant_paye / montant_restant / statut sont recalculés automatiquement
    // par le hook pre('save') du modèle à partir de `paiements[]` — les fixer
    // ici directement (comme avant) produit un document désynchronisé dès que
    // ce tableau est vide : le hook écrase montant_paye à 0 en le recalculant
    // depuis `paiements`, mais ne touche au statut que si ce recalcul déclenche
    // ses propres conditions — résultat : statut='payee' avec montant_paye=0
    // et montant_restant=montant_ttc. On enregistre donc un vrai paiement.
    if (body.statut === 'payee' && !(body.paiements?.length)) {
      body.paiements = [{ montant: body.montant_ttc, mode: 'especes', enregistre_par: req.user._id }];
    }

    const days = body.date_echeance ? Math.round((new Date(body.date_echeance) - Date.now()) / 86400000) : 30;
    body.score_risque = days < 7 ? 80 : days < 14 ? 50 : 20;

    const invoice = await Invoice.create(body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'finance', entite_id: invoice._id, ip: req.ip, message: `Facture ${invoice.numero_facture}` });
    emitActivity({ module: 'finance', action: 'Nouvelle facture', detail: `${invoice.numero_facture} — ${invoice.montant_ttc?.toLocaleString('fr-FR')} CFA`, icon: '💰', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();

    const populated = await Invoice.findById(invoice._id)
      .populate('patient', 'nom prenom numero_dossier')
      .lean();
    const facture = normalizeInvoice(populated);
    res.status(201).json({ success: true, invoice: facture, facture });
  } catch (err) { next(err); }
};

exports.addPayment = async (req, res, next) => {
  try {
    const { montant, mode, reference } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable.' });
    if (!(Number(montant) > 0))
      return res.status(400).json({ success: false, message: 'Le montant du paiement doit être positif.' });
    if (montant > invoice.montant_restant)
      return res.status(400).json({ success: false, message: 'Montant supérieur au solde restant.' });

    const avant = invoice.toObject();
    invoice.paiements.push({ montant, mode, reference, enregistre_par: req.user._id });
    await invoice.save();
    await logAction({ utilisateur: req.user._id, action: 'PAYMENT', module: 'finance', entite_id: invoice._id, ip: req.ip, message: `Paiement ${montant} (${mode})`, avant, apres: invoice });
    emitActivity({ module: 'finance', action: 'Paiement reçu', detail: `${Number(montant).toLocaleString('fr-FR')} CFA — ${mode}`, icon: '✅', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.json({ success: true, invoice });
  } catch (err) { next(err); }
};

// AUDIT-11 (audit complet post-Phase 10) — PUT /finance/:id (changement de
// statut de facture) n'avait jamais de route réelle : Finance.jsx appelait
// une URL inexistante, l'erreur était avalée (catch vide) et l'interface
// affichait quand même "Facture marquée comme payée" sans que rien ne soit
// écrit en base.
//
// 'payee' est traité à part : le hook pre('save') du modèle dérive
// statut/montant_restant depuis paiements[] (cf. commentaire dans create()
// plus haut) — fixer statut:'payee' sans mouvement de paiement laisserait
// montant_paye/montant_restant désynchronisés de l'affichage. On enregistre
// donc le solde restant comme un vrai paiement plutôt que de contourner
// cette logique. 'partiellement_payee' n'est acceptable ici que si un
// paiement existe déjà (montant réel connu) : ce endpoint générique n'a pas
// de champ montant, contrairement à /:id/paiement, donc pas de base pour
// inventer un montant partiel.
const VALID_STATUTS = ['brouillon','emise','partiellement_payee','payee','annulee','contentieux'];

exports.updateStatut = async (req, res, next) => {
  try {
    const { statut } = req.body;
    if (!VALID_STATUTS.includes(statut)) {
      return res.status(400).json({ success: false, message: `Statut invalide. Valeurs acceptées : ${VALID_STATUTS.join(', ')}.` });
    }
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable.' });
    const avant = invoice.toObject();

    if (statut === 'partiellement_payee' && invoice.montant_paye === 0) {
      return res.status(400).json({ success: false, message: "Aucun paiement enregistré — utilisez « Enregistrer un paiement » pour indiquer le montant versé." });
    }
    if (statut === 'payee' && invoice.montant_restant > 0) {
      invoice.paiements.push({ montant: invoice.montant_restant, mode: 'especes', enregistre_par: req.user._id });
    } else {
      invoice.statut = statut;
    }
    await invoice.save();

    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'finance', entite_id: invoice._id, ip: req.ip, message: `Statut facture ${invoice.numero_facture} : ${avant.statut} → ${invoice.statut}`, avant, apres: invoice.toObject() });
    emitDashboardUpdate();
    res.json({ success: true, invoice: normalizeInvoice(invoice.toObject()) });
  } catch (err) { next(err); }
};

// AUDIT-11 — POST /finance/caisse était un stub inline dans les routes qui
// renvoyait { success:true } sans jamais écrire en base (aucun modèle
// importé, aucune persistance). Une entrée de caisse est une recette
// directe (même nature que POST /finance/revenus, déjà réel) ; une sortie
// est une dépense (déléguée aux mêmes règles que createDepense ci-dessus —
// description/montant positif requis).
exports.caisse = async (req, res, next) => {
  try {
    const { type, montant, libelle, mode } = req.body;
    const montantNum = Number(montant);
    if (!montantNum || montantNum <= 0) return res.status(400).json({ success: false, message: 'Montant invalide.' });

    if (type === 'sortie') {
      const depense = await Depense.create({
        categorie: 'Autre', description: libelle || 'Sortie de caisse', montant: montantNum, statut: 'paye',
        enregistre_par: req.user._id,
      });
      await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'finance', entite_id: depense._id, ip: req.ip, message: `Sortie de caisse : ${libelle || 'sans libellé'} — ${montantNum} CFA` });
      emitDashboardUpdate();
      return res.status(201).json({ success: true, type: 'sortie', depense });
    }

    const invoice = await Invoice.create({
      created_by: req.user._id, date_facture: new Date(), service_label: libelle || 'Entrée de caisse',
      statut: 'payee', montant_direct: montantNum, montant_ttc: montantNum,
      lignes: [{ libelle: libelle || 'Entrée de caisse', categorie: 'autre', prix_unitaire: montantNum, quantite: 1, montant: montantNum }],
      paiements: [{ montant: montantNum, mode: mode || 'especes', date: new Date(), enregistre_par: req.user._id }],
    });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'finance', entite_id: invoice._id, ip: req.ip, message: `Entrée de caisse : ${libelle || 'sans libellé'} — ${montantNum} CFA` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, type: 'entree', invoice });
  } catch (err) { next(err); }
};

exports.stats = async (req, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, payees, impayees, partiel, caMonth] = await Promise.all([
      Invoice.countDocuments(),
      Invoice.countDocuments({ statut: 'payee' }),
      Invoice.countDocuments({ statut: 'emise' }),
      Invoice.countDocuments({ statut: 'partiellement_payee' }),
      Invoice.aggregate([
        { $match: { date_facture: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$montant_paye' } } },
      ]),
    ]);

    res.json({ success: true, stats: {
      total, payees, impayees, partiellement_payees: partiel,
      ca_mois: caMonth[0]?.total || 0,
      taux_recouvrement: total > 0 ? Math.round((payees / total) * 100) : 0,
    }});
  } catch (err) { next(err); }
};

// ── DÉPENSES ─────────────────────────────────────────────────────────────
exports.getDepenses = async (req, res, next) => {
  try {
    const { limit = 100 } = req.query;
    const depenses = await Depense.find().sort('-date').limit(Number(limit));
    res.json({ success: true, depenses });
  } catch (err) { next(err); }
};

exports.createDepense = async (req, res, next) => {
  try {
    const { date, categorie, description, montant, fournisseur, statut, notes } = req.body;
    if (!description || !(Number(montant) > 0)) {
      return res.status(400).json({ success: false, message: 'Description et montant (positif) requis.' });
    }
    const depense = await Depense.create({
      date: date || undefined, categorie, description, fournisseur, notes,
      montant: Number(montant), statut: statut || 'paye',
      enregistre_par: req.user._id,
    });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'finance', entite_id: depense._id, ip: req.ip, message: `Dépense enregistrée : ${description} — ${montant} CFA` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, depense });
  } catch (err) { next(err); }
};

// ── SALAIRES ─────────────────────────────────────────────────────────────
// Un bulletin par employé actif et par mois — généré à la demande (pas de
// tâche planifiée) : le premier GET du mois crée les bulletins manquants
// pour chaque membre du personnel actif, à partir de Staff.salaire_base.
exports.getSalaires = async (req, res, next) => {
  try {
    const mois = req.query.mois || new Date().toISOString().substring(0, 7);
    const staffActifs = await Staff.find({ statut: 'actif' }).select('prenom nom poste salaire_base');

    const existants = await Salaire.find({ mois });
    const existantsIds = new Set(existants.map(s => String(s.staff)));
    const manquants = staffActifs.filter(s => !existantsIds.has(String(s._id)));
    if (manquants.length) {
      await Salaire.insertMany(
        manquants.map(s => ({ staff: s._id, mois, base: s.salaire_base || 0, net: s.salaire_base || 0 })),
        { ordered: false }
      ).catch(() => {}); // course possible entre deux requêtes simultanées — non bloquant, re-fetch ci-dessous
    }

    const bulletins = await Salaire.find({ mois }).populate('staff', 'prenom nom poste');
    const salaires = bulletins
      .filter(b => b.staff) // employé supprimé depuis
      .map(b => ({
        _id: b._id,
        employe: `${b.staff.prenom || ''} ${b.staff.nom || ''}`.trim(),
        fonction: b.staff.poste,
        base: b.base, primes: b.primes, deductions: b.deductions, net: b.net,
        statut: b.statut, date_paiement: b.date_paiement,
      }));
    res.json({ success: true, salaires });
  } catch (err) { next(err); }
};

exports.payerSalaire = async (req, res, next) => {
  try {
    const salaire = await Salaire.findById(req.params.id);
    if (!salaire) return res.status(404).json({ success: false, message: 'Bulletin introuvable.' });
    if (salaire.statut === 'paye') {
      return res.status(400).json({ success: false, message: 'Ce salaire a déjà été payé.' });
    }
    const avant = salaire.toObject();
    salaire.statut = 'paye';
    salaire.date_paiement = new Date();
    salaire.paye_par = req.user._id;
    await salaire.save();
    await logAction({ utilisateur: req.user._id, action: 'PAYMENT', module: 'finance', entite_id: salaire._id, ip: req.ip, message: `Salaire payé — ${salaire.net} CFA (${salaire.mois})`, avant, apres: salaire });
    emitDashboardUpdate();
    res.json({ success: true, salaire });
  } catch (err) { next(err); }
};

// ── ASSURANCES (option A — reporting simple) ─────────────────────────────
// Agrège la portion assurance des factures existantes (Invoice.montant_
// assurance) par compagnie déclarée sur le dossier patient. Aucun mécanisme
// de confirmation de remboursement par l'assureur n'existe dans le modèle
// actuel : une facture "payee" est considérée comme réglée (remboursement
// assimilé au règlement de la facture), pas comme une confirmation reçue
// de l'assureur — approximation assumée pour cette première passe, à
// affiner (option B : lien réel Patient.assurances ↔ catalogue Insurance,
// suivi de créance par assureur) si le besoin devient réel.
exports.getAssurances = async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ montant_assurance: { $gt: 0 } })
      .populate('patient', 'nom prenom assurances')
      .sort('-date_facture')
      .limit(200);

    const assurances = invoices.map(inv => {
      const pat = inv.patient && typeof inv.patient === 'object' ? inv.patient : null;
      const compagnie = pat?.assurances?.[0]?.compagnie || 'Assureur non renseigné';
      const rembourse = inv.statut === 'payee' ? inv.montant_assurance : 0;
      const en_attente = inv.statut === 'payee' ? 0 : inv.montant_assurance;
      return {
        _id: inv._id,
        compagnie,
        facture: inv.numero_facture,
        patient: pat ? `${pat.prenom || ''} ${pat.nom || ''}`.trim() : (inv.patient_nom || '—'),
        facture_montant: inv.montant_assurance,
        rembourse,
        en_attente,
        date_soumission: inv.date_facture,
        statut: rembourse >= inv.montant_assurance ? 'rembourse' : (rembourse > 0 ? 'partiellement_rembourse' : 'en_attente'),
      };
    });
    res.json({ success: true, assurances });
  } catch (err) { next(err); }
};
