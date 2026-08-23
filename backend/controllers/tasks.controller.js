const Task = require('../models/Task');
const { logAction } = require('../utils/helpers');

// AUDIT-11-8 — Administration.jsx (loadAll) appelle déjà GET /admin/tasks,
// jusqu'ici inexistant (repli silencieux sur une liste vide). Pas de
// liste blanche de champs sur create/update : endpoint déjà réservé à
// ADMIN (superadmin/adminclinique, seuls rôles à même accéder à la page
// Administration), même principe que createService/createInsurance
// (settings.controller.js) — la liste blanche protège un document partagé
// entre plusieurs rôles, pas le cas ici.
exports.getTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find().populate('assignee', 'nom prenom').sort('-createdAt');
    res.json({ success: true, tasks });
  } catch (err) { next(err); }
};

exports.createTask = async (req, res, next) => {
  try {
    const task = await Task.create({ ...req.body, created_by: req.user._id });
    await task.populate('assignee', 'nom prenom');
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'tasks', entite_id: task._id, ip: req.ip, message: `Nouvelle tâche : ${task.titre}` });
    res.status(201).json({ success: true, task });
  } catch (err) { next(err); }
};

// Administration.jsx::"→ Avancer" cycle en_attente→en_cours→termine→en_attente
// côté frontend et envoie le statut déjà calculé — validé ici contre l'énumération
// réelle du modèle plutôt que d'accepter une valeur arbitraire.
const VALID_STATUTS = ['en_attente', 'en_cours', 'termine', 'annule'];

exports.updateStatut = async (req, res, next) => {
  try {
    const { statut } = req.body;
    if (!VALID_STATUTS.includes(statut)) {
      return res.status(400).json({ success: false, message: `Statut invalide. Valeurs acceptées : ${VALID_STATUTS.join(', ')}.` });
    }
    const avant = await Task.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Tâche introuvable.' });

    const task = await Task.findByIdAndUpdate(req.params.id, { statut }, { new: true }).populate('assignee', 'nom prenom');
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'tasks', entite_id: task._id, ip: req.ip, message: `Statut tâche « ${task.titre} » : ${avant.statut} → ${statut}`, avant, apres: task.toObject() });
    res.json({ success: true, task });
  } catch (err) { next(err); }
};
