const Setting      = require('../models/Setting');
const User         = require('../models/User');
const Staff        = require('../models/Staff');
const Service      = require('../models/Service');
const Insurance    = require('../models/Insurance');
const Patient      = require('../models/Patient');
const Appointment  = require('../models/Appointment');
const Consultation = require('../models/Consultation');
const Hospitalization = require('../models/Hospitalization');
const Invoice      = require('../models/Invoice');
const Depense      = require('../models/Depense');
const Room         = require('../models/Room');
const { logAction, createNotification } = require('../utils/helpers');
const mail = require('../utils/mail');
const {
  PROFESSIONAL_ROLES, PERMISSION_ACTIONS, DEFAULT_ROLES_PERMISSIONS,
  SETTING_KEY: PERMISSIONS_SETTING_KEY, enforceSuperadminSafeguard, getRolesPermissionsMatrix,
} = require('../utils/permissions');
const path = require('path');
const { runBackup } = require('../utils/backup');
const backupState = require('../utils/backupState');
const { forceDisconnectUser } = require('../utils/socket');

// NEW-001 (rapport de correction du 11 sept. 2026) — notif_smtp_pwd ne doit
// jamais apparaître en clair dans une réponse API ni dans le journal
// d'audit (GET /settings la renvoyait intégralement, et upsert()
// journalisait `${cle} = ${valeur}` sans distinction).
// MIGRATION-RESEND (13 sept. 2026) — utils/mail.js n'utilise plus ce
// paramètre (retiré avec le reste de l'ancien mécanisme SMTP applicatif),
// mais un Setting existant en base d'une installation antérieure peut
// toujours contenir une vraie valeur : le masquage reste nécessaire tant
// que ce document n'a pas été purgé, pas seulement pendant que le champ
// était activement utilisé. Liste extensible si d'autres paramètres secrets
// (ex. notif_sms_api_key, notif_whatsapp_token — signalés mais non traités
// ici, hors périmètre de NEW-001) devaient être couverts de la même façon.
const SECRET_SETTING_KEYS = ['notif_smtp_pwd'];
const SECRET_MASK = '••••••••';
const maskSecretSetting = (doc) => {
  if (!doc || !SECRET_SETTING_KEYS.includes(doc.cle)) return doc;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return { ...plain, valeur: plain.valeur ? SECRET_MASK : '' };
};

exports.getAll = async (req, res, next) => {
  try {
    const settings = await Setting.find().sort('groupe cle');
    res.json({ success: true, settings: settings.map(maskSecretSetting) });
  } catch (err) { next(err); }
};

exports.upsert = async (req, res, next) => {
  try {
    const { cle, valeur, type, groupe, description } = req.body;
    const avant = await Setting.findOne({ cle }).lean();
    // AUDIT-3.5 — le champ modifiable existait sur le modèle mais n'était
    // jamais vérifié : un paramètre marqué non modifiable pouvait être
    // écrasé par n'importe quel appel. Ne bloque que la modification d'un
    // paramètre EXISTANT explicitement verrouillé — la création (avant
    // inexistant) reste toujours possible.
    if (avant && avant.modifiable === false) {
      return res.status(403).json({ success: false, message: `Le paramètre "${cle}" n'est pas modifiable.` });
    }
    // NEW-001 — un paramètre secret renvoyé masqué (ci-dessus) puis
    // resoumis SANS modification reviendrait ici littéralement comme
    // SECRET_MASK : jamais écraser la vraie valeur stockée par le masque
    // lui-même. Un utilisateur qui n'a pas touché au champ ne modifie rien ;
    // toute autre valeur (nouveau mot de passe réel, ou chaîne vide pour
    // l'effacer explicitement) est enregistrée normalement.
    if (SECRET_SETTING_KEYS.includes(cle) && valeur === SECRET_MASK) {
      return res.json({ success: true, setting: maskSecretSetting(avant || { cle, valeur: '' }) });
    }
    const setting = await Setting.findOneAndUpdate(
      { cle }, { valeur, type, groupe, description }, { upsert: true, new: true }
    );
    const isSecret = SECRET_SETTING_KEYS.includes(cle);
    await logAction({ utilisateur: req.user._id, action: 'UPDATE_SETTING', module: 'settings', ip: req.ip, message: `${cle} = ${isSecret ? (valeur ? SECRET_MASK : '') : valeur}`, avant: isSecret ? maskSecretSetting(avant) : avant, apres: isSecret ? maskSecretSetting(setting) : setting });
    res.json({ success: true, setting: maskSecretSetting(setting) });
  } catch (err) { next(err); }
};

