const Medication = require('../models/Medication');
const Prescription = require('../models/Prescription');
const Commande = require('../models/Commande');
const Invoice = require('../models/Invoice');
const { logAction, paginate, escapeRegex } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { detectInteractions } = require('../utils/drugInteractions');
const { storeUploadedFile } = require('../utils/fileStorage');
const { isObjectId } = require('../middleware/upload');
const cloudinaryUtil = require('../utils/cloudinary');

// POST5-004 (audit indépendant post-Phase 5, 14 sept. 2026) — même principe
// que document.controller.js::withFreshDeliveryUrl (SEC-DOC-01), jamais
// appliqué jusqu'ici à la photo médicament : régénère une URL Cloudinary
// signée à courte durée de vie à CHAQUE lecture autorisée, au lieu de
// resservir l'URL figée (signée sans expiration) stockée en base.
const withFreshMedPhotoUrl = (med) => {
  const plain = typeof med.toObject === 'function' ? med.toObject() : med;
  if (!plain.photo_public_id) return plain;
  plain.photo = cloudinaryUtil.getSignedDeliveryUrl({
    public_id: plain.photo_public_id,
    resource_type: plain.photo_resource_type,
    format: plain.photo_format,
    version: plain.photo_version,
  });
  return plain;
};

// Audit du 17 sept. 2026 — validation stricte partagée par createVente et
// dispenser : une ligne de vente ou d'ordonnance ne représente jamais une
// quantité nulle, négative ou non numérique. `Math.abs(item.quantite || 0)`
// suivi d'un `if (quantite === 0) continue` laissait passer NaN
// (Math.abs(NaN || 0) === NaN, et NaN === 0 est faux) jusqu'à un $inc Mongo
// — corruption définitive et silencieuse de Medication.stock_actuel en NaN.
// Lève une erreur explicite plutôt que d'ignorer silencieusement, même
// règle que PHARM-001 (mouvement) et PHARM-002 (receptionCommande),
// factorisée ici pour éviter une 3e copie du bug.
function validerQuantiteLigne(valeur, libelle) {
  const q = Number(valeur);
  if (!Number.isFinite(q) || q <= 0) {
    const err = new Error(`Quantité invalide pour ${libelle} : doit être un nombre strictement positif.`);
    err.statusCode = 400;
    throw err;
  }
  return q;
}

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, q, statut, alerte, categorie } = req.query;
    const filter = {};
    // AUDIT-0.3 — un médicament retiré du catalogue (statut 'suspendu', voir
    // exports.remove ci-dessous) ne doit plus apparaître dans la liste active
    // par défaut ; un appel explicite ?statut=suspendu reste possible pour le
    // consulter (traçabilité), tout comme les autres valeurs d'enum.
    if (statut) filter.statut = statut;
    else filter.statut = { $ne: 'suspendu' };
    if (categorie) filter.categorie = { $regex: escapeRegex(categorie), $options: 'i' };
    if (q) {
      const qRe = escapeRegex(q);
      filter.$or = [
        { nom_commercial: { $regex: qRe, $options: 'i' } },
        { dci: { $regex: qRe, $options: 'i' } },
        { fabricant: { $regex: qRe, $options: 'i' } },
      ];
    }
    if (alerte === 'stock' || alerte === 'rupture') filter.$expr = { $lte: ['$stock_actuel', '$seuil_alerte'] };
    if (alerte === 'peremption') {
      const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      filter.date_peremption = { $lte: in30days };
    }
    // PERF-001 (audit de performance du 12 sept. 2026) — countDocuments et
    // find indépendants, exécutés en parallèle.
    const [total, medications] = await Promise.all([
      Medication.countDocuments(filter),
      paginate(Medication.find(filter).sort('nom_commercial'), page, limit),
    ]);
    res.json({ success: true, total, medications: medications.map(withFreshMedPhotoUrl) });
  } catch (err) { next(err); }
};

