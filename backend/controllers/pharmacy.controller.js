const Medication = require('../models/Medication');
const Prescription = require('../models/Prescription');
const Commande = require('../models/Commande');
const { logAction, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');
const { detectInteractions } = require('../utils/drugInteractions');

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, q, statut, alerte, categorie } = req.query;
    const filter = {};
    if (statut) filter.statut = statut;
    if (categorie) filter.categorie = { $regex: categorie, $options: 'i' };
    if (q) filter.$or = [
      { nom_commercial: { $regex: q, $options: 'i' } },
      { dci: { $regex: q, $options: 'i' } },
      { fabricant: { $regex: q, $options: 'i' } },
    ];
    if (alerte === 'stock' || alerte === 'rupture') filter.$expr = { $lte: ['$stock_actuel', '$seuil_alerte'] };
    if (alerte === 'peremption') {
      const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      filter.date_peremption = { $lte: in30days };
    }
    const total = await Medication.countDocuments(filter);
    const medications = await paginate(Medication.find(filter).sort('nom_commercial'), page, limit);
    res.json({ success: true, total, medications, medicaments: medications });
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const meds = await Medication.find({});
    const now = Date.now();
    const in30 = new Date(now + 30 * 24 * 3600 * 1000);
    const ruptures  = meds.filter(m => m.stock_actuel === 0).length;
    const critiques = meds.filter(m => m.stock_actuel > 0 && m.stock_actuel < m.stock_minimum * 0.3).length;
    const bas       = meds.filter(m => m.stock_actuel >= m.stock_minimum * 0.3 && m.stock_actuel < m.stock_minimum).length;
    const expires   = meds.filter(m => m.date_peremption && new Date(m.date_peremption) < now).length;
    const imminents = meds.filter(m => m.date_peremption && new Date(m.date_peremption) >= now && new Date(m.date_peremption) <= in30).length;
    const valeur_stock = meds.reduce((s, m) => s + m.stock_actuel * (m.prix_vente || 0), 0);
    res.json({ success: true, kpis: { total: meds.length, ruptures, critiques, bas, expires, imminents, valeur_stock, ventes_jour: 0, ventes_mois: 0 } });
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
    // Décrémenter le stock pour chaque article vendu
    for (const item of items) {
      await Medication.findByIdAndUpdate(item.medicament_id, {
        $inc: { stock_actuel: -Math.abs(item.quantite) },
      });
    }
    const total = items.reduce((s, i) => s + (i.prix_unitaire || 0) * i.quantite, 0);
    await logAction({ utilisateur: req.user._id, action: 'VENTE', module: 'pharmacy', ip: req.ip, message: `Vente ${numero} — ${total} CFA` });
    emitDashboardUpdate();
    res.status(201).json({ success: true, vente: { numero, client, mode_paiement, items, total, date: new Date() } });
  } catch (err) { next(err); }
};

exports.getCommandes = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, statut } = req.query;
    const filter = statut ? { statut } : {};
    const total = await Commande.countDocuments(filter);
    const raw = await paginate(Commande.find(filter).sort('-createdAt'), page, limit);
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

    const { receptions } = req.body; // [{ index, quantite_recue }]
    for (const r of (receptions || [])) {
      const ligne = commande.lignes[r.index];
      if (!ligne) continue;
      const recues = Math.min(ligne.quantite, (ligne.quantite_recue || 0) + (r.quantite_recue || 0));
      ligne.quantite_recue = recues;
      if (ligne.medicament) {
        const med = await Medication.findById(ligne.medicament);
        if (med) {
          med.stock_actuel += (r.quantite_recue || 0);
          med.mouvements.push({ type: 'entree', quantite: r.quantite_recue || 0, reference: commande.numero, notes: `Réception commande ${commande.numero}`, utilisateur: req.user._id });
          med.statut = med.stock_actuel > 0 && med.statut === 'rupture' ? 'disponible' : med.statut;
          await med.save();
        }
      }
    }

    const totalRecu = commande.lignes.every(l => l.quantite_recue >= l.quantite);
    const auMoinsUnRecu = commande.lignes.some(l => l.quantite_recue > 0);
    commande.statut = totalRecu ? 'recu' : (auMoinsUnRecu ? 'recu_partiel' : commande.statut);
    if (totalRecu) commande.date_reception = new Date();

    await commande.save();
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'pharmacy', entite_id: commande._id, ip: req.ip, message: `Réception ${commande.statut === 'recu' ? 'complète' : 'partielle'} — ${commande.numero}` });
    emitDashboardUpdate();
    res.json({ success: true, commande });
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
    res.json({ success: true, medication: med });
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