// AUDIT-M-A1 — User.service (référence désormais réelle, plus une chaîne
// libre) n'est qu'un repli : dès qu'un compte a une fiche Staff liée
// (Staff.utilisateur), c'est Staff.service qui fait foi (fiche RH plus
// riche, seule mise à jour par le module HR) — jamais les deux affichés
// séparément, jamais de conflit à arbitrer. Un seul aller-retour
// supplémentaire (Staff.find sur les utilisateurs listés) plutôt qu'une
// requête par utilisateur.
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort('role nom').select('-password').populate('service', 'nom').lean();
    const staffLinks = await Staff.find({ utilisateur: { $in: users.map(u => u._id) } })
      .select('utilisateur service').populate('service', 'nom').lean();
    const staffServiceByUser = new Map(staffLinks.map(s => [s.utilisateur.toString(), s.service]));
    const withResolvedService = users.map(u => ({
      ...u,
      service_effectif: staffServiceByUser.get(u._id.toString()) || u.service || null,
    }));
    res.json({ success: true, users: withResolvedService });
  } catch (err) { next(err); }
};

// AUDIT-11 (audit complet post-Phase 10) — liste blanche partagée par
// createUser ET updateUser : seuls les champs réellement envoyés par le
// formulaire Administration.jsx (EMPTY_USER) sont acceptables ici. Avant ce
// correctif, createUser transmettait req.body quasi tel quel (seuls
// mot_de_passe et password en étaient retirés) — un appel direct à cette
// route (superadmin uniquement, mais sans aucune défense en profondeur)
// pouvait positionner directement role, patient_id, tentatives_echouees,
// verrouille_jusqu_a, reset_password_token/expire, googleId ou preferences
// dès la création du compte. updateUser avait déjà reçu ce correctif lors
// de P2-1 ; createUser avait été manqué.
// must_change_password (AUDIT-P2-3, ticket 0003 piste 2) est ajouté
// explicitement : une case à cocher dédiée d'Administration.jsx le transmet
// désormais, c'est un chemin d'écriture légitime pour ce champ précis — pas
// un relâchement de la liste blanche.
const USER_WRITABLE_FIELDS = ['prenom', 'nom', 'email', 'telephone', 'role', 'service', 'statut', 'must_change_password'];

// AUDIT-ADMIN-P2 — role est dans USER_WRITABLE_FIELDS (nécessaire pour que
// createUser/updateUser fassent leur travail normal sur les 10 rôles
// professionnels), mais rien n'empêchait jusqu'ici d'y passer 'patient' :
// un compte créé/modifié par ce chemin générique n'a aucun dossier Patient
// lié (patient_id), contrairement aux 3 vrais chemins de création patient
// (patients.controller.js::create, ::activateAdmin, googleAuth.controller.js)
// qui garantissent tous ce lien. Le seul moyen de créer/faire évoluer un
// compte patient doit rester ces 3 chemins — jamais ce formulaire staff
// générique.
function refuseRolePatient(req, res) {
  if (req.body.role === 'patient') {
    res.status(400).json({ success: false, message: "Les comptes patients ne peuvent pas être créés ou modifiés depuis ce formulaire — utilisez le module Patients (création de dossier) ou l'auto-inscription Google." });
    return true;
  }
  return false;
}