// ACCES-PHARMACIE-001 (correction du 13 sept. 2026) — endpoint minimal,
// distinct de getAll : le rôle medecin ne doit recevoir AUCUNE donnée du
// module Pharmacie (stock, coûts d'achat, lots, mouvements, fournisseurs...),
// mais Urgences.jsx a besoin d'un vrai catalogue (nom + prix) pour
// sélectionner un médicament réel lors de la prescription/facturation d'un
// traitement en urgence — un besoin métier légitime, distinct de la gestion
// du stock elle-même. Projection strictement limitée aux champs de
// catalogue/tarif ; jamais stock_actuel/stock_minimum/seuil_alerte/
// prix_achat/numero_lot/mouvements/fabricant.
exports.getCatalogueMinimal = async (req, res, next) => {
  try {
    const { statut } = req.query;
    const filter = statut ? { statut } : { statut: { $ne: 'suspendu' } };
    const medications = await Medication.find(filter)
      .select('nom_commercial dci forme dosage presentation prix_vente statut ordonnance_requise')
      .sort('nom_commercial')
      .lean();
    res.json({ success: true, medications });
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    // Exclut les médicaments retirés du catalogue (statut 'suspendu') des KPI
    // de stock actif — même règle que getAll (AUDIT-0.3).
    const meds = await Medication.find({ statut: { $ne: 'suspendu' } });
    const now = Date.now();
    const in30 = new Date(now + 30 * 24 * 3600 * 1000);
    const ruptures  = meds.filter(m => m.stock_actuel === 0).length;
    const critiques = meds.filter(m => m.stock_actuel > 0 && m.stock_actuel < m.stock_minimum * 0.3).length;
    const bas       = meds.filter(m => m.stock_actuel >= m.stock_minimum * 0.3 && m.stock_actuel < m.stock_minimum).length;
    const expires   = meds.filter(m => m.date_peremption && new Date(m.date_peremption) < now).length;
    const imminents = meds.filter(m => m.date_peremption && new Date(m.date_peremption) >= now && new Date(m.date_peremption) <= in30).length;
    // AUDIT-18-6 (18 sept. 2026) — la convention comptable de référence
    // (finance.controller.js, déjà correcte) valorise le stock au coût
    // d'acquisition (prix_achat), pas au chiffre d'affaires potentiel
    // (prix_vente) : deux/trois chiffres différents circulaient pour le même
    // libellé générique "Valeur du stock" affiché sur 3 dashboards.
    const valeur_stock = meds.reduce((s, m) => s + m.stock_actuel * (m.prix_achat || 0), 0);

    // Sous-phase 5.1 (relecture du 6 sept. 2026) — ventes_jour/ventes_mois
    // étaient figés à 0 en dur : aucun mouvement de type 'vente' n'était
    // jamais posé par createVente(). Calculé réellement depuis les vrais
    // mouvements 'vente' (montant réel), désormais posés à chaque vente.
    const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
    const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
    let ventes_jour = 0, ventes_mois = 0;
    meds.forEach(m => {
      (m.mouvements || []).forEach(mv => {
        if (mv.type !== 'vente' || !mv.date) return;
        const d = new Date(mv.date);
        if (d >= debutMois) ventes_mois += (mv.montant || 0);
        if (d >= debutJour) ventes_jour += (mv.montant || 0);
      });
    });

    res.json({ success: true, kpis: { total: meds.length, ruptures, critiques, bas, expires, imminents, valeur_stock, ventes_jour, ventes_mois } });
  } catch (err) { next(err); }
};

exports.getMovements = async (req, res, next) => {
  try {
    const meds = await Medication.find({ 'mouvements.0': { $exists: true } }).limit(50);
    const mouvements = [];
    meds.forEach(m => {
      m.mouvements.slice(-5).forEach(mv => {
        mouvements.push({
          _id: mv._id,
          medicament_nom: m.nom_commercial,
          medicament_id: m._id,
          type: mv.type,
          quantite: mv.quantite,
          reference: mv.reference,
          notes: mv.notes,
          date: mv.date,
          stock_avant: null,
          stock_apres: null,
        });
      });
    });
    mouvements.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, mouvements: mouvements.slice(0, 30) });
  } catch (err) { next(err); }
};

