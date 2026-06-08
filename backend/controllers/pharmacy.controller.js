const Medication = require('../models/Medication');
const Prescription = require('../models/Prescription');
const { logAction, paginate } = require('../utils/helpers');
const { emitActivity, emitDashboardUpdate } = require('../utils/socket');

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
  res.json({ success: true, commandes: [], total: 0 });
};

exports.createCommande = async (req, res, next) => {
  try {
    const year = new Date().getFullYear();
    const numero = `BC-${year}-${String(Date.now()).slice(-5)}`;
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'pharmacy', ip: req.ip, message: `Bon de commande ${numero}` });
    res.status(201).json({ success: true, commande: { ...req.body, numero, statut: 'brouillon', date: new Date() } });
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
    res.json({ success: true, medication: med });
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

    prescription.statut = 'dispensee';
    prescription.dispensee_par = req.user._id;
    prescription.date_dispensation = new Date();

    // Detect drug interactions (simple rule-based)
    const meds = prescription.lignes.map(l => l.medicament_nom?.toLowerCase() || '');
    const interactions = [];
    if (meds.includes('warfarine') && meds.includes('aspirine'))
      interactions.push({ medicaments: ['Warfarine','Aspirine'], risque: 'Élevé', description: 'Risque hémorragique majeur' });
    prescription.interactions_detectees = interactions;

    await prescription.save();
    await logAction({ utilisateur: req.user._id, action: 'DISPENSE', module: 'pharmacy', entite_id: prescription._id, ip: req.ip });
    res.json({ success: true, prescription });
  } catch (err) { next(err); }
};