exports.createUser = async (req, res, next) => {
  try {
    if (refuseRolePatient(req, res)) return;
    // Suite du balayage T5.2 — Administration.jsx envoie le mot de passe
    // saisi sous `mot_de_passe`, le schéma déclare `password` : User.create
    // (req.body) ignorait silencieusement ce champ, créant un compte sans
    // aucun mot de passe utilisable (le champ est requis à la création côté
    // formulaire, mais jamais réellement enregistré).
    const body = {};
    for (const field of USER_WRITABLE_FIELDS) {
      if (req.body[field] !== undefined) body[field] = req.body[field];
    }
    if (req.body.mot_de_passe) body.password = req.body.mot_de_passe;
    // AUDIT-M-A1 — service est désormais une vraie référence ObjectId — une
    // chaîne vide (aucun service sélectionné) doit rester "pas de service",
    // pas être castée.
    if (body.service === '') body.service = null;
    const user = await User.create(body);
    await user.populate('service', 'nom');
    await logAction({ utilisateur: req.user._id, action: 'CREATE_USER', module: 'admin', ip: req.ip, message: `Nouvel utilisateur: ${user.email}` });
    res.status(201).json({ success: true, user });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    if (refuseRolePatient(req, res)) return;
    // Même correctif que createUser — le formulaire d'édition réutilise le
    // même champ `mot_de_passe` (vide = ne pas changer, non vide = réinitialiser).
    const { mot_de_passe } = req.body;
    const password = mot_de_passe || undefined;
    const data = {};
    for (const field of USER_WRITABLE_FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    // AUDIT-M-A1 — même correctif que createUser (service est une vraie
    // référence ObjectId depuis ce chantier).
    if (data.service === '') data.service = null;
    const avant = await User.findById(req.params.id).select('role statut email').lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    const user = await User.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (password) { user.password = password; await user.save(); }
    await user.populate('service', 'nom');
    // Modification de compte utilisateur — traçabilité renforcée si le rôle
    // ou le statut change (élévation de privilèges, suspension...).
    await logAction({
      utilisateur: req.user._id, action: 'UPDATE_USER', module: 'admin', entite_id: user._id, ip: req.ip,
      avant: { role: avant.role, statut: avant.statut },
      apres: { role: user.role, statut: user.statut },
      message: `Utilisateur modifié : ${user.email}${avant.role !== user.role ? ` — rôle ${avant.role} → ${user.role}` : ''}${avant.statut !== user.statut ? ` — statut ${avant.statut} → ${user.statut}` : ''}${password ? ' — mot de passe réinitialisé' : ''}`,
    });

    // AUDIT-A-4 — un changement de rôle (élévation/rétrogradation de
    // privilèges) ou de statut (suspension...) était jusqu'ici invisible
    // pour l'intéressé, qui ne l'apprenait qu'en tombant dessus par hasard.
    // Suspendu = ne peut plus se connecter pour voir une notification
    // in-app, d'où l'email en plus, réservé à ce cas précis.
    if (avant.role !== user.role || avant.statut !== user.statut) {
      const changements = [];
      if (avant.role !== user.role) changements.push(`rôle : ${avant.role} → ${user.role}`);
      if (avant.statut !== user.statut) changements.push(`statut : ${avant.statut} → ${user.statut}`);
      const estSuspension = avant.statut !== user.statut && user.statut === 'suspendu';
      // CODE-004 (audit indépendant du 6 sept. 2026) — seul le passage à
      // 'suspendu' déclenchait un email ici, alors que 'inactif' bloque
      // tout autant la connexion (middleware/auth.js::protect exige
      // statut==='actif') : un admin qui désactive un compte via CE
      // formulaire (le seul chemin réellement utilisé par l'UI — voir
      // ticket 0024) en choisissant "Inactif" ne prévenait jusqu'ici jamais
      // l'intéressé par email, contrairement à deactivateUser() plus bas
      // (jamais appelée par l'UI) qui envoyait déjà un email pour ce cas.
      const estDesactivation = avant.statut !== user.statut && user.statut === 'inactif';
      await createNotification({
        destinataire: user._id,
        type:    (estSuspension || estDesactivation) ? 'warning' : 'info',
        titre:   'Votre compte a été modifié',
        message: `Un administrateur a modifié votre compte (${changements.join(', ')}).`,
        priorite: (estSuspension || estDesactivation) ? 'haute' : 'normale',
      });
      if (estSuspension && user.email) {
        await mail.sendAccountSuspendedEmail({ email: user.email, prenom: user.prenom, nom: user.nom });
      } else if (estDesactivation && user.email) {
        await mail.sendAccountDeactivatedEmail({ email: user.email, prenom: user.prenom, nom: user.nom });
      }
    }

    res.json({ success: true, user });
  } catch (err) { next(err); }
};

// AUDIT-ARCHIVAGE-B1 — remplace le handler inline de settings.routes.js
// (DELETE /users/:id), qui contournait entièrement ce contrôleur : aucun
// logAction, et un bug latent (findByIdAndUpdate sur un id inexistant
// renvoyait success:true silencieusement, sans jamais vérifier que
// l'utilisateur existait — corrigé ici, distinct du reste). Même
// traçabilité + notification + email que updateUser() ci-dessus pour un
// changement de statut suspendu (cohérence explicitement demandée), plutôt
// qu'un comportement différent selon PUT vs DELETE pour le même effet.
exports.deactivateUser = async (req, res, next) => {
  try {
    const avant = await User.findById(req.params.id).select('role statut email prenom nom').lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    const user = await User.findByIdAndUpdate(req.params.id, { statut: 'inactif' }, { new: true });
    await logAction({
      utilisateur: req.user._id, action: 'DEACTIVATE_USER', module: 'admin', entite_id: user._id, ip: req.ip,
      avant: { statut: avant.statut }, apres: { statut: user.statut },
      message: `Utilisateur désactivé : ${user.email}`,
    });

    if (avant.statut !== 'inactif') {
      await createNotification({
        destinataire: user._id,
        type: 'warning',
        titre: 'Votre compte a été désactivé',
        message: 'Un administrateur a désactivé votre compte.',
        priorite: 'haute',
      });
      if (user.email) {
        // CODE-004 (audit indépendant du 6 sept. 2026) — envoyait
        // sendAccountSuspendedEmail() (texte "suspendu... tant que cette
        // suspension n'est pas levée") alors que cette fonction fixe
        // statut:'inactif', une notion distincte de 'suspendu' dans
        // l'enum — message inexact envoyé à l'utilisateur. Corrigé.
        await mail.sendAccountDeactivatedEmail({ email: user.email, prenom: user.prenom, nom: user.nom });
      }
    }

    res.json({ success: true, message: 'Utilisateur désactivé.' });
  } catch (err) { next(err); }
};

// FORCE-LOGOUT-001 (rapport de clôture du 11 sept. 2026) — Audit.jsx
// ("Forcer" sur une session active) avait jusqu'ici aucune vraie révocation
// de session : le JWT restait valide jusqu'à expiration naturelle malgré le
// message de succès affiché. Distinct d'une suspension de compte
// (deactivateUser/updateUser statut) : le compte reste actif, seule la
// session déjà émise est invalidée — l'utilisateur peut se reconnecter
// immédiatement avec ses identifiants, contrairement à un compte suspendu.
// tokenVersion++ invalide tous les JWT déjà émis (middleware/auth.js::
// protect et server.js::io.use les revérifient désormais tous deux) ;
// forceDisconnectUser() coupe en plus immédiatement toute connexion
// Socket.IO déjà ouverte, en réutilisant la room privée existante.
exports.forceLogout = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save({ validateBeforeSave: false });

    // Aucune réponse de succès si l'écriture MongoDB elle-même a échoué —
    // save() ci-dessus aurait déjà levé une exception (capturée plus bas),
    // donc atteindre cette ligne garantit que tokenVersion est réellement
    // persisté avant toute notification/déconnexion.
    forceDisconnectUser(String(user._id));

    await logAction({
      utilisateur: req.user._id, action: 'FORCE_LOGOUT', module: 'audit',
      entite_id: user._id, ip: req.ip,
      message: `Déconnexion forcée de ${user.email} (tokenVersion → ${user.tokenVersion})`,
    });

    res.json({ success: true, message: `Session de ${user.email} révoquée — reconnexion requise.`, tokenVersion: user.tokenVersion });
  } catch (err) { next(err); }
};