exports.createVente = async (req, res, next) => {
  try {
    const { client, mode_paiement, items = [] } = req.body;
    const year = new Date().getFullYear();
    const numero = `VNT-${year}-${String(Date.now()).slice(-5)}`;

    // AUDIT-2.1 — l'ancien garde-fou (T4.3/R-04b) vérifiait le stock de tous
    // les articles PUIS décrémentait chacun séparément sans revérifier au
    // moment de l'écriture : deux ventes concurrentes du même produit
    // pouvaient toutes deux lire un stock suffisant avant que l'une n'ait
    // écrit, faisant passer le stock en négatif. Chaque article est
    // désormais décrémenté par une opération atomique conditionnelle unique
    // (findOneAndUpdate filtré sur stock_actuel >= quantité demandée) ; si un
    // article échoue en cours de boucle, les articles déjà décrémentés dans
    // cette même vente sont recrédités (mouvement de type 'retour', jamais
    // de suppression de l'historique) avant de renvoyer l'erreur.
    // SPEC-01 (correction du 12 sept. 2026, audit indépendant) —
    // item.prix_unitaire venait directement du client et déterminait le
    // montant réellement enregistré dans le ledger (mouvements) ainsi que
    // ventes_jour/ventes_mois (getStats) : un appel API direct (hors de
    // l'interface livrée, qui n'expose elle-même aucun prix éditable —
    // Pharmacy.jsx envoie déjà med.prix_vente) pouvait vendre n'importe quel
    // médicament à n'importe quel prix. Le prix réel est désormais RELU
    // depuis le document Medication retourné par le même findOneAndUpdate
    // atomique — jamais depuis item.prix_unitaire.
    // Validées intégralement AVANT toute écriture (même principe que
    // PHARM-002/receptionCommande) : la boucle de décrément ci-dessous a son
    // propre mécanisme de rollback (recrédit) pour un échec de STOCK
    // survenant en cours de route, mais pas pour une quantité invalide — la
    // valider ici, avant le premier $inc, évite de laisser des articles déjà
    // décrémentés dans cette même vente sans recrédit si un article plus
    // loin dans la liste s'avère invalide.
    for (const item of items) {
      try {
        validerQuantiteLigne(item.quantite, `l'article ${item.medicament_id}`);
      } catch (e) {
        return res.status(e.statusCode || 400).json({ success: false, message: e.message });
      }
    }

    const decrementes = [];
    let echec = null;
    for (const item of items) {
      const quantite = validerQuantiteLigne(item.quantite, `l'article ${item.medicament_id}`);
      const med = await Medication.findOneAndUpdate(
        { _id: item.medicament_id, stock_actuel: { $gte: quantite } },
        { $inc: { stock_actuel: -quantite } },
        { new: true }
      );
      if (!med) {
        const info = await Medication.findById(item.medicament_id).select('nom_commercial stock_actuel');
        echec = `${info?.nom_commercial || item.medicament_id} (stock: ${info?.stock_actuel ?? '—'}, requis: ${quantite})`;
        break;
      }
      const prixReel = Number(med.prix_vente) || 0;
      decrementes.push({ id: item.medicament_id, nom: med.nom_commercial, quantite, prix_unitaire: prixReel, montant: prixReel * quantite });
    }
    if (echec) {
      for (const d of decrementes) {
        await Medication.findByIdAndUpdate(d.id, {
          $inc: { stock_actuel: d.quantite },
          $push: { mouvements: { type: 'retour', quantite: d.quantite, reference: numero, notes: `Annulation automatique — stock insuffisant ailleurs dans la même vente ${numero}`, utilisateur: req.user._id } },
        });
      }
      return res.status(400).json({
        success: false,
        message: `Stock insuffisant pour cette vente : ${echec}.`,
      });
    }
    // Sous-phase 5.1 (relecture du 6 sept. 2026) — mouvement réel posé
    // uniquement une fois la vente ENTIÈREMENT réussie (jamais pour une vente
    // avortée en cours de boucle ci-dessus, qui ne fait que restaurer le
    // stock). Sans ce mouvement, aucune trace du montant vendu n'existait
    // nulle part : ventes_jour/ventes_mois (getStats) restaient figés à 0.
    for (const d of decrementes) {
      await Medication.findByIdAndUpdate(d.id, {
        $push: { mouvements: { type: 'vente', quantite: d.quantite, montant: d.montant, reference: numero, utilisateur: req.user._id, notes: `Vente ${numero}` } },
      });
    }
    // SPEC-01 — le total et les lignes renvoyées reflètent les montants
    // RÉELLEMENT enregistrés (decrementes, prix catalogue), jamais une
    // ré-agrégation de ce que le client avait envoyé.
    const total = decrementes.reduce((s, d) => s + d.montant, 0);
    await logAction({ utilisateur: req.user._id, action: 'VENTE', module: 'pharmacy', ip: req.ip, message: `Vente ${numero} — ${total} CFA` });

    // SPEC-13 (correction du 12 sept. 2026, audit indépendant) — une vente
    // comptoir n'était tracée que dans Medication.mouvements (ledger de
    // stock) : invisible pour le module Finance/Analytics, qui n'agrège que
    // la collection Invoice (voir analytics.controller.js::getFinancial).
    // Une vraie Invoice est désormais créée, réellement réglée à la vente
    // (paiement comptant, capturé par mode_paiement) — jamais un montant
    // recalculé séparément : mêmes lignes, même total que decrementes.
    // Aucun `patient` réel n'est nécessairement associé (client comptoir en
    // texte libre, Pharmacy.jsx envoie déjà "Comptoir" par défaut) —
    // patient reste donc optionnel ici, comme le permet déjà le schéma
    // Invoice pour une facture sans patient identifié.
    // Pharmacy.jsx envoie des libellés de mode de paiement (carte_bancaire,
    // assurance) qui ne correspondent pas tous à l'enum de
    // Invoice.paiements[].mode (especes/carte/mobile_money/virement/cheque)
    // — mappés ici plutôt que de laisser Invoice.create() échouer en
    // ValidationError sur une vente par ailleurs valide.
    const PAIEMENT_MODE_MAP = { especes: 'especes', mobile_money: 'mobile_money', carte_bancaire: 'carte', carte: 'carte', virement: 'virement', cheque: 'cheque' };
    // Audit du 17 sept. 2026 — "assurance" n'était pas dans PAIEMENT_MODE_MAP
    // (ce n'est pas un mode de règlement direct au comptoir) : la facture
    // était quand même marquée payee/montant_paye:total, comme un paiement
    // cash reçu, alors qu'une vente assurance reste à recouvrer auprès de
    // l'assureur — montant_assurance (champ dédié du schéma Invoice) restait
    // à 0 et le mode réel de règlement était perdu. Routée désormais dans
    // montant_assurance, jamais dans paiements[] (réservé aux règlements
    // directs réels), statut 'emise' (facture réellement à recouvrer).
    const estAssurance = mode_paiement === 'assurance';
    let factureGeneree = null;
    if (total > 0) {
      factureGeneree = await Invoice.create({
        patient_nom: client || 'Comptoir',
        service_label: 'Pharmacie — Vente comptoir',
        lignes: decrementes.map(d => ({ libelle: d.nom, categorie: 'pharmacie', prix_unitaire: d.prix_unitaire, quantite: d.quantite, montant: d.montant })),
        montant_ht: total,
        montant_ttc: total,
        montant_assurance: estAssurance ? total : 0,
        montant_paye: estAssurance ? 0 : total,
        montant_restant: estAssurance ? total : 0,
        statut: estAssurance ? 'emise' : 'payee',
        paiements: estAssurance ? [] : [{ montant: total, mode: PAIEMENT_MODE_MAP[mode_paiement], reference: numero, enregistre_par: req.user._id }],
        notes: `Vente comptoir ${numero}`,
        created_by: req.user._id,
      });
    }

    emitDashboardUpdate();
    res.status(201).json({ success: true, vente: { numero, client, mode_paiement, items: decrementes.map(d => ({ medicament_id: d.id, nom: d.nom, quantite: d.quantite, prix_unitaire: d.prix_unitaire, montant: d.montant })), total, date: new Date() }, invoice: factureGeneree });
  } catch (err) { next(err); }
};

