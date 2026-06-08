const ArchiveEntry    = require('../models/ArchiveEntry');
const Patient         = require('../models/Patient');
const Consultation    = require('../models/Consultation');
const Hospitalization = require('../models/Hospitalization');
const LabResult       = require('../models/LabResult');
const ImagingResult   = require('../models/ImagingResult');
const DossierChirurgical = require('../models/DossierChirurgical');
const Invoice         = require('../models/Invoice');
const Prescription    = require('../models/Prescription');
const Setting         = require('../models/Setting');
const { logAction }   = require('../utils/helpers');

// ─── Seuils d'archivage automatique (en jours) ────────────────
const SEUILS = {
  hospitalisation: 30,
  laboratoire:     90,
  imagerie:        90,
  financier:       90,
  prescription:    30,
};

function octetsVersLisible(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} Go`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} Mo`;
  return `${Math.round(n / 1e3)} Ko`;
}

// ─── Moissonnage : crée les entrées d'archive depuis les modules
async function harvestArchivables() {
  const now = new Date();
  const ago = (days) => new Date(now - days * 24 * 3600 * 1000);

  async function upsert(data) {
    try {
      await ArchiveEntry.updateOne(
        { source_id: data.source_id, source_model: data.source_model },
        { $setOnInsert: data },
        { upsert: true }
      );
    } catch { /* doublon ignoré */ }
  }

  // 1. Patients inactifs
  const patientsInactifs = await Patient.find({ statut: 'inactif' })
    .select('_id nom prenom numero_dossier updatedAt').lean();
  for (const p of patientsInactifs) {
    await upsert({
      titre: `Dossier — ${p.prenom} ${p.nom}`,
      description: `N° dossier : ${p.numero_dossier || '—'}`,
      categorie: 'patient', source_model: 'Patient', source_id: p._id,
      patient: p._id, patient_nom: `${p.prenom} ${p.nom}`,
      date_archivage: p.updatedAt, priorite: 'normale', tags: ['patient','inactif'],
    });
  }

  // 2. Hospitalisations terminées anciennes
  const hospits = await Hospitalization.find({
    statut: { $in: ['sorti','transfere','decede'] },
    updatedAt: { $lt: ago(SEUILS.hospitalisation) },
  }).populate('patient','nom prenom').select('_id patient updatedAt diagnostic_principal').lean();
  for (const h of hospits) {
    const nom = h.patient ? `${h.patient.prenom} ${h.patient.nom}` : 'Patient';
    await upsert({
      titre: `Hospitalisation — ${nom}`, description: h.diagnostic_principal || 'Séjour terminé',
      categorie: 'hospitalisation', source_model: 'Hospitalization', source_id: h._id,
      patient: h.patient?._id, patient_nom: nom,
      date_archivage: h.updatedAt, priorite: 'basse', tags: ['hospitalisation','sorti'],
    });
  }

  // 3. Résultats labo validés anciens
  const labs = await LabResult.find({
    statut: 'valide', date_validation: { $lt: ago(SEUILS.laboratoire) },
  }).select('_id patient patient_nom date_validation').lean();
  for (const l of labs) {
    await upsert({
      titre: `Résultat labo — ${l.patient_nom || 'Patient'}`,
      description: `Validé le ${l.date_validation ? new Date(l.date_validation).toLocaleDateString('fr-FR') : '—'}`,
      categorie: 'laboratoire', source_model: 'LabResult', source_id: l._id,
      patient: l.patient, patient_nom: l.patient_nom || '—',
      date_archivage: l.date_validation, priorite: 'basse', tags: ['labo','valide'],
    });
  }

  // 4. Imagerie validée ancienne
  const imgs = await ImagingResult.find({
    statut: { $in: ['valide','rapporte'] }, date_validation: { $lt: ago(SEUILS.imagerie) },
  }).select('_id patient patient_nom type_examen date_validation').lean();
  for (const i of imgs) {
    await upsert({
      titre: `Imagerie — ${i.type_examen || 'Examen'} — ${i.patient_nom || 'Patient'}`,
      description: 'Rapport validé',
      categorie: 'imagerie', source_model: 'ImagingResult', source_id: i._id,
      patient: i.patient, patient_nom: i.patient_nom || '—',
      date_archivage: i.date_validation, priorite: 'basse', tags: ['imagerie','valide'],
    });
  }

  // 5. Dossiers chirurgicaux clôturés
  const chirs = await DossierChirurgical.find({ statut: 'cloture' })
    .select('_id patient_id patient_nom date_intervention_reelle type_intervention').lean();
  for (const c of chirs) {
    await upsert({
      titre: `Chirurgie — ${c.type_intervention || 'Intervention'} — ${c.patient_nom || '—'}`,
      description: 'Dossier clôturé',
      categorie: 'chirurgie', source_model: 'DossierChirurgical', source_id: c._id,
      patient: c.patient_id, patient_nom: c.patient_nom || '—',
      date_archivage: c.date_intervention_reelle, priorite: 'normale', tags: ['chirurgie','cloture'],
    });
  }

  // 6. Factures payées/annulées anciennes
  const factures = await Invoice.find({
    statut: { $in: ['payee','annulee'] }, date_facture: { $lt: ago(SEUILS.financier) },
  }).select('_id patient patient_nom numero_facture montant_ttc date_facture statut').lean();
  for (const f of factures) {
    await upsert({
      titre: `Facture ${f.numero_facture} — ${f.patient_nom || 'Patient'}`,
      description: `${f.statut === 'payee' ? 'Payée' : 'Annulée'} — ${(f.montant_ttc || 0).toLocaleString('fr-FR')} CFA`,
      categorie: 'financier', source_model: 'Invoice', source_id: f._id,
      patient: f.patient, patient_nom: f.patient_nom || '—',
      date_archivage: f.date_facture, priorite: 'basse', tags: ['facture', f.statut],
    });
  }

  // 7. Ordonnances expirées / dispensées
  const ordos = await Prescription.find({
    statut: { $in: ['expiree','dispensee','annulee'] },
    date_prescription: { $lt: ago(SEUILS.prescription) },
  }).select('_id patient numero_rx date_prescription statut').lean();
  for (const o of ordos) {
    await upsert({
      titre: `Ordonnance ${o.numero_rx || '—'}`,
      description: `Statut : ${o.statut}`,
      categorie: 'document', source_model: 'Prescription', source_id: o._id,
      patient: o.patient, date_archivage: o.date_prescription,
      priorite: 'basse', tags: ['ordonnance', o.statut],
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/archives/stats
// ═══════════════════════════════════════════════════════════════
exports.getStats = async (req, res, next) => {
  try {
    await harvestArchivables();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [catCounts, archivesMois, derniere, total] = await Promise.all([
      ArchiveEntry.aggregate([{ $group: { _id: '$categorie', count: { $sum: 1 } } }]),
      ArchiveEntry.countDocuments({ date_archivage: { $gte: startOfMonth } }),
      ArchiveEntry.findOne().sort('-date_archivage').select('date_archivage').lean(),
      ArchiveEntry.countDocuments(),
    ]);

    const cats = {};
    catCounts.forEach(c => { cats[c._id] = c.count; });
    const taille_estimee = total * 512 * 1024;

    res.json({
      success: true,
      kpis: {
        total,
        archives_mois:    archivesMois,
        taille_totale:    octetsVersLisible(taille_estimee),
        derniere_op:      derniere?.date_archivage
          ? new Date(derniere.date_archivage).toLocaleDateString('fr-FR') : '—',
        patients:         cats['patient']         || 0,
        consultations:    cats['consultation']    || 0,
        hospitalisations: cats['hospitalisation'] || 0,
        labo:             cats['laboratoire']     || 0,
        imagerie:         cats['imagerie']        || 0,
        examens:          (cats['laboratoire'] || 0) + (cats['imagerie'] || 0),
        chirurgies:       cats['chirurgie']       || 0,
        financier:        cats['financier']       || 0,
        documents:        cats['document']        || 0,
      },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/archives
// ═══════════════════════════════════════════════════════════════
exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, q, categorie, service, date_debut, date_fin, statut } = req.query;
    const filter = {};
    if (q)         filter.$or = [
      { titre:       { $regex: q, $options: 'i' } },
      { patient_nom: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
    ];
    if (categorie) filter.categorie = categorie;
    if (statut)    filter.statut    = statut;
    if (date_debut || date_fin) {
      filter.date_archivage = {};
      if (date_debut) filter.date_archivage.$gte = new Date(date_debut);
      if (date_fin)   filter.date_archivage.$lte = new Date(date_fin);
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await ArchiveEntry.countDocuments(filter);
    const archives = await ArchiveEntry.find(filter)
      .sort('-date_archivage')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, archives, total });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// POST /api/archives  — archivage manuel
// ═══════════════════════════════════════════════════════════════
exports.create = async (req, res, next) => {
  try {
    const { titre, description, categorie, patient, patient_nom, priorite, tags } = req.body;
    const archive = await ArchiveEntry.create({
      titre, description,
      categorie:      categorie || 'document',
      patient:        patient   || undefined,
      patient_nom:    patient_nom || '—',
      priorite:       priorite   || 'normale',
      tags:           tags || [],
      archive_par:    req.user?._id,
      date_archivage: new Date(),
    });
    await logAction({
      utilisateur: req.user?._id, action: 'ARCHIVE_CREATION', module: 'archive',
      entite_id: archive._id, ip: req.ip, message: `Archive créée : ${titre}`,
    });
    res.status(201).json({ success: true, archive });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// POST /api/archives/:id/restore
// ═══════════════════════════════════════════════════════════════
exports.restore = async (req, res, next) => {
  try {
    const { motif } = req.body;
    const archive = await ArchiveEntry.findByIdAndUpdate(
      req.params.id,
      { statut: 'restauré', restaure_par: req.user?._id, restaure_at: new Date(), motif_restauration: motif },
      { new: true }
    );
    if (!archive) return res.status(404).json({ success: false, message: 'Archive introuvable.' });

    // Réactiver le patient source si applicable
    if (archive.source_model === 'Patient' && archive.source_id) {
      await Patient.findByIdAndUpdate(archive.source_id, { statut: 'actif' });
    }

    await logAction({
      utilisateur: req.user?._id, action: 'ARCHIVE_RESTAURATION', module: 'archive',
      entite_id: archive._id, ip: req.ip,
      message: `Archive restaurée : ${archive.titre}${motif ? ` — ${motif}` : ''}`,
    });
    res.json({ success: true, archive });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// DELETE /api/archives/:id
// ═══════════════════════════════════════════════════════════════
exports.remove = async (req, res, next) => {
  try {
    const archive = await ArchiveEntry.findByIdAndDelete(req.params.id);
    if (!archive) return res.status(404).json({ success: false, message: 'Archive introuvable.' });
    await logAction({
      utilisateur: req.user?._id, action: 'ARCHIVE_SUPPRESSION', module: 'archive',
      entite_id: req.params.id, ip: req.ip,
      message: `Archive supprimée définitivement : ${archive.titre}`,
    });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// POST /api/archives/bulk-restore
// ═══════════════════════════════════════════════════════════════
exports.bulkRestore = async (req, res, next) => {
  try {
    const { ids = [] } = req.body;
    await ArchiveEntry.updateMany(
      { _id: { $in: ids } },
      { statut: 'restauré', restaure_par: req.user?._id, restaure_at: new Date() }
    );
    await logAction({
      utilisateur: req.user?._id, action: 'ARCHIVE_RESTAURATION_GROUPEE', module: 'archive',
      ip: req.ip, message: `${ids.length} archives restaurées en masse`,
    });
    res.json({ success: true, count: ids.length });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// POST /api/archives/bulk-delete
// ═══════════════════════════════════════════════════════════════
exports.bulkDelete = async (req, res, next) => {
  try {
    const { ids = [] } = req.body;
    await ArchiveEntry.deleteMany({ _id: { $in: ids } });
    await logAction({
      utilisateur: req.user?._id, action: 'ARCHIVE_SUPPRESSION_GROUPEE', module: 'archive',
      ip: req.ip, message: `${ids.length} archives supprimées en masse`,
    });
    res.json({ success: true, count: ids.length });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/archives/export
// ═══════════════════════════════════════════════════════════════
exports.exportAll = async (req, res, next) => {
  try {
    const { format = 'json', categorie } = req.query;
    const filter = {};
    if (categorie) filter.categorie = categorie;
    const archives = await ArchiveEntry.find(filter).sort('-date_archivage').lean();

    await logAction({
      utilisateur: req.user?._id, action: 'ARCHIVE_EXPORT', module: 'archive',
      ip: req.ip, message: `Export ${format} — ${archives.length} archives`,
    });

    if (format === 'csv') {
      const csv = [
        'Titre,Categorie,Patient,Statut,Date archivage,Priorite',
        ...archives.map(a =>
          `"${a.titre}","${a.categorie}","${a.patient_nom || ''}","${a.statut}","${a.date_archivage ? new Date(a.date_archivage).toLocaleDateString('fr-FR') : ''}","${a.priorite}"`
        ),
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="archives.csv"');
      return res.send('﻿' + csv);
    }

    res.json({ success: true, count: archives.length, archives });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// PUT /api/archives/config  — sauvegarder config archivage auto
// ═══════════════════════════════════════════════════════════════
exports.updateConfig = async (req, res, next) => {
  try {
    const config = req.body;
    await Setting.findOneAndUpdate(
      { cle: 'archive_auto_config' },
      { cle: 'archive_auto_config', valeur: config, updated_by: req.user?._id },
      { upsert: true }
    );
    res.json({ success: true, config });
  } catch (err) { next(err); }
};
