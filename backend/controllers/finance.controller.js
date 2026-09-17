const EcritureBilan = require('../models/EcritureBilan');
const Medication = require('../models/Medication');
const Invoice = require('../models/Invoice');
const Depense = require('../models/Depense');
const Salaire = require('../models/Salaire');
const Staff = require('../models/Staff');
const BudgetCible = require('../models/BudgetCible');
const Patient = require('../models/Patient');
// POST5-019 (audit indépendant post-Phase 5, 14 sept. 2026) — getSalaires()
// ci-dessous fait un populate() imbriqué sur Staff.utilisateur (ref:'User'),
// jamais explicitement enregistré dans ce fichier. Mongoose résout un ref
// par son nom de schéma enregistré (mongoose.model('User', ...)), pas par
// un require() direct de ce fichier — quand rien d'autre dans le process
// n'a encore chargé models/User.js (ex. un test qui importe uniquement les
// modèles ci-dessus, en exécution isolée), le populate échoue réellement
// ("Schema hasn't been registered for model 'User'"). En démarrage normal
// du serveur, routes.js charge déjà tous les contrôleurs (donc User.js
// indirectement) avant toute requête, ce qui masquait le problème.
require('../models/User');
const { logAction, paginate, escapeRegex } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');

// Mapper Invoice (modèle) → objet frontend
// AUDIT-RECU-PDF-PARTAGE — patient_id/patient_email ajoutés à côté de
// patient_telephone (déjà existant) : sans ça, le frontend ne peut jamais
// distinguer une facture réellement liée à un dossier Patient (avec email
// connu, envoi serveur possible) d'une facture patient_nom en texte libre
// (aucun envoi réel possible, repli mailto obligatoire).
function normalizeInvoice(inv) {
  const pat = inv.patient && typeof inv.patient === 'object' ? inv.patient : null;
  const statutMap = { emise:'non_paye', payee:'paye', partiellement_payee:'partiellement_paye', annulee:'annule', contentieux:'non_paye', brouillon:'non_paye' };
  return {
    ...inv,
    numero:   inv.numero_facture  || inv.numero   || '—',
    date:     inv.date_facture    || inv.date      || inv.createdAt,
    echeance: inv.date_echeance   || inv.echeance  || null,
    patient:  inv.patient_nom     || (pat ? `${pat.prenom} ${pat.nom}` : (typeof inv.patient === 'string' ? inv.patient : '—')),
    patient_telephone: pat?.telephone || null,
    patient_id:    pat?._id || null,
    patient_email: pat?.email || null,
    service:  inv.service_label   || inv.service   || '—',
    montant:  inv.montant_direct  || inv.montant_ttc || inv.montant || 0,
    statut:   statutMap[inv.statut] || inv.statut  || 'non_paye',
  };
}

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, statut, patient, source_module, source_id } = req.query;
    const filter = {};
    const statutRevMap = { non_paye:'emise', paye:'payee', partiellement_paye:'partiellement_payee', annule:'annulee' };
    if (statut) filter.statut = statutRevMap[statut] || statut;
    if (patient) filter.$or = [{ patient }, { patient_nom: { $regex: escapeRegex(patient), $options: 'i' } }];
    // Correction 5 — permet aux onglets "Facturation" cliniques (laboratoire,
    // imagerie, échographie, urgences, chirurgie, bloc opératoire) de charger
    // la vraie facture liée à un acte précis, au lieu d'un calcul factice.
    if (source_module) filter.source_module = source_module;
    if (source_id)     filter.source_id     = source_id;
    // PERF-001 (audit de performance du 12 sept. 2026) — countDocuments et
    // find indépendants, exécutés en parallèle.
    const [total, raw] = await Promise.all([
      Invoice.countDocuments(filter),
      paginate(
        Invoice.find(filter)
          .populate('patient', 'nom prenom numero_dossier telephone email')
          .populate('created_by', 'nom prenom')
          .sort('-date_facture'),
        page, limit
      ),
    ]);
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
      } else {
        // POST5-008 (audit indépendant post-Phase 5, 14 sept. 2026) — un
        // `patient` au format ObjectId valide était gardé tel quel sans
        // jamais vérifier qu'il référence réellement un Patient existant
        // — contrairement à tous les autres contrôleurs cliniques
        // (laboratoire/radiologie corrigés en POST5-007, consultations/
        // prescriptions/echographie/hospitalization/maternity/chirurgie/
        // pediatrie déjà alignés). Un ObjectId fabriqué/orphelin était
        // accepté tel quel : une transaction financière réelle attachée à
        // un patient inexistant. `patient` reste par ailleurs optionnel
        // ici (texte libre via patient_nom déjà géré ci-dessus) — seul le
        // cas où le client prétend fournir un vrai ObjectId est vérifié.
        const patientDoc = await Patient.findById(body.patient).select('_id').lean();
        if (!patientDoc) {
          return res.status(400).json({ success: false, message: 'Patient introuvable pour l\'identifiant fourni.' });
        }
      }
    }
    delete body.service;

    // FIN-001 (audit métier du 13 sept. 2026, Phase 4) — ce chemin générique
    // (POST /finance/factures, formulaire "Nouvelle facture") ne validait
    // jamais le signe de `montant` ni de `lignes[].prix_unitaire`/`quantite`,
    // contrairement à createRevenu/createDepense plus bas dans ce fichier
    // (qui exigent déjà `montant > 0`). Une ligne condition
    // `montantDirect > 0` empêchait seulement la génération de la ligne
    // synthétique automatique en cas de montant négatif/nul — elle ne
    // rejetait jamais la requête, et `montant_ht` retombait quand même sur
    // `montantDirect` (négatif) faute de `lignes`. Une facture ne peut pas
    // représenter une dette négative sans mécanisme d'avoir dédié.
    if (body.montant !== undefined && body.montant !== null && body.montant !== '' && Number(body.montant) < 0) {
      return res.status(400).json({ success: false, message: 'Le montant de la facture ne peut pas être négatif.' });
    }
    if (Array.isArray(body.lignes) && body.lignes.some(l => Number(l?.prix_unitaire) < 0 || Number(l?.quantite) < 0)) {
      return res.status(400).json({ success: false, message: 'Les lignes de facturation ne peuvent pas avoir de prix unitaire ou de quantité négatifs.' });
    }

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
      .populate('patient', 'nom prenom numero_dossier telephone email')
      .lean();
    const facture = normalizeInvoice(populated);
    res.status(201).json({ success: true, invoice: facture, facture });
  } catch (err) { next(err); }
};