exports.getCommandes = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, statut } = req.query;
    const filter = statut ? { statut } : {};
    // PERF-001 (audit de performance du 12 sept. 2026) — countDocuments et
    // find indépendants, exécutés en parallèle.
    const [total, raw] = await Promise.all([
      Commande.countDocuments(filter),
      paginate(Commande.find(filter).sort('-createdAt'), page, limit),
    ]);
    const commandes = raw.map(c => ({
      ...c.toObject(),
      date: c.createdAt,
      nb_lignes: c.lignes.length,
    }));
    res.json({ success: true, total, commandes });
  } catch (err) { next(err); }
};

exports.createCommande = async (req, res, next) => {
  try {
    const { fournisseur, lignes, date_livraison_souhaitee, notes } = req.body;
    if (!fournisseur || !Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ success: false, message: 'Fournisseur et au moins une ligne sont requis.' });
    }
    const montant = lignes.reduce((s, l) => s + (l.prix_unitaire || 0) * (l.quantite || 0), 0);

    const commande = await Commande.create({
      fournisseur, lignes, date_livraison_souhaitee, notes, montant,
      cree_par: req.user._id,
    });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'pharmacy', entite_id: commande._id, ip: req.ip, message: `Bon de commande ${commande.numero} — ${fournisseur}` });
    emitActivity({ module: 'pharmacy', action: 'Nouveau bon de commande', detail: `${commande.numero} — ${fournisseur}`, icon: '📦', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    res.status(201).json({ success: true, commande: { ...commande.toObject(), date: commande.createdAt, nb_lignes: commande.lignes.length } });
  } catch (err) { next(err); }
};

// PUT /pharmacy/commandes/:id/reception — réceptionner tout ou partie d'une
// commande ; incrémente le stock pour chaque ligne rattachée à une fiche
// Medication (même limite que la dispensation : une ligne saisie en texte
// libre ne peut pas être rapprochée d'un produit sans risquer un mauvais
// match, donc son stock n'est pas touché).
exports.receptionCommande = async (req, res, next) => {
  try {
    const commande = await Commande.findById(req.params.id);
    if (!commande) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    if (['recu', 'annule'].includes(commande.statut)) {
      return res.status(400).json({ success: false, message: 'Cette commande est déjà reçue ou annulée.' });
    }
    const avant = commande.toObject();

    // AUDIT-M-B5 (Groupe B, Point 5) — même famille que dispenser() : lisait
    // stock_actuel en mémoire (med.stock_actuel += X) puis med.save() —
    // deux réceptions concurrentes sur le même médicament (deux commandes
    // différentes livrées en même temps, ou double-clic) pouvaient perdre
    // un incrément (la dernière écriture gagne, sans jamais additionner les
    // deux). Remplacé par un $inc atomique, même principe que dispenser().
    const { receptions } = req.body; // [{ index, quantite_recue }]
    // PHARM-002 (audit du 13 sept. 2026) — quantite_recue n'était jamais
    // validée : une valeur négative décrémentait stock_actuel via $inc sans
    // aucun garde plancher (le $gte appliqué aux sorties dans mouvement() ne
    // couvre pas cette route), tout en étant journalisée comme une "entrée".
    // Une réception ne représente jamais une quantité nulle ou négative —
    // validées intégralement AVANT toute écriture (aucune réception
    // partiellement appliquée sur un lot invalide).
    for (const r of (receptions || [])) {
      const q = Number(r.quantite_recue);
      if (!Number.isFinite(q) || q <= 0) {
        return res.status(400).json({ success: false, message: 'Quantité reçue invalide : doit être un nombre strictement positif.' });
      }
    }
    // Audit du 17 sept. 2026 — le $inc atomique sur Medication.stock_actuel
    // ci-dessous s'exécutait AVANT que la protection de concurrence sur
    // Commande (lecture en mémoire → commande.save(), séquence non atomique)
    // ne s'applique : un double-clic ou un retry réseau sur "Confirmer
    // réception" pouvait incrémenter le stock deux fois pour la même
    // livraison physique, sans erreur visible. Chaque ligne est désormais
    // recréditée via un findOneAndUpdate CONDITIONNEL sur Commande, filtré
    // sur la valeur de quantite_recue lue au début de cette requête : si une
    // autre requête a déjà traité cette ligne entre-temps, le filtre ne
    // matche plus, cette itération est ignorée (course détectée), et le
    // $inc sur Medication n'est jamais exécuté une seconde fois pour la même
    // livraison.
    for (const r of (receptions || [])) {
      const ligneAvant = commande.lignes[r.index];
      if (!ligneAvant) continue;
      const quantiteRecue = Number(r.quantite_recue);
      const dejaRecue = ligneAvant.quantite_recue || 0;
      const quantiteAppliquee = Math.min(quantiteRecue, ligneAvant.quantite - dejaRecue);
      if (quantiteAppliquee <= 0) continue; // ligne déjà entièrement reçue — pas de 2e incrément

      const commandeMaj = await Commande.findOneAndUpdate(
        { _id: commande._id, [`lignes.${r.index}.quantite_recue`]: dejaRecue },
        { $inc: { [`lignes.${r.index}.quantite_recue`]: quantiteAppliquee } },
        { new: true }
      );
      if (!commandeMaj) continue; // course détectée : ligne déjà traitée ailleurs

      if (ligneAvant.medicament) {
        const med = await Medication.findOneAndUpdate(
          { _id: ligneAvant.medicament },
          {
            $inc: { stock_actuel: quantiteAppliquee },
            $push: { mouvements: { type: 'entree', quantite: quantiteAppliquee, reference: commande.numero, notes: `Réception commande ${commande.numero}`, utilisateur: req.user._id } },
          },
          { new: true, runValidators: true }
        );
        if (med && med.stock_actuel > 0 && med.statut === 'rupture') {
          await Medication.findByIdAndUpdate(med._id, { $set: { statut: 'disponible' } });
        }
      }
    }

    // Recharger la commande à jour — les $inc ci-dessus ont modifié la base
    // directement, le document `commande` en mémoire est maintenant périmé.
    const commandeFinale = await Commande.findById(commande._id);
    const totalRecu = commandeFinale.lignes.every(l => l.quantite_recue >= l.quantite);
    const auMoinsUnRecu = commandeFinale.lignes.some(l => l.quantite_recue > 0);
    commandeFinale.statut = totalRecu ? 'recu' : (auMoinsUnRecu ? 'recu_partiel' : commandeFinale.statut);
    if (totalRecu) commandeFinale.date_reception = new Date();

    await commandeFinale.save();
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'pharmacy', entite_id: commandeFinale._id, ip: req.ip, message: `Réception ${commandeFinale.statut === 'recu' ? 'complète' : 'partielle'} — ${commandeFinale.numero}`, avant, apres: commandeFinale });
    emitDashboardUpdate();
    res.json({ success: true, commande: commandeFinale });
  } catch (err) { next(err); }
};

