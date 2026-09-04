const Patient      = require('../models/Patient');
const Appointment  = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const LabResult    = require('../models/LabResult');
const ImagingResult= require('../models/ImagingResult');
const Invoice      = require('../models/Invoice');
const Notification = require('../models/Notification');
const Consultation = require('../models/Consultation');
const User         = require('../models/User');
const { logAction, countUnreadConversations } = require('../utils/helpers');

// R-07 — Trouve le dossier patient lié au User connecté. patient_id
// d'abord : référence directe par ObjectId, stable même si Patient.email
// change après coup (staff pouvant éditer un dossier patient sans que
// User.email soit resynchronisé — l'email seul peut alors désigner le
// mauvais dossier, ou plus aucun). Repli sur l'email uniquement pour les
// comptes dont patient_id n'est pas encore peuplé (vérifié sur les
// données réelles avant cette migration : 4 comptes sur 7 — pas un cas
// rare). Si patient_id est renseigné mais ne résout plus rien (dossier
// supprimé), c'est une anomalie de données réelle, pas un simple compte
// non lié — journalisée plutôt que silencieusement absorbée par le repli.
const findPatient = async (user) => {
  if (user.patient_id) {
    const patient = await Patient.findById(user.patient_id);
    if (patient) return patient;
    await logAction({
      utilisateur: user._id, action: 'DATA_ANOMALY', module: 'portal',
      message: `patient_id (${user.patient_id}) renseigné sur le compte ${user.email} mais aucun dossier Patient correspondant — repli sur l'email`,
      statut: 'echec',
    });
  }
  return Patient.findOne({ email: user.email.toLowerCase().trim() });
};

// ── ME : profil + statistiques ────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const [nbRdv, nbOrd, nbLabo, nbImag, nbFact, nbFactImpayees] = await Promise.all([
      Appointment.countDocuments({ patient: patient._id, statut: { $in: ['planifie','confirme'] } }),
      Prescription.countDocuments({ patient: patient._id, statut: 'active' }),
      LabResult.countDocuments({ patient: patient._id, statut: 'valide' }),
      ImagingResult.countDocuments({ patient: patient._id, statut: { $in: ['rapporte','valide'] } }),
      Invoice.countDocuments({ patient: patient._id }),
      Invoice.countDocuments({ patient: patient._id, statut: { $in: ['emise','partiellement_payee'] } }),
    ]);

    res.json({
      success: true,
      patient,
      must_change_password: req.user.must_change_password || false,
      stats: { nbRdv, nbOrd, nbLabo, nbImag, nbFact, nbFactImpayees },
    });
  } catch (err) { next(err); }
};

// ── RENDEZ-VOUS ───────────────────────────────────────────────────────────────
exports.getAppointments = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const appointments = await Appointment.find({ patient: patient._id })
      .populate('medecin', 'nom prenom specialite')
      .populate('service', 'nom')
      .sort('-date_heure')
      .lean();
    res.json({ success: true, appointments });
  } catch (err) { next(err); }
};

// ── ORDONNANCES ───────────────────────────────────────────────────────────────
// AUDIT-P7-7 — aucun filtre de statut : un brouillon (statut par défaut à la
// création, avant que le médecin ne la publie) était visible au patient
// comme n'importe quelle ordonnance réelle. 'active' est inclus en plus de
// la liste 'publiee'/'dispensee'/'expiree' suggérée par l'audit initial :
// c'est un état réellement atteint par de vraies ordonnances (seed.js,
// plusieurs tests), pas un résidu — même défense en profondeur déjà
// appliquée par prescriptions.controller.js::dispenser() (accepte
// 'publiee' ET 'active', cf. audit2-9/P7-3). Exclut brouillon (le bug) et
// annulee (ordonnance annulée, ne doit pas apparaître comme valide).
exports.getPrescriptions = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const prescriptions = await Prescription.find({ patient: patient._id, statut: { $in: ['active', 'publiee', 'dispensee', 'expiree'] } })
      .populate('medecin', 'nom prenom specialite')
      .populate('lignes.medicament', 'nom forme')
      .sort('-date_prescription')
      .lean();
    res.json({ success: true, prescriptions });
  } catch (err) { next(err); }
};