exports.getServices = async (req, res, next) => {
  try {
    const services = await Service.find().populate('chef_service', 'nom prenom').sort('nom');
    res.json({ success: true, services });
  } catch (err) { next(err); }
};

exports.createService = async (req, res, next) => {
  try {
    const service = await Service.create(req.body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'settings', entite_id: service._id, ip: req.ip, message: `Nouveau service : ${service.nom}` });
    res.status(201).json({ success: true, service });
  } catch (err) { next(err); }
};

// ADM-01 (correction du 12 sept. 2026, audit indépendant) — l'audit
// maintient la majeure malgré la restriction ADMIN déjà en place sur ces
// routes : un accès admin authentifié reste, par exemple, un JWT volé ou un
// compte compromis — la restriction de rôle n'est pas une raison de se
// passer d'une liste blanche de champs sur une route d'écriture. Liste
// blanche ajoutée, même principe que APPT_CREATE_ALLOWED_FIELDS /
// NEWBORN_CREATE_ALLOWED_FIELDS : seuls les champs métier réellement
// éditables du formulaire de gestion des services sont acceptés ; _id,
// createdAt/updatedAt (gérés par { timestamps: true }) ne peuvent plus être
// écrasés par le corps de la requête.
const SERVICE_UPDATE_ALLOWED_FIELDS = ['nom', 'code', 'description', 'etage', 'couleur', 'chef_service', 'statut'];
function pickAllowedFields(body, allowed) {
  const out = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = body[key];
  }
  return out;
}
exports.updateService = async (req, res, next) => {
  try {
    const avant = await Service.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Service introuvable.' });
    const data = pickAllowedFields(req.body, SERVICE_UPDATE_ALLOWED_FIELDS);
    const service = await Service.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'settings', entite_id: service._id, ip: req.ip, message: `Service modifié : ${service.nom}`, avant, apres: service });
    res.json({ success: true, service });
  } catch (err) { next(err); }
};