exports.getFournisseurs = async (req, res, next) => {
  try {
    const fabricants = await Medication.distinct('fabricant');
    const fournisseurs = fabricants.filter(Boolean).map((f, i) => ({ _id: String(i), nom: f, contact: '', ville: '', email: '', type: 'fournisseur', delai_livraison: 7 }));
    res.json({ success: true, fournisseurs });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const med = await Medication.findById(req.params.id);
    if (!med) return res.status(404).json({ success: false, message: 'Médicament introuvable.' });
    res.json({ success: true, medication: withFreshMedPhotoUrl(med) });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const med = await Medication.create(req.body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'pharmacy', entite_id: med._id, ip: req.ip, message: `Nouveau médicament: ${med.nom_commercial}` });
    emitActivity({ module: 'pharmacy', action: 'Nouveau médicament', detail: med.nom_commercial, icon: '💊', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, medication: med });
  } catch (err) { next(err); }
};

// AUDIT-P2-1 (groupe 2) — stock_actuel/mouvements sont gérés par
// mouvement()/dispenser()/receptionCommande(), qui journalisent chaque
// changement avec sa raison ; les laisser passer par cette édition
// générique de fiche produit permettrait de modifier le stock sans aucune
// traçabilité de mouvement.
const MED_BLOCKED_FIELDS = ['stock_actuel', 'mouvements'];