// ── RÉSULTATS LABORATOIRE ────────────────────────────────────────────────────
exports.getLabResults = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const labResults = await LabResult.find({ patient: patient._id, statut: 'valide' })
      .populate('medecin_prescripteur', 'nom prenom specialite')
      .populate('examen', 'nom code categorie')
      .sort('-date_validation')
      .lean();
    res.json({ success: true, labResults });
  } catch (err) { next(err); }
};

// ── IMAGERIES ─────────────────────────────────────────────────────────────────
exports.getImaging = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const imaging = await ImagingResult.find({ patient: patient._id, statut: { $in: ['rapporte','valide'] } })
      .populate('medecin_prescripteur', 'nom prenom')
      .populate('radiologue', 'nom prenom')
      .sort('-date_rapport')
      .lean();
    res.json({ success: true, imaging });
  } catch (err) { next(err); }
};

// ── FACTURES ──────────────────────────────────────────────────────────────────
exports.getInvoices = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const invoices = await Invoice.find({ patient: patient._id })
      .sort('-date_facture')
      .lean();
    res.json({ success: true, invoices });
  } catch (err) { next(err); }
};

// ── DASHBOARD (agrégat pour Dashboard.jsx::PatientDashboard) ─────────────────
// AUDIT-DASHBOARD-PATIENT — Dashboard.jsx appelle déjà GET /portal/dashboard en
// repli pour role==='patient', mais cette route n'existait pas : chaque appel
// échouait en 404, silencieusement absorbé par le frontend (`catch { result =
// {} }`), donc le dashboard patient affichait TOUJOURS l'état vide sur chacun
// de ses widgets (KPI à 0, aucun RDV, aucune ordonnance…), quel que soit
// l'état réel du dossier. Même principe de périmètre strict que le reste de
// ce contrôleur (findPatient) : uniquement les données du patient connecté,
// jamais une statistique globale de la clinique.
exports.getDashboard = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });

    const now = new Date();
    // Statuts couvrant un RDV pas encore soldé (ni terminé, ni annulé, ni absent).
    const RDV_ACTIFS = ['planifie','en_attente','confirme','arrive','en_consultation','en_cours','reporte'];

    const [
      rdv_a_venir,
      ordonnances_actives,
      resultats_labo_dispo,
      resultats_imagerie_dispo,
      factures_impayees,
      consultations_total,
      messages_non_lus,
      prochainRdvDoc,
      rdvListeRaw,
      ordonnancesRaw,
      labResultsRaw,
      imagingRaw,
      facturesRaw,
      derniereConsultation,
    ] = await Promise.all([
      Appointment.countDocuments({ patient: patient._id, date_heure: { $gte: now }, statut: { $in: RDV_ACTIFS } }),
      Prescription.countDocuments({ patient: patient._id, statut: { $in: ['active','publiee'] } }),
      LabResult.countDocuments({ patient: patient._id, statut: 'valide' }),
      ImagingResult.countDocuments({ patient: patient._id, statut: { $in: ['rapporte','valide'] } }),
      Invoice.countDocuments({ patient: patient._id, statut: { $in: ['emise','partiellement_payee'] } }),
      Consultation.countDocuments({ patient: patient._id }),
      // Même règle que receptionnisteStats (dashboard.controller.js) : un
      // membre de la conversation avec au moins un message qu'il n'a ni
      // envoyé, ni encore lu — AUDIT-ELEVE-5, requête factorisée après la
      // migration de Conversation.messages vers la collection Message.
      countUnreadConversations(req.user._id),
      Appointment.findOne({ patient: patient._id, date_heure: { $gte: now }, statut: { $in: RDV_ACTIFS } })
        .populate('medecin', 'nom')
        .sort('date_heure'),
      Appointment.find({ patient: patient._id }).populate('medecin', 'nom').sort('-date_heure').limit(10),
      Prescription.find({ patient: patient._id, statut: { $in: ['active','publiee','dispensee','expiree'] } })
        .sort('-date_prescription').limit(10),
      LabResult.find({ patient: patient._id, statut: 'valide' }).populate('examen', 'nom').sort('-date_validation').limit(6),
      ImagingResult.find({ patient: patient._id, statut: { $in: ['rapporte','valide'] } }).sort('-date_rapport').limit(6),
      Invoice.find({ patient: patient._id }).sort('-date_facture').limit(8),
      Consultation.findOne({ patient: patient._id }).sort('-date_consultation').select('signes_vitaux date_consultation'),
    ]);

    const medecin_ref = patient.medecin_referent
      ? await User.findById(patient.medecin_referent).select('nom prenom specialite telephone')
      : null;

    const prochain_rdv = prochainRdvDoc ? {
      date: new Date(prochainRdvDoc.date_heure).toLocaleDateString('fr-FR'),
      heure: new Date(prochainRdvDoc.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      type: prochainRdvDoc.type || 'consultation',
      medecin: prochainRdvDoc.medecin?.nom || '—',
    } : null;

    const mes_rdv = rdvListeRaw.map(r => ({
      date: r.date_heure,
      heure: new Date(r.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      type: r.type || 'consultation',
      medecin: r.medecin?.nom || '—',
      statut: r.statut,
    }));

    const ordonnances = ordonnancesRaw.map(o => ({
      medicament: (o.lignes || []).map(l => l.medicament_nom).filter(Boolean).join(', ') || '—',
      posologie: (o.lignes || [])[0]?.posologie || '—',
      fin: o.date_expiration,
    }));

    const resultats = [
      ...labResultsRaw.map(r => ({
        type: 'laboratoire',
        examen: r.examen?.nom || 'Analyse de laboratoire',
        date: r.date_validation || r.date_prescription,
        statut: 'disponible',
      })),
      ...imagingRaw.map(r => ({
        type: 'radiologie',
        examen: r.type_examen || 'Imagerie médicale',
        date: r.date_rapport || r.date_prescription,
        statut: 'disponible',
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

    const factures = facturesRaw.map(f => ({
      date: f.date_facture,
      prestation: f.service_label || f.lignes?.[0]?.libelle || 'Facture',
      montant: f.montant_ttc,
      statut: f.statut === 'payee' ? 'payee' : (f.montant_paye > 0 ? 'en_attente' : 'impayee'),
    }));

    const sv = derniereConsultation?.signes_vitaux || {};
    const constantes = (sv.poids || sv.tension_systolique || sv.glycemie || sv.temperature) ? {
      poids: sv.poids,
      tension: (sv.tension_systolique && sv.tension_diastolique) ? `${sv.tension_systolique}/${sv.tension_diastolique}` : undefined,
      glycemie: sv.glycemie,
      temp: sv.temperature,
      taille: sv.taille,
      fc: sv.pouls,
      date: derniereConsultation.date_consultation,
    } : {};

    // Alertes réelles uniquement : aucune injection de contenu clinique
    // sensible (ex. résultat critique) côté patient sans validation médicale.
    const alertes = [];
    if (factures_impayees > 0) {
      alertes.push({ type: 'warn', msg: `${factures_impayees} facture(s) impayée(s)`, heure: 'À régler' });
    }
    const ordonnanceExpireBientot = ordonnancesRaw.find(o =>
      o.date_expiration && new Date(o.date_expiration) > now && (new Date(o.date_expiration) - now) < 3 * 86400000
    );
    if (ordonnanceExpireBientot) {
      alertes.push({ type: 'info', msg: 'Une ordonnance active arrive bientôt à expiration', heure: 'À renouveler' });
    }

    res.json({ success: true, stats: {
      kpis: {
        rdv_a_venir, ordonnances_actives,
        resultats_disponibles: resultats_labo_dispo + resultats_imagerie_dispo,
        factures_impayees, consultations_total, messages_non_lus,
      },
      prochain_rdv, mes_rdv, ordonnances, resultats, factures, alertes, constantes,
      medecin_ref: medecin_ref ? {
        nom: medecin_ref.nom, prenom: medecin_ref.prenom,
        specialite: medecin_ref.specialite, telephone: medecin_ref.telephone,
      } : null,
    }});
  } catch (err) { next(err); }
};

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ destinataire: req.user._id })
      .sort('-createdAt')
      .limit(50)
      .lean();
    res.json({ success: true, notifications });
  } catch (err) { next(err); }
};