exports.update = async (req, res, next) => {
  try {
    const med = await Medication.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!med) return res.status(404).json({ success: false, message: 'Médicament introuvable.' });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'pharmacy', entite_id: med._id, ip: req.ip, message: `Fiche médicament modifiée : ${med.nom_commercial}` });
    res.json({ success: true, medication: med });
  } catch (err) { next(err); }
};

exports.uploadPhoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier fourni.' });
    const url = `/uploads/medications/${req.file.filename}`;
    const med = await Medication.findByIdAndUpdate(req.params.id, { photo: url }, { new: true });
    if (!med) return res.status(404).json({ message: 'Médicament introuvable.' });
    res.json({ success: true, photo: url, medication: med });
  } catch (err) { next(err); }
};

exports.mouvement = async (req, res, next) => {
  try {
    const { type, quantite, reference, notes } = req.body;
    const med = await Medication.findById(req.params.id);
    if (!med) return res.status(404).json({ success: false, message: 'Médicament introuvable.' });

    if (['sortie','dispensation','perte','peremption'].includes(type) && med.stock_actuel < quantite)
      return res.status(400).json({ success: false, message: 'Stock insuffisant.' });

    const delta = ['entree','retour'].includes(type) ? quantite : -quantite;
    med.stock_actuel += delta;
    med.mouvements.push({ type, quantite, reference, notes, utilisateur: req.user._id });

    if (med.stock_actuel <= 0) med.statut = 'rupture';
    else if (med.statut === 'rupture') med.statut = 'disponible';

    await med.save();
    await logAction({ utilisateur: req.user._id, action: 'STOCK_MOUVEMENT', module: 'pharmacy', entite_id: med._id, ip: req.ip, message: `${type} x${quantite} — ${med.nom_commercial}` });
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
    if (prescription.statut !== 'active')
      return res.status(400).json({ success: false, message: 'Ordonnance déjà dispensée ou expirée.' });

    // Seules les lignes reliées à une fiche Medication (catalogue) impactent le
    // stock — une ligne saisie en texte libre (medicament_nom sans medicament)
    // ne peut pas être rapprochée d'un produit sans risquer un mauvais match.
    const lignesAvecStock = prescription.lignes.filter(l => l.medicament);
    const medicamentsById = new Map();
    for (const ligne of lignesAvecStock) {
      const id = ligne.medicament.toString();
      if (!medicamentsById.has(id)) {
        const med = await Medication.findById(id);
        if (med) medicamentsById.set(id, med);
      }
    }

    // Vérifier tout le stock nécessaire avant d'écrire quoi que ce soit —
    // on ne veut pas décrémenter certaines lignes puis échouer sur les suivantes.
    const insuffisants = [];
    for (const ligne of lignesAvecStock) {
      const med = medicamentsById.get(ligne.medicament.toString());
      const quantite = Math.abs(ligne.quantite || 0);
      if (med && quantite > 0 && med.stock_actuel < quantite) {
        insuffisants.push(`${med.nom_commercial} (stock: ${med.stock_actuel}, requis: ${quantite})`);
      }
    }
    if (insuffisants.length) {
      return res.status(400).json({
        success: false,
        message: `Stock insuffisant pour dispenser cette ordonnance : ${insuffisants.join(', ')}.`,
      });
    }

    for (const ligne of lignesAvecStock) {
      const med = medicamentsById.get(ligne.medicament.toString());
      const quantite = Math.abs(ligne.quantite || 0);
      if (!med || quantite === 0) continue;

      med.stock_actuel -= quantite;
      med.mouvements.push({
        type: 'dispensation',
        quantite,
        reference: prescription.numero_rx,
        notes: `Dispensation ordonnance ${prescription.numero_rx}`,
        utilisateur: req.user._id,
      });
      med.statut = med.stock_actuel <= 0 ? 'rupture' : (med.statut === 'rupture' ? 'disponible' : med.statut);
      await med.save();
    }

    prescription.statut = 'dispensee';
    prescription.dispensee_par = req.user._id;
    prescription.date_dispensation = new Date();

    // Interactions médicamenteuses — base partagée (utils/drugInteractions.js)
    const meds = prescription.lignes.map(l => l.medicament_nom?.toLowerCase() || '');
    prescription.interactions_detectees = detectInteractions(meds);

    await prescription.save();
    await logAction({ utilisateur: req.user._id, action: 'DISPENSE', module: 'pharmacy', entite_id: prescription._id, ip: req.ip });
    emitActivity({ module: 'pharmacy', action: 'Dispensation ordonnance', detail: prescription.numero_rx, icon: '💊', userId: req.user._id, userName: `${req.user.prenom} ${req.user.nom}` });
    emitDashboardUpdate();
    res.json({ success: true, prescription });
  } catch (err) { next(err); }
};