exports.update = async (req, res, next) => {
  try {
    const avant = await Medication.findById(req.params.id).lean();
    const data = {};
    for (const [k, v] of Object.entries(req.body)) { if (!MED_BLOCKED_FIELDS.includes(k)) data[k] = v; }
    const med = await Medication.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!med) return res.status(404).json({ success: false, message: 'Médicament introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'pharmacy', entite_id: med._id, ip: req.ip, message: `Fiche médicament modifiée : ${med.nom_commercial}`, avant, apres: med });
    res.json({ success: true, medication: med });
  } catch (err) { next(err); }
};

// AUDIT-0.3 — retrait "logique" (statut: 'suspendu') plutôt que suppression
// physique : cohérent avec le reste du module (aucun mouvement/historique
// n'est jamais supprimé physiquement ailleurs) et avec le champ statut déjà
// prévu au modèle pour cet usage (analytics.controller.js l'agrège déjà comme
// 4e catégorie du graphique de répartition du stock). getAll()/getStats()
// excluent ce statut par défaut (voir plus haut), donc le médicament
// disparaît bien de la liste et des KPI actifs sans perte de traçabilité.
exports.remove = async (req, res, next) => {
  try {
    const med = await Medication.findById(req.params.id);
    if (!med) return res.status(404).json({ success: false, message: 'Médicament introuvable.' });
    if (med.statut === 'suspendu') {
      return res.status(400).json({ success: false, message: 'Ce médicament est déjà retiré du catalogue.' });
    }
    const avant = med.toObject();
    med.statut = 'suspendu';
    await med.save();
    await logAction({ utilisateur: req.user._id, action: 'DELETE', module: 'pharmacy', entite_id: med._id, ip: req.ip, message: `Médicament retiré du catalogue : ${med.nom_commercial}`, avant, apres: med });
    emitDashboardUpdate();
    res.json({ success: true, medication: med });
  } catch (err) { next(err); }
};

exports.uploadPhoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier fourni.' });
    // AUDIT-3.5 (SEC-02) — même garde qu'avant cette migration (middleware/upload.js).
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant médicament invalide.' });
    const { url, public_id, resource_type, format, version } = await storeUploadedFile(req.file, { folder: 'medications', filenameBase: `med-${req.params.id}-${Date.now()}` });
    const avant = await Medication.findById(req.params.id).select('photo').lean();
    if (!avant) return res.status(404).json({ message: 'Médicament introuvable.' });
    const med = await Medication.findByIdAndUpdate(
      req.params.id,
      { photo: url, photo_public_id: public_id, photo_resource_type: resource_type, photo_format: format, photo_version: version },
      { new: true }
    );
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'pharmacy', entite_id: med._id, ip: req.ip, avant: { photo: avant.photo }, apres: { photo: url }, message: 'Photo mise à jour' });
    const fresh = withFreshMedPhotoUrl(med);
    res.json({ success: true, photo: fresh.photo, medication: fresh });
  } catch (err) { next(err); }
};