exports.getRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find().sort('numero').lean();
    res.json({ success: true, rooms });
  } catch (err) { next(err); }
};

// Correction 3 (relecture du 5 sept. 2026, découverte pendant la
// Correction A / cout_total) — Room n'était peuplé que par utils/seed.js,
// aucune route POST/PUT n'existait pour créer ou modifier une chambre/un
// lit en production. Room.lits[].prix_par_jour est pourtant la vraie
// source de tarif branchée sur la facturation réelle à la sortie
// d'hospitalisation (hospitalization.controller.js::discharge) — sans UI
// de gestion, seules les chambres du seed initial peuvent jamais exister.
//
// validerLits — un lit sans prix_par_jour numérique et non-négatif ne doit
// jamais être accepté : c'est exactement le genre de donnée qui, si
// laissée invalide, forcerait plus tard un contournement par une valeur
// inventée côté facturation (le pattern déjà dénoncé par l'audit).
function validerLits(lits) {
  if (!Array.isArray(lits)) return 'Le champ lits doit être une liste.';
  for (const l of lits) {
    if (!l.numero || typeof l.numero !== 'string') return 'Chaque lit doit avoir un numéro.';
    if (l.prix_par_jour === undefined || l.prix_par_jour === null) continue; // 0 par défaut au schéma, autorisé
    const prix = Number(l.prix_par_jour);
    if (!Number.isFinite(prix) || prix < 0) return `Tarif invalide pour le lit ${l.numero} : doit être un nombre réel positif ou nul.`;
  }
  return null;
}

exports.createRoom = async (req, res, next) => {
  try {
    const { numero, service, type, etage, capacite, statut, lits } = req.body;
    if (!numero) return res.status(400).json({ success: false, message: 'Numéro de chambre obligatoire.' });
    const erreurLits = validerLits(lits || []);
    if (erreurLits) return res.status(400).json({ success: false, message: erreurLits });

    const room = await Room.create({
      numero, service: service || undefined, type, etage, capacite, statut,
      lits: (lits || []).map(l => ({
        numero: l.numero, type: l.type || 'standard', prix_par_jour: Number(l.prix_par_jour) || 0,
        equipements: l.equipements || [],
      })),
    });
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'settings', entite_id: room._id, ip: req.ip, message: `Nouvelle chambre : ${room.numero}` });
    res.status(201).json({ success: true, room });
  } catch (err) { next(err); }
};

exports.updateRoom = async (req, res, next) => {
  try {
    const avant = await Room.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Chambre introuvable.' });

    const { numero, service, type, etage, capacite, statut, lits } = req.body;
    if (lits !== undefined) {
      const erreurLits = validerLits(lits);
      if (erreurLits) return res.status(400).json({ success: false, message: erreurLits });

      // Un lit actuellement occupé par un vrai patient (attribution posée par
      // le workflow d'admission atomique, AUDIT-P7-5) ne doit jamais pouvoir
      // être retiré ou renuméroté silencieusement depuis ce formulaire de
      // gestion des chambres : seule la sortie réelle du patient (discharge)
      // libère un lit. Le tarif et les autres champs d'un lit occupé restent
      // modifiables ; seuls son numéro et sa présence sont protégés.
      const numerosSoumis = new Set(lits.map(l => l.numero));
      for (const litAvant of (avant.lits || [])) {
        if (litAvant.statut === 'occupe' && !numerosSoumis.has(litAvant.numero)) {
          return res.status(409).json({ success: false, message: `Le lit ${litAvant.numero} est occupé par un patient réel — il ne peut pas être supprimé ou renuméroté depuis cette interface.` });
        }
      }
    }

    const data = { numero, service, type, etage, capacite, statut };
    if (lits !== undefined) {
      // Préserve statut/patient_actuel réels des lits déjà occupés — seuls
      // numero/type/prix_par_jour/equipements sont réellement éditables ici.
      const avantParNumero = Object.fromEntries((avant.lits || []).map(l => [l.numero, l]));
      data.lits = lits.map(l => {
        const existant = avantParNumero[l.numero];
        return {
          numero: l.numero,
          type: l.type || existant?.type || 'standard',
          prix_par_jour: Number(l.prix_par_jour) || 0,
          equipements: l.equipements || existant?.equipements || [],
          statut: existant?.statut || 'libre',
          patient_actuel: existant?.patient_actuel,
        };
      });
    }

    const room = await Room.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'settings', entite_id: room._id, ip: req.ip, message: `Chambre modifiée : ${room.numero}`, avant, apres: room });
    res.json({ success: true, room });
  } catch (err) { next(err); }
};