// ── MARQUER NOTIFICATIONS LUES ────────────────────────────────────────────────
exports.markNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { destinataire: req.user._id, lu: false },
      { lu: true }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── MODIFIER PROFIL ───────────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const patient = await findPatient(req.user);
    if (!patient) return res.status(404).json({ success: false, message: 'Dossier patient introuvable.' });
    const avant = patient.toObject();

    // Champs modifiables par le patient lui-même
    const allowed = ['telephone', 'adresse', 'contact_urgence'];
    const update  = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    // AUDIT-D2 (ticket 0002) — date_naissance/sexe ne sont modifiables par le
    // patient QUE pour compléter un dossier créé via Google OAuth (T3.1,
    // profil_a_completer:true, ces deux champs alors absents) — jamais en
    // usage général, pour ne pas ouvrir un canal de modification libre de
    // l'identité administrative d'un patient déjà admis normalement (gérée
    // par la réception dans ce cas). Une fois les deux renseignés,
    // profil_a_completer repasse à false.
    if (patient.profil_a_completer) {
      if (req.body.date_naissance !== undefined) update.date_naissance = req.body.date_naissance;
      if (req.body.sexe !== undefined) update.sexe = req.body.sexe;
      const dateFinale = update.date_naissance !== undefined ? update.date_naissance : patient.date_naissance;
      const sexeFinal  = update.sexe !== undefined ? update.sexe : patient.sexe;
      if (dateFinale && sexeFinal) update.profil_a_completer = false;
    }

    const updated = await Patient.findByIdAndUpdate(patient._id, update, { new: true, runValidators: true });

    // Sync téléphone dans User si modifié
    if (update.telephone) {
      await User.findOneAndUpdate({ email: req.user.email }, { telephone: update.telephone });
    }

    await logAction({
      utilisateur: req.user._id, action: 'UPDATE', module: 'portal',
      entite_id: patient._id, ip: req.ip,
      message: `Patient ${patient.nom} ${patient.prenom} a mis à jour son profil`,
      avant, apres: updated,
    });

    res.json({ success: true, patient: updated });
  } catch (err) { next(err); }
};