exports.mouvement = async (req, res, next) => {
  try {
    const { type, reference, notes } = req.body;
    // PHARM-001 (audit du 13 sept. 2026) — quantite n'était jamais validée :
    // une valeur négative envoyée pour un mouvement "sortant" inversait le
    // delta ($inc positif au lieu de négatif), et pour un mouvement
    // "entrant" décrémentait le stock sans jamais passer par le garde
    // stock_actuel >= quantite (appliqué uniquement si sortant). Un
    // mouvement ne représente jamais une quantité nulle ou négative — rejet
    // strict avant toute lecture/écriture, jamais une normalisation
    // silencieuse (Math.abs aurait accepté une saisie erronée sans le
    // signaler à l'appelant).
    const quantite = Number(req.body.quantite);
    if (!Number.isFinite(quantite) || quantite <= 0) {
      return res.status(400).json({ success: false, message: 'Quantité invalide : doit être un nombre strictement positif.' });
    }
    const avant = await Medication.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Médicament introuvable.' });

    // AUDIT-2.1 — l'ancienne séquence (findById → vérifier/modifier
    // stock_actuel en mémoire → med.save()) laissait une fenêtre de course :
    // deux mouvements concurrents sur le même médicament pouvaient tous deux
    // lire le même stock de départ, l'un écrasant silencieusement l'écriture
    // de l'autre (perte de mouvement). Décrément conditionnel atomique
    // (findOneAndUpdate filtré sur stock_actuel >= quantité pour les
    // mouvements sortants), jamais de save() sur le document complet.
    const sortant = ['sortie','dispensation','perte','peremption'].includes(type);
    const delta   = ['entree','retour'].includes(type) ? quantite : -quantite;
    const filter  = { _id: req.params.id };
    if (sortant) filter.stock_actuel = { $gte: quantite };

    const med = await Medication.findOneAndUpdate(
      filter,
      { $inc: { stock_actuel: delta }, $push: { mouvements: { type, quantite, reference, notes, utilisateur: req.user._id } } },
      { new: true, runValidators: true }
    );
    if (!med) return res.status(400).json({ success: false, message: 'Stock insuffisant.' });

    if (med.stock_actuel <= 0 && med.statut !== 'rupture') {
      await Medication.findByIdAndUpdate(med._id, { $set: { statut: 'rupture' } });
      med.statut = 'rupture';
    } else if (med.stock_actuel > 0 && med.statut === 'rupture') {
      await Medication.findByIdAndUpdate(med._id, { $set: { statut: 'disponible' } });
      med.statut = 'disponible';
    }

    await logAction({ utilisateur: req.user._id, action: 'STOCK_MOUVEMENT', module: 'pharmacy', entite_id: med._id, ip: req.ip, message: `${type} x${quantite} — ${med.nom_commercial}`, avant, apres: med });
    emitActivity({ module: 'pharmacy', action: `Mouvement stock (${type})`, detail: `${med.nom_commercial} ×${quantite}`, icon: type === 'entree' ? '📦' : '💊', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.json({ success: true, medication: med });
  } catch (err) { next(err); }
};

exports.getPrescriptions = async (req, res, next) => {
  try {
    const { statut = 'active' } = req.query;
    const prescriptions = await Prescription.find({ statut })
      .populate('patient', 'nom prenom numero_dossier')
      .populate('medecin', 'nom prenom')
      .sort('-date_prescription');
    res.json({ success: true, prescriptions });
  } catch (err) { next(err); }
};

exports.dispenser = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    // P7-3 : le flux normal de publication (prescriptions.controller.js::publier)
    // fait transitionner brouillon → 'publiee' directement, sans jamais passer
    // par 'active'. N'accepter que 'active' rendait donc toute dispensation
    // impossible en pratique — 'active' reste accepté pour compatibilité avec
    // d'éventuelles ordonnances créées directement dans cet état (legacy/tests).
    if (!['active', 'publiee'].includes(prescription.statut)) {
      await logAction({ utilisateur: req.user._id, action: 'DISPENSE', module: 'pharmacy', entite_id: prescription._id, ip: req.ip, statut: 'echec', message: `Dispensation refusée — statut actuel : ${prescription.statut}` });
      return res.status(400).json({ success: false, message: 'Ordonnance non dispensable dans son état actuel.' });
    }
    const avant = prescription.toObject();

    // Seules les lignes reliées à une fiche Medication (catalogue) impactent le
    // stock — une ligne saisie en texte libre (medicament_nom sans medicament)
    // ne peut pas être rapprochée d'un produit sans risquer un mauvais match.
    const lignesAvecStock = prescription.lignes.filter(l => l.medicament);

    // AUDIT-2.1 — l'ancien garde-fou (vérifier tout le stock nécessaire AVANT
    // d'écrire quoi que ce soit) protégeait contre un échec partiel mais pas
    // contre une course : deux dispensations concurrentes de la même
    // ordonnance/du même produit pouvaient toutes deux lire un stock
    // suffisant puis toutes deux décrémenter, faisant passer le stock en
    // négatif. Chaque ligne est maintenant décrémentée par une opération
    // atomique conditionnelle unique (findOneAndUpdate filtré sur
    // stock_actuel >= quantité) ; si une ligne échoue en cours de boucle, les
    // lignes déjà décrémentées dans cette même requête sont recréditées
    // (mouvement de type 'retour', jamais de suppression de l'historique)
    // avant de renvoyer l'erreur — aucune écriture partielle ne subsiste.
    // Validées intégralement AVANT toute écriture (même principe que
    // PHARM-002/receptionCommande et que createVente ci-dessus) : évite de
    // laisser des lignes déjà décrémentées dans cette même dispensation sans
    // recrédit si une ligne plus loin dans la liste s'avère invalide.
    for (const ligne of lignesAvecStock) {
      try {
        validerQuantiteLigne(ligne.quantite, `la ligne ${ligne.medicament_nom || ligne.medicament}`);
      } catch (e) {
        return res.status(e.statusCode || 400).json({ success: false, message: e.message });
      }
    }

    const decrementees = [];
    let echec = null;
    for (const ligne of lignesAvecStock) {
      const medId = ligne.medicament.toString();
      const quantite = validerQuantiteLigne(ligne.quantite, `la ligne ${ligne.medicament_nom || ligne.medicament}`);
      const med = await Medication.findOneAndUpdate(
        { _id: medId, stock_actuel: { $gte: quantite } },
        {
          $inc: { stock_actuel: -quantite },
          $push: { mouvements: { type: 'dispensation', quantite, reference: prescription.numero_rx, notes: `Dispensation ordonnance ${prescription.numero_rx}`, utilisateur: req.user._id } },
        },
        { new: true }
      );
      if (!med) {
        const info = await Medication.findById(medId).select('nom_commercial stock_actuel');
        echec = `${info?.nom_commercial || medId} (stock: ${info?.stock_actuel ?? '—'}, requis: ${quantite})`;
        break;
      }
      decrementees.push({ id: medId, quantite });
      if (med.stock_actuel <= 0 && med.statut !== 'rupture') {
        await Medication.findByIdAndUpdate(medId, { $set: { statut: 'rupture' } });
      } else if (med.stock_actuel > 0 && med.statut === 'rupture') {
        await Medication.findByIdAndUpdate(medId, { $set: { statut: 'disponible' } });
      }
    }

    // Recrédite les lignes déjà décrémentées dans cette même requête — motif
    // paramétrable, réutilisé à la fois pour "stock insuffisant ailleurs dans
    // la boucle" et pour "ordonnance déjà dispensée entre-temps" (AUDIT-M-B5).
    const crediterRetour = async (motif) => {
      for (const d of decrementees) {
        const updated = await Medication.findByIdAndUpdate(d.id, {
          $inc: { stock_actuel: d.quantite },
          $push: { mouvements: { type: 'retour', quantite: d.quantite, reference: prescription.numero_rx, notes: `Annulation automatique — ${motif} (ordonnance ${prescription.numero_rx})`, utilisateur: req.user._id } },
        }, { new: true });
        if (updated && updated.stock_actuel > 0 && updated.statut === 'rupture') {
          await Medication.findByIdAndUpdate(d.id, { $set: { statut: 'disponible' } });
        }
      }
    };

    if (echec) {
      await crediterRetour('stock insuffisant ailleurs dans la même ordonnance');
      await logAction({ utilisateur: req.user._id, action: 'DISPENSE', module: 'pharmacy', entite_id: prescription._id, ip: req.ip, statut: 'echec', message: `Dispensation refusée — stock insuffisant : ${echec}` });
      return res.status(400).json({
        success: false,
        message: `Stock insuffisant pour dispenser cette ordonnance : ${echec}.`,
      });
    }

    // AUDIT-M-B5 (Groupe B, Point 5) — la garde de statut ci-dessus (ligne 348)
    // n'est pas atomique avec l'écriture finale : deux dispensations
    // concurrentes de la même ordonnance, avec un stock suffisant pour les
    // deux (donc les décréments atomiques par ligne réussissent tous les
    // deux), pouvaient toutes deux franchir la garde puis toutes deux
    // transitionner statut → 'dispensee' — une vraie double dispensation
    // (stock décrémenté deux fois, mouvements dupliqués), pas seulement un
    // risque de stock négatif. Contrairement au Point 4 (chevauchement de
    // RDV, une contrainte ENTRE documents), la contrainte ici porte sur
    // l'état d'un seul document (Prescription._id) : un findOneAndUpdate à
    // filtre-garde classique (même principe que finance.controller.js::
    // addPayment et hospitalization.controller.js::discharge) suffit.
    const meds = prescription.lignes.map(l => l.medicament_nom?.toLowerCase() || '');
    const dispensee = await Prescription.findOneAndUpdate(
      { _id: prescription._id, statut: { $in: ['active', 'publiee'] } },
      {
        $set: {
          statut: 'dispensee',
          dispensee_par: req.user._id,
          date_dispensation: new Date(),
          interactions_detectees: detectInteractions(meds),
        },
      },
      { new: true, runValidators: true }
    );

    if (!dispensee) {
      // Perdu la course sur le statut : une autre requête a déjà dispensé
      // cette ordonnance entre notre lecture initiale et cette écriture —
      // recrédite le stock qu'on vient de décrémenter, jamais un double
      // décompte silencieux.
      await crediterRetour('ordonnance déjà dispensée entre-temps (course concurrente)');
      await logAction({ utilisateur: req.user._id, action: 'DISPENSE', module: 'pharmacy', entite_id: prescription._id, ip: req.ip, statut: 'echec', message: 'Dispensation refusée — ordonnance déjà dispensée entre-temps (course concurrente)' });
      return res.status(409).json({ success: false, message: 'Cette ordonnance vient d\'être dispensée par une autre requête.' });
    }

    // Audit du 17 sept. 2026 (Correction 5, confirmée : paiement immédiat au
    // comptoir, même convention que createVente ci-dessus) — createVente()
    // génère une vraie facture, mais dispenser() décrémentait le stock sans
    // jamais rien facturer : Prescription n'a aucun champ prix, et
    // consultations.controller.js ne facture que l'acte de consultation
    // (categorie: 'consultation'), jamais les médicaments prescrits. Chaque
    // médicament dispensé sur ordonnance sortait donc du stock sans jamais
    // remonter en comptabilité — perte de revenu systématique et invisible.
    // Prix relu depuis Medication au moment de la facturation (jamais une
    // valeur envoyée par le client) ; lignes construites depuis
    // `decrementees` (quantités réellement décrémentées ci-dessus, jamais
    // recalculées). Générée seulement APRÈS la transition de statut réussie,
    // pour ne jamais facturer une dispensation qui échoue ensuite sur la
    // course de statut (voir crediterRetour ci-dessus).
    let factureGeneree = null;
    if (decrementees.length > 0) {
      const medsInfo = await Medication.find({ _id: { $in: decrementees.map(d => d.id) } }).select('nom_commercial prix_vente').lean();
      const medsMap = new Map(medsInfo.map(m => [m._id.toString(), m]));
      const lignesFacture = decrementees.map(d => {
        const med = medsMap.get(d.id);
        const prixReel = Number(med?.prix_vente) || 0;
        return { libelle: med?.nom_commercial || 'Médicament', categorie: 'pharmacie', prix_unitaire: prixReel, quantite: d.quantite, montant: prixReel * d.quantite };
      });
      const totalFacture = lignesFacture.reduce((s, l) => s + l.montant, 0);
      if (totalFacture > 0) {
        factureGeneree = await Invoice.create({
          patient: dispensee.patient,
          service_label: `Pharmacie — Ordonnance ${dispensee.numero_rx}`,
          lignes: lignesFacture,
          montant_ht: totalFacture,
          montant_ttc: totalFacture,
          montant_paye: totalFacture,
          montant_restant: 0,
          statut: 'payee',
          paiements: [{ montant: totalFacture, mode: 'especes', reference: dispensee.numero_rx, enregistre_par: req.user._id }],
          notes: `Dispensation ordonnance ${dispensee.numero_rx}`,
          created_by: req.user._id,
        });
        await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'finance', entite_id: factureGeneree._id, ip: req.ip, message: `Facture ${factureGeneree.numero_facture} générée automatiquement depuis la dispensation ${dispensee.numero_rx}` });
      }
    }

    await logAction({ utilisateur: req.user._id, action: 'DISPENSE', module: 'pharmacy', entite_id: dispensee._id, ip: req.ip, avant, apres: dispensee });
    emitActivity({ module: 'pharmacy', action: 'Dispensation ordonnance', detail: dispensee.numero_rx, icon: '💊', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.json({ success: true, prescription: dispensee, invoice: factureGeneree });
  } catch (err) { next(err); }
};