exports.getInsurances = async (req, res, next) => {
  try {
    const insurances = await Insurance.find({ statut: 'actif' }).sort('nom');
    res.json({ success: true, insurances });
  } catch (err) { next(err); }
};

exports.createInsurance = async (req, res, next) => {
  try {
    const insurance = await Insurance.create(req.body);
    await logAction({ utilisateur: req.user._id, action: 'CREATE', module: 'settings', entite_id: insurance._id, ip: req.ip, message: `Nouvelle assurance : ${insurance.nom}` });
    res.status(201).json({ success: true, insurance });
  } catch (err) { next(err); }
};

// AUDIT-GLOBAL — Settings.jsx affichait un tableau d'assurances entièrement
// fabriqué (5 lignes codées en dur) et un bouton "Modifier" factice, alors
// que createInsurance/getInsurances existaient déjà réellement. Aucune
// route de modification n'existait — ajoutée ici, même style que ci-dessus.
// ADM-01 (correction du 12 sept. 2026, audit indépendant) — même
// raisonnement que updateService ci-dessus : liste blanche ajoutée malgré
// la restriction ADMIN déjà en place.
const INSURANCE_UPDATE_ALLOWED_FIELDS = ['nom', 'code', 'type', 'taux_prise_en_charge', 'plafond_mensuel', 'contact', 'statut'];
exports.updateInsurance = async (req, res, next) => {
  try {
    const avant = await Insurance.findById(req.params.id).lean();
    if (!avant) return res.status(404).json({ success: false, message: 'Assurance introuvable.' });
    const data = pickAllowedFields(req.body, INSURANCE_UPDATE_ALLOWED_FIELDS);
    const insurance = await Insurance.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    await logAction({ utilisateur: req.user._id, action: 'UPDATE', module: 'settings', entite_id: insurance._id, ip: req.ip, message: `Assurance modifiée : ${insurance.nom}`, avant, apres: insurance });
    res.json({ success: true, insurance });
  } catch (err) { next(err); }
};