// T9.9 — même cache court (30s) que dashboard.controller.js pour les 9
// tableaux de bord staff, appliqué ici pour la même raison : Dashboard.jsx
// interroge cet endpoint au montage, toutes les 30s, et à chaque événement
// dashboard:refresh — sans cache, chaque patient connecté déclenche la même
// dizaine de requêtes en boucle. Clé de cache par utilisateur (personalized)
// puisque la réponse est strictement propre au patient connecté.
const { cacheStats } = require('../utils/dashboardCache');
exports.getDashboard = cacheStats('portalDashboard', true, exports.getDashboard);

// ── CHANGER MOT DE PASSE ──────────────────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect.' });

    user.password             = newPassword;
    user.must_change_password = false;
    await user.save();

    // T9.3 — pas de avant/apres ici, volontairement : le seul champ modifié
    // est `password` (hash bcrypt), et `must_change_password`. Journaliser un
    // instantané avant/après stockerait le hash de l'ancien ET du nouveau mot
    // de passe dans AuditLog, ce que R-08b/T3.3 ont justement cherché à
    // éliminer pour le mot de passe en clair — même logique appliquée ici par
    // précaution au hash, qui n'a pas besoin de circuler dans les logs pour
    // que cette action reste traçable (le message suffit).
    await logAction({
      utilisateur: req.user._id, action: 'UPDATE_PASSWORD', module: 'portal',
      ip: req.ip, message: `Patient ${user.email} a changé son mot de passe`,
    });

    res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
  } catch (err) { next(err); }
};