// AUDIT-ARCHIVAGE-B2 — remplace le handler inline de finance.routes.js
// (POST /revenus), qui contournait entièrement ce contrôleur : une vraie
// transaction financière (Invoice payée) créée sans jamais passer par
// logAction, contrairement à create() juste au-dessus. Logique métier
// inchangée, simplement relocalisée + tracée, même forme que create().
exports.createRevenu = async (req, res, next) => {
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
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'finance', entite_id: invoice._id, ip: req.ip, message: `Revenu direct enregistré : ${service || 'Prestation médicale'} — ${montantNum} CFA` });
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
};

// AUDIT-11-6 — l'ancienne séquence (findById → vérifier montant_restant en
// mémoire → invoice.save()) laissait une fenêtre entre la lecture et
// l'écriture : deux paiements concurrents sur la même facture (caissier +
// paiement portail, ou double-clic) pouvaient tous deux lire un solde
// suffisant avant que le premier n'ait sauvegardé, faisant passer
// montant_restant en négatif — même famille de bug lire-puis-écrire déjà
// corrigée dans pharmacy.controller.js (stock_actuel) et
// hospitalization.controller.js (lits.statut). Un seul findOneAndUpdate
// atomique filtré sur montant_restant >= montant : Mongo ne peut
// matcher/modifier qu'un seul des deux appels concurrents, l'autre reçoit 0
// document modifié et un échec explicite. Le hook pre('save') du modèle
// (qui dérive montant_paye/montant_restant/statut depuis paiements[] en
// mémoire) n'intervient jamais sur ce chemin : $push/$inc et la dérivation
// du statut sont faits explicitement ci-dessous, contre l'état déjà
// atomiquement à jour renvoyé par { new: true }.
exports.addPayment = async (req, res, next) => {
  try {
    const { montant, mode, reference } = req.body;
    const montantNum = Number(montant);
    if (!(montantNum > 0))
      return res.status(400).json({ success: false, message: 'Le montant du paiement doit être positif.' });

    const avant = await Invoice.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Facture introuvable.' });

    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, montant_restant: { $gte: montantNum } },
      {
        $push: { paiements: { montant: montantNum, mode, reference, enregistre_par: req.user._id } },
        $inc: { montant_paye: montantNum, montant_restant: -montantNum },
      },
      { new: true }
    );
    if (!invoice) return res.status(400).json({ success: false, message: 'Montant supérieur au solde restant.' });

    // statut dérivé après coup depuis montant_paye/montant_restant, déjà
    // atomiquement corrects à ce stade — jamais une valeur elle-même en
    // course, donc sans risque de perte d'écriture ici.
    const statutAttendu = invoice.montant_restant <= 0 ? 'payee' : (invoice.montant_paye > 0 ? 'partiellement_payee' : invoice.statut);
    if (statutAttendu !== invoice.statut) {
      invoice.statut = statutAttendu;
      await Invoice.updateOne({ _id: invoice._id }, { statut: statutAttendu });
    }

    await logAction({ utilisateur: req.user._id, action: 'PAYMENT', module: 'finance', entite_id: invoice._id, ip: req.ip, message: `Paiement ${montantNum} (${mode})`, avant, apres: invoice });
    emitActivity({ module: 'finance', action: 'Paiement reçu', detail: `${montantNum.toLocaleString('fr-FR')} CFA — ${mode}`, icon: '✅', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
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

    // POST5-018 (audit indépendant post-Phase 5, 14 sept. 2026) — rien
    // n'empêchait de marquer 'annulee' une facture ayant déjà de vrais
    // paiements enregistrés (paiements[]/montant_paye) : le statut passait à
    // 'annulee' sans la moindre réversion ni signalement, laissant une
    // facture "annulée" portant pourtant un historique de paiements réels —
    // incohérence comptable silencieuse, traçabilité perdue. Aucune
    // politique de remboursement/réversion n'existe dans ce système : plutôt
    // que d'inventer une règle métier (supprimer les paiements détruirait la
    // traçabilité, la conserver telle quelle sans avertir masque le
    // problème), l'opération est bloquée — même principe que POST5-006
    // (suppression d'une Consultation facturée) : intégrité comptable avant
    // commodité. Une facture payée ne peut être annulée qu'après un vrai
    // processus de remboursement, hors périmètre de ce correctif.
    if (statut === 'annulee' && invoice.montant_paye > 0) {
      return res.status(409).json({ success: false, message: `Impossible d'annuler cette facture : ${invoice.montant_paye.toLocaleString('fr-FR')} CFA de paiement(s) déjà enregistré(s). Un remboursement doit être traité séparément avant toute annulation.` });
    }

    let final;
    if (statut === 'payee' && invoice.montant_restant > 0) {
      // AUDIT-11-6 — même famille de bug que addPayment ci-dessus : lire
      // montant_restant en mémoire puis pousser un paiement de ce montant
      // exact avant save() pouvait, sous deux appels concurrents (double-clic,
      // ou en même temps qu'un vrai paiement via addPayment sur la même
      // facture), enregistrer deux fois le solde. Le filtre porte sur le
      // solde exact lu ci-dessus (pas un $gte : payer "le solde restant"
      // n'a de sens que contre le solde réellement présent au moment de
      // l'écriture) — si l'état a changé entre-temps, 0 document ne matche,
      // renvoyé comme un conflit explicite plutôt qu'un double paiement.
      const soldeAttendu = invoice.montant_restant;
      final = await Invoice.findOneAndUpdate(
        { _id: invoice._id, montant_restant: soldeAttendu },
        {
          $push: { paiements: { montant: soldeAttendu, mode: 'especes', enregistre_par: req.user._id } },
          $inc: { montant_paye: soldeAttendu, montant_restant: -soldeAttendu },
          $set: { statut: 'payee' },
        },
        { new: true }
      );
      if (!final) {
        return res.status(409).json({ success: false, message: 'Le solde de cette facture a changé entre-temps (un paiement vient d\'être enregistré) — rechargez la facture et réessayez.' });
      }
    } else {
      invoice.statut = statut;
      await invoice.save();
      final = invoice;
    }

    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'finance', entite_id: invoice._id, ip: req.ip, message: `Statut facture ${invoice.numero_facture} : ${avant.statut} → ${final.statut}`, avant, apres: final.toObject() });
    emitDashboardUpdate();
    res.json({ success: true, invoice: normalizeInvoice(final.toObject()) });
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