// ── KPIs tableau de bord administration ──────────────────────
exports.getKpis = async (req, res, next) => {
  try {
    const now      = new Date();
    const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [
      total_patients,
      rdv_jour,
      consultations_jour,
      hospitalisations,
      personnel_present,
      factures_impayees,
      revenus_jour_agg,
      revenus_mensuels_agg,
      depenses_mensuelles_agg,
      rooms,
      users_by_role,
    ] = await Promise.all([
      Patient.countDocuments({ statut: { $ne: 'decede' } }),
      Appointment.countDocuments({ date_heure: { $gte: today, $lt: tomorrow }, statut: { $nin: ['annule','absent'] } }),
      Consultation.countDocuments({ date_consultation: { $gte: today, $lt: tomorrow } }),
      Hospitalization.countDocuments({ statut: 'en_cours' }),
      User.countDocuments({ statut: 'actif' }),
      Invoice.countDocuments({ statut: { $in: ['emise','partiellement_payee'] } }),
      Invoice.aggregate([
        { $match: { date_facture: { $gte: today, $lt: tomorrow }, statut: { $in: ['payee','partiellement_payee'] } } },
        { $group: { _id: null, total: { $sum: '$montant_ttc' } } },
      ]),
      Invoice.aggregate([
        { $match: { date_facture: { $gte: yearStart }, statut: 'payee' } },
        { $group: { _id: { mois: { $month: '$date_facture' } }, total: { $sum: '$montant_ttc' } } },
        { $sort: { '_id.mois': 1 } },
      ]),
      // FE-ADM-02 (correction du 12 sept. 2026, audit indépendant) —
      // Administration.jsx affichait des KPI "Revenus/Dépenses/Excédent"
      // codés en dur (26.8M/18.2M/8.6M, "mai 2025" figé), jamais calculés.
      // Même agrégation réelle que revenus_mensuels_agg ci-dessus, sur le
      // vrai modèle Depense (déjà utilisé par analytics.controller.js/
      // getFinancial, ANL-01).
      Depense.aggregate([
        { $match: { date: { $gte: yearStart } } },
        { $group: { _id: { mois: { $month: '$date' } }, total: { $sum: '$montant' } } },
        { $sort: { '_id.mois': 1 } },
      ]),
      // Room.statut (actif/maintenance/ferme) est un statut d'ouverture de la
      // chambre — la disponibilité réelle (libre/occupé) vit au niveau de
      // chaque lit (Room.lits[].statut), jamais sur la chambre elle-même.
      Room.find().select('statut type lits').lean(),
      User.aggregate([
        { $match: { statut: 'actif' } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ]);

    const revenus_par_mois = Array(12).fill(0);
    revenus_mensuels_agg.forEach(r => { revenus_par_mois[r._id.mois - 1] = r.total; });

    // FE-ADM-02 — voir Depense.aggregate ci-dessus.
    const depenses_par_mois = Array(12).fill(0);
    depenses_mensuelles_agg.forEach(d => { depenses_par_mois[d._id.mois - 1] = d.total; });

    const roleMap = {};
    users_by_role.forEach(r => { roleMap[r._id] = r.count; });

    res.json({
      success:            true,
      total_patients,
      rdv_jour,
      consultations_jour,
      hospitalisations,
      personnel_present,
      factures_impayees,
      alertes:            0,
      revenus_jour:       revenus_jour_agg[0]?.total || 0,
      revenus_par_mois,
      depenses_par_mois,
      rooms: {
        total:        rooms.length,
        // Comptage réel au niveau des lits (Room.lits[].statut), pas de la
        // chambre — voir hospitalization.controller.js::getStats pour la
        // même logique de référence.
        libres:       rooms.reduce((s, r) => s + (r.lits?.filter(l => l.statut === 'libre').length || 0), 0),
        occupees:     rooms.reduce((s, r) => s + (r.lits?.filter(l => l.statut === 'occupe').length || 0), 0),
        maintenance:  rooms.filter(r => r.statut === 'maintenance').length,
      },
      personnel_par_role: {
        medecins:    roleMap['medecin']    || 0,
        infirmiers:  roleMap['infirmier']  || 0,
        pharmaciens: roleMap['pharmacien'] || 0,
        autres:      (personnel_present) - (roleMap['medecin'] || 0) - (roleMap['infirmier'] || 0) - (roleMap['pharmacien'] || 0),
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// Sous-phase 5.5.b — Rôles & Permissions éditables
// Source de vérité unique (Setting{cle:'roles_permissions'}) remplaçant les
// deux constantes dupliquées et divergentes d'Administration.jsx et
// Settings.jsx — voir utils/permissions.js pour le détail de la fusion.
// ─────────────────────────────────────────────────────────────

// GET /settings/roles-permissions
exports.getRolesPermissions = async (req, res, next) => {
  try {
    const permissions = await getRolesPermissionsMatrix();
    res.json({ success: true, permissions, roles: PROFESSIONAL_ROLES, actions: PERMISSION_ACTIONS });
  } catch (err) { next(err); }
};

// PUT /settings/roles-permissions — authorize('superadmin') seul (routes),
// avec un second verrou ici : le garde-fou anti-verrouillage s'applique
// même si un jour une autre route en venait à appeler ce contrôleur.
exports.updateRolesPermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ success: false, message: 'Matrice de permissions manquante ou invalide.' });
    }
    const inconnu = Object.keys(permissions).filter(r => !PROFESSIONAL_ROLES.includes(r));
    if (inconnu.length) {
      return res.status(400).json({ success: false, message: `Rôle(s) inconnu(s) : ${inconnu.join(', ')}.` });
    }
    for (const [role, perms] of Object.entries(permissions)) {
      const invalides = Object.keys(perms || {}).filter(a => !PERMISSION_ACTIONS.includes(a));
      if (invalides.length) {
        return res.status(400).json({ success: false, message: `Action(s) inconnue(s) pour "${role}" : ${invalides.join(', ')}.` });
      }
    }

    const erreurGardeFou = enforceSuperadminSafeguard(permissions);
    if (erreurGardeFou) {
      return res.status(400).json({ success: false, message: erreurGardeFou });
    }

    const avant = await getRolesPermissionsMatrix();
    const setting = await Setting.findOneAndUpdate(
      { cle: PERMISSIONS_SETTING_KEY },
      { valeur: permissions, type: 'json', groupe: 'permissions', description: 'Matrice des permissions par rôle (Rôles & Permissions)' },
      { upsert: true, new: true }
    );
    await logAction({ utilisateur: req.user._id, action: 'UPDATE_SETTING', module: 'settings', ip: req.ip, message: 'Matrice de permissions modifiée', avant, apres: setting.valeur });
    res.json({ success: true, permissions: setting.valeur });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// Sous-phase 5.5.c — Sauvegarde externe (bouton "Sauvegarder" d'Audit.jsx)
// utils/backup.js existait déjà comme utilitaire CLI réel et testé
// (T9.11) mais sans la moindre route pour le déclencher. Volumétrie
// réelle mesurée avant exposition : 2383 documents / 49 collections sur la
// base actuelle — quelques secondes tout au plus, donc exposable en HTTP.
// Deux garde-fous ajoutés pour rendre l'exposition sûre : verrou
// anti-concurrence (backupState) et réponse asynchrone honnête (202 +
// statut "en_cours", jamais une requête HTTP bloquée le temps du backup).
// ─────────────────────────────────────────────────────────────

// POST /settings/backup — superadmin uniquement (donnée = export complet
// de la base). Répond immédiatement ; le travail réel se poursuit après la
// réponse, son résultat consultable via GET /settings/backup/status.
exports.triggerBackup = async (req, res, next) => {
  try {
    if (backupState.running) {
      return res.status(409).json({ success: false, message: 'Une sauvegarde est déjà en cours — réessayez une fois celle-ci terminée.', startedAt: backupState.startedAt });
    }
    backupState.running = true;
    backupState.startedAt = new Date().toISOString();
    backupState.finishedAt = null;
    backupState.lastError = null;

    const outDir = path.join(__dirname, '..', 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
    const uri = process.env.MONGO_URI;

    await logAction({ utilisateur: req.user._id, action: 'BACKUP_START', module: 'settings', ip: req.ip, message: `Sauvegarde déclenchée manuellement → ${outDir}` });

    // Volontairement non attendu ici (pas de `await`) : la réponse HTTP part
    // immédiatement, le travail réel (potentiellement plusieurs secondes,
    // amené à grandir avec la base) continue en tâche de fond.
    runBackup({ uri, outDir })
      .then((manifest) => {
        backupState.running = false;
        backupState.finishedAt = new Date().toISOString();
        backupState.lastManifest = manifest;
        logAction({ utilisateur: req.user._id, action: 'BACKUP_SUCCESS', module: 'settings', message: `Sauvegarde terminée → ${outDir} (${Object.values(manifest.collections).reduce((a, b) => a + b, 0)} document(s))` }).catch(() => {});
      })
      .catch((err) => {
        backupState.running = false;
        backupState.finishedAt = new Date().toISOString();
        backupState.lastError = err.message;
        logAction({ utilisateur: req.user._id, action: 'BACKUP_FAILURE', module: 'settings', message: `Échec de la sauvegarde → ${outDir} : ${err.message}`, statut: 'echec' }).catch(() => {});
      });

    res.status(202).json({ success: true, status: 'en_cours', message: 'Sauvegarde démarrée — consultez GET /settings/backup/status pour son avancement.', startedAt: backupState.startedAt });
  } catch (err) {
    backupState.running = false;
    next(err);
  }
};

// GET /settings/backup/status
exports.getBackupStatus = async (req, res, next) => {
  try {
    res.json({
      success: true,
      running: backupState.running,
      startedAt: backupState.startedAt,
      finishedAt: backupState.finishedAt,
      lastManifest: backupState.lastManifest,
      lastError: backupState.lastError,
    });
  } catch (err) { next(err); }
};