// AUDIT-GLOBAL — Administration.jsx affichait un tableau de "Transactions
// récentes" entièrement fabriqué et un bouton "Valider" factice, alors
// qu'aucune route de validation de dépense n'existait. Ajoutée ici (même
// style que createDepense ci-dessus).
exports.validerDepense = async (req, res, next) => {
  try {
    const depense = await Depense.findByIdAndUpdate(req.params.id, { statut: 'paye' }, { new: true });
    if (!depense) return res.status(404).json({ success: false, message: 'Dépense introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'finance', entite_id: depense._id, ip: req.ip, message: `Dépense validée : ${depense.description}` });
    emitDashboardUpdate();
    res.json({ success: true, depense });
  } catch (err) { next(err); }
};

// ── BUDGET ────────────────────────────────────────────────────────────────
// AUDIT-FINANCE-BUDGET — l'onglet "Budget" de Finance.jsx était intégralement
// fabriqué (DEMO_BUDGET = [] côté frontend, tous les indicateurs réduisaient
// sur un tableau vide — le taux d'exécution rendait littéralement "NaN%").
// "Réalisé" est réellement dérivable des Depense déjà trackées ; "budget
// annuel" est une valeur planifiée que personne d'autre que l'utilisateur ne
// peut fournir — d'où BudgetCible, un document par (année, catégorie),
// jamais calculé, toujours saisi manuellement. Période retenue : année
// civile (1er janvier - 31 décembre), décision explicite suite à l'audit —
// l'ancien libellé "mensuel"/"Juin 2026" du frontend était incohérent avec
// l'intitulé "budget total annuel" de la demande.
exports.getBudget = async (req, res, next) => {
  try {
    const annee = Number(req.query.annee) || new Date().getFullYear();
    const debut = new Date(annee, 0, 1);
    const fin = new Date(annee, 11, 31, 23, 59, 59, 999);

    const [cibles, depensesParCategorie] = await Promise.all([
      BudgetCible.find({ annee }).lean(),
      // AUDIT-FINANCE-BUDGET — "réalisé" = dépenses réellement exécutées
      // (statut 'paye'), pas seulement engagées ('en_attente') : le mot
      // "réalisé" désigne ce qui a été effectivement dépensé, pas ce qui est
      // prévu/en cours de règlement.
      Depense.aggregate([
        { $match: { date: { $gte: debut, $lte: fin }, statut: 'paye' } },
        { $group: { _id: '$categorie', total: { $sum: '$montant' } } },
      ]),
    ]);

    const cibleParCategorie = {};
    cibles.forEach(c => { cibleParCategorie[c.categorie] = c.montant_annuel; });
    const realiseParCategorie = {};
    depensesParCategorie.forEach(d => { realiseParCategorie[d._id] = d.total; });

    const categories = BudgetCible.CATEGORIES.map(categorie => {
      const budget_annuel = cibleParCategorie[categorie] || 0;
      const realise = realiseParCategorie[categorie] || 0;
      const ecart = budget_annuel - realise;
      const taux_execution = budget_annuel > 0 ? Math.round((realise / budget_annuel) * 100) : null;
      return { categorie, budget_annuel, realise, ecart, taux_execution };
    });

    const budget_total_annuel = categories.reduce((s, c) => s + c.budget_annuel, 0);
    const realise_total = categories.reduce((s, c) => s + c.realise, 0);
    const ecart_total = budget_total_annuel - realise_total;
    const taux_execution_global = budget_total_annuel > 0 ? Math.round((realise_total / budget_total_annuel) * 100) : null;

    res.json({
      success: true,
      annee,
      categories,
      budget_total_annuel,
      realise_total,
      ecart_total,
      taux_execution_global,
    });
  } catch (err) { next(err); }
};

exports.updateBudget = async (req, res, next) => {
  try {
    const annee = Number(req.query.annee) || new Date().getFullYear();
    const { categorie } = req.params;
    const { montant_annuel } = req.body;
    if (!BudgetCible.CATEGORIES.includes(categorie)) {
      return res.status(400).json({ success: false, message: 'Catégorie invalide.' });
    }
    if (!(Number(montant_annuel) >= 0)) {
      return res.status(400).json({ success: false, message: 'Montant annuel invalide.' });
    }

    const avant = await BudgetCible.findOne({ annee, categorie }).lean();
    const cible = await BudgetCible.findOneAndUpdate(
      { annee, categorie },
      { montant_annuel: Number(montant_annuel), modifie_par: req.user._id },
      { new: true, upsert: true, runValidators: true }
    );

    await logAction({
      utilisateur: req.user._id, action: avant ? 'UPDATE' : 'CREATE', module: 'finance', entite_id: cible._id, ip: req.ip,
      message: `Budget cible ${categorie} ${annee} : ${avant?.montant_annuel ?? '—'} → ${montant_annuel} CFA`,
    });
    emitDashboardUpdate();
    res.json({ success: true, cible });
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

    // AUDIT-GLOBAL — Staff.prenom/nom sont vides quand l'employé est lié à
    // un compte User (utilisateur), auquel cas le vrai nom vit sur ce compte
    // — même repli déjà appliqué côté HR (hr.controller.js/HR.jsx::normalizeEmp).
    // Sans lui, "Employé" restait vide pour tout le personnel avec compte.
    const bulletins = await Salaire.find({ mois }).populate({
      path: 'staff', select: 'prenom nom poste utilisateur',
      populate: { path: 'utilisateur', select: 'prenom nom' },
    });
    const salaires = bulletins
      .filter(b => b.staff) // employé supprimé depuis
      .map(b => {
        const u = b.staff.utilisateur;
        return {
          _id: b._id,
          employe: `${b.staff.prenom || u?.prenom || ''} ${b.staff.nom || u?.nom || ''}`.trim(),
          fonction: b.staff.poste,
          base: b.base, primes: b.primes, deductions: b.deductions, net: b.net,
          statut: b.statut, date_paiement: b.date_paiement,
        };
      });
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

// ── BILAN COMPTABLE ─────────────────────────────────────────────────────
// AUDIT-FINANCE-BILAN — l'onglet "Comptabilité" de Finance.jsx affichait 8
// valeurs sur 12 codées en dur. Correction en deux volets :
//  1. Trésorerie caisse & Stocks pharmacie : calculables depuis Invoice/
//     Depense/Medication — jamais saisis manuellement.
//  2. Fournisseurs, Charges sociales, Impôts à payer, Capital social,
//     Réserves, Report à nouveau : comptabilité externe, saisie manuelle
//     dans EcritureBilan (même principe que BudgetCible).
exports.getBilan = async (req, res, next) => {
  try {
    const annee = Number(req.query.annee) || new Date().getFullYear();
    const debut = new Date(annee, 0, 1);
    const fin   = new Date(annee, 11, 31, 23, 59, 59, 999);

    const [
      encaissements, decaissements, stocksAgg,
      creancesAgg, salairesDus, manuel,
    ] = await Promise.all([
      Invoice.aggregate([
        { $unwind: { path: '$paiements', preserveNullAndEmptyArrays: false } },
        { $group: { _id: null, total: { $sum: '$paiements.montant' } } },
      ]),
      Depense.aggregate([
        { $match: { statut: 'paye' } },
        { $group: { _id: null, total: { $sum: '$montant' } } },
      ]),
      Medication.aggregate([
        { $group: { _id: null, total: { $sum: { $multiply: ['$stock_actuel', '$prix_achat'] } } } },
      ]),
      Invoice.aggregate([
        { $match: { statut: { $in: ['emise', 'partiellement_payee'] } } },
        { $group: { _id: null, total: { $sum: '$montant_restant' } } },
      ]),
      Salaire.aggregate([
        { $match: { mois: { $regex: `^${annee}` }, statut: { $ne: 'paye' } } },
        { $group: { _id: null, total: { $sum: '$net' } } },
      ]),
      EcritureBilan.findOne({ annee }).lean(),
    ]);

    const [caAnnee, depensesAnnee] = await Promise.all([
      Invoice.aggregate([
        { $match: { date_facture: { $gte: debut, $lte: fin } } },
        { $group: { _id: null, total: { $sum: '$montant_paye' } } },
      ]),
      Depense.aggregate([
        { $match: { date: { $gte: debut, $lte: fin }, statut: 'paye' } },
        { $group: { _id: null, total: { $sum: '$montant' } } },
      ]),
    ]);
    const resultat_exercice = (caAnnee[0]?.total || 0) - (depensesAnnee[0]?.total || 0);

    const m = manuel || {};

    res.json({
      success: true,
      annee,
      derniere_maj_manuelle: manuel?.updatedAt || null,
      actifs: {
        tresorerie_caisse: (encaissements[0]?.total || 0) - (decaissements[0]?.total || 0),
        creances_clients:  creancesAgg[0]?.total || 0,
        stocks_pharmacie:  stocksAgg[0]?.total || 0,
      },
      passifs: {
        salaires_a_payer: salairesDus[0]?.total || 0,
        fournisseurs:     m.fournisseurs || 0,
        charges_sociales: m.charges_sociales || 0,
        impots_a_payer:   m.impots_a_payer || 0,
      },
      capitaux_propres: {
        resultat_exercice,
        capital_social:   m.capital_social || 0,
        reserves:         m.reserves || 0,
        report_a_nouveau: m.report_a_nouveau || 0,
      },
    });
  } catch (err) { next(err); }
};

exports.updateBilanManuel = async (req, res, next) => {
  try {
    const annee = Number(req.query.annee) || new Date().getFullYear();
    const CHAMPS_AUTORISES = [
      'fournisseurs', 'charges_sociales', 'impots_a_payer',
      'capital_social', 'reserves', 'report_a_nouveau',
    ];
    const updates = {};
    for (const champ of CHAMPS_AUTORISES) {
      if (req.body[champ] !== undefined) {
        const val = Number(req.body[champ]);
        if (Number.isNaN(val)) {
          return res.status(400).json({ success: false, message: `Valeur invalide pour ${champ}.` });
        }
        updates[champ] = val;
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun champ valide fourni.' });
    }
    updates.modifie_par = req.user._id;

    const avant = await EcritureBilan.findOne({ annee }).lean();
    const ecriture = await EcritureBilan.findOneAndUpdate(
      { annee }, updates, { new: true, upsert: true, runValidators: true }
    );

    await logAction({
      utilisateur: req.user._id, action: avant ? 'UPDATE' : 'CREATE', module: 'finance',
      entite_id: ecriture._id, ip: req.ip,
      message: `Bilan comptable ${annee} mis à jour : ${Object.keys(updates).filter(k => k !== 'modifie_par').join(', ')}`,
    });
    emitDashboardUpdate();
    res.json({ success: true, ecriture });
  } catch (err) { next(err); }
};
