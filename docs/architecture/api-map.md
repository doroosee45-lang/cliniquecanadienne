# Carte des API — MediSync

**Statut :** Référence vivante (Phase 1). Mappe chaque préfixe monté dans `backend/routes/index.js` vers son fichier de routes, son/ses contrôleur(s), les rôles autorisés (`authorize(...)`, tels que déclarés dans le code) et le(s) modèle(s) principal(aux) manipulé(s). Ne détaille pas chaque endpoint individuel — voir le fichier de routes cité pour le détail exact des verbes/chemins.

| Préfixe (`/api/...`) | Fichier de routes | Contrôleur(s) | Rôles autorisés (résumé réel) | Modèle(s) principal(aux) |
|---|---|---|---|---|
| `/auth` | `auth.routes.js` | `auth.controller`, `googleAuth.controller` | public (login/register) + compte authentifié pour le reste | User |
| `/dashboard` | `dashboard.routes.js` | `dashboard.controller` | superadmin (route générique + superadmin) ; adminclinique/medecin/infirmier/laborantin/pharmacien/comptable/radiologue/receptionniste sur leur route dédiée respective | Patient, Appointment, Consultation, Hospitalization, Urgence, LabResult, ImagingResult, Invoice, Depense, Medication, Prescription, User |
| `/patients` | `patients.routes.js` | `patients.controller` | Lecture : superadmin/adminclinique/medecin/infirmier/laborantin/radiologue/pharmacien/comptable/receptionniste (`CAN_READ`) ; création : + receptionniste (`CAN_CREATE`) ; écriture : superadmin/adminclinique/medecin/infirmier/receptionniste (`CAN_WRITE`) ; suppression : superadmin/adminclinique | Patient |
| `/appointments` | `appointments.routes.js` | `appointments.controller` | Écriture : superadmin/adminclinique/medecin/infirmier/receptionniste (`CAN_WRITE`) ; suppression : superadmin/adminclinique | Appointment |
| `/recurring` | `recurring.routes.js` | `recurring.controller` | superadmin/adminclinique/medecin/infirmier/receptionniste (`CAN_WRITE`) | RecurringProtocol |
| `/consultations` | `consultations.routes.js` | `consultations.controller` | Lecture : superadmin/adminclinique/medecin/infirmier (`CAN_READ`) ; écriture : superadmin/medecin(/infirmier selon action) | Consultation |
| `/hospitalization` | `hospitalization.routes.js` | `hospitalization.controller` | superadmin/adminclinique/medecin/infirmier (`CAN_WRITE`, toutes routes) | Hospitalization, Room, Urgence |
| `/laboratory` | `laboratory.routes.js` | `laboratory.controller` | Lecture : superadmin/adminclinique/medecin/infirmier/laborantin (`CAN_READ`) ; validation/dispense : superadmin/laborantin ou superadmin/medecin selon action | LabResult, ExamCatalogue |
| `/radiology` | `radiology.routes.js` | `radiology.controller` | Lecture : superadmin/adminclinique/medecin/infirmier/radiologue (`CAN_READ`) ; rapport/validation : superadmin/radiologue ou superadmin/medecin/radiologue selon action | ImagingResult, ExamCatalogue |
| `/echographie` | `echographie.routes.js` | `echographieController` | superadmin/adminclinique/medecin/infirmier/radiologue/sage_femme (`CAN`) | Echographie |
| `/pharmacy` | `pharmacy.routes.js` | `pharmacy.controller` | Lecture : superadmin/adminclinique/pharmacien/medecin/infirmier (`CAN_READ`) ; gestion stock/commandes : superadmin/adminclinique/pharmacien (`CAN_MANAGE`) | Medication, Commande, Prescription |
| `/prescriptions` | `prescriptions.routes.js` | `prescriptions.controller` | Consultation/écriture : superadmin/medecin/infirmier ; lecture élargie + dispensation : + adminclinique/pharmacien | Prescription |
| `/finance` | `finance.routes.js` | `finance.controller` | superadmin/adminclinique/comptable (`CAN_ACCESS`, toutes routes) | Invoice, Depense |
| `/hr` | `hr.routes.js` | `hr.controller` | Gestion : superadmin/adminclinique (`ADMIN`) ; certaines lectures ouvertes à tout le personnel non-patient (`STAFF` = tous rôles sauf patient) | Staff, Salaire |
| `/messages` | `messages.routes.js` | `messages.controller` | tout compte authentifié (pas de restriction de rôle — accès conditionné à l'appartenance à la conversation) | Conversation |
| `/notifications` | `notifications.routes.js` | `notifications.controller` | tout compte authentifié (scope = ses propres notifications) | Notification |
| `/audit` | `audit.routes.js` | `audit.controller` | superadmin uniquement (`ADMIN`) | AuditLog |
| `/archives` | `archive.routes.js` | `archive.controller` | superadmin/adminclinique (`ADMIN`) | ArchiveEntry |
| `/documents` | `document.routes.js` | `document.controller` | superadmin/adminclinique (`ADMIN`) | Document |
| `/analytics` | `analytics.routes.js` | `analytics.controller` | superadmin/adminclinique (`roles`) ; `/analytics/global` réservé **superadmin uniquement** | Patient, Appointment, Consultation, Invoice, Depense, Pregnancy, Delivery, Prescription, LabResult, ImagingResult, Urgence, Medication |
| `/settings` (+ alias `/admin`) | `settings.routes.js` | `settings.controller` | Paramètres système : superadmin uniquement ; gestion générale : superadmin/adminclinique (`ADMIN`) ; certaines lectures ouvertes à tout le personnel non-patient (`STAFF`) | Setting |
| `/chirurgie` | `chirurgieRoutes.js` | `chirurgieController` | Gestion : superadmin/adminclinique/medecin (`CHIR_MANAGE`) ; lecture élargie : + infirmier (`CHIR_ROLES`) | DossierChirurgical, Complication, Bilan |
| `/blocoperatoire` | `blocoperatoire.routes.js` | `blocoperatoireController` | Gestion : superadmin/adminclinique/medecin (`BLOC_MANAGE`) ; lecture élargie : + infirmier (`BLOC_ROLES`) | DossierChirurgical |
| `/portal` | `portal.routes.js` | `portal.controller` | **patient uniquement** (`authorize('patient')`) | Patient (scope strict au compte connecté), Appointment, Prescription, LabResult, ImagingResult, Invoice, Notification, Consultation |
| `/ai` | `ai.routes.js` | `ai.controller` | superadmin/adminclinique/medecin (+ infirmier sur certaines routes) | AIPrediction |
| `/maternite` | `maternity.routes.js` | `maternityController` | superadmin/adminclinique/medecin/infirmier/sage_femme (`CAN`) | Pregnancy, Delivery, Newborn |
| `/pediatrie` | `pediatrie.routes.js` | `pediatrieController` | superadmin/adminclinique/medecin/infirmier/sage_femme (`CAN`) | Child, PediatricConsultation |
| `/urgences` | `urgences.routes.js` | `urgencesController` | superadmin/adminclinique/medecin/infirmier/sage_femme (`CAN`) | Urgence |
| `/ambulances` | `ambulances.routes.js` | `ambulances.controller` | superadmin/adminclinique/medecin/infirmier/sage_femme (`CAN`) | Ambulance |

## Notes de lecture

- **`superadmin` a accès à toutes les routes sans exception** — confirmé sur chaque fichier de routes revu ; aucune route ne l'exclut.
- **`adminclinique` a un accès quasi équivalent à `superadmin`** sur les modules cliniques/financiers, à trois exceptions notables : `/audit` (superadmin seul), `/settings` racine (superadmin seul pour les paramètres système), `/analytics/global` (superadmin seul, restriction volontaire de la Phase Dashboard).
- **`/portal` est le seul groupe de routes réservé à un rôle unique non administratif** (`patient`) — cohérent avec le périmètre strict du portail patient (jamais de donnée d'un autre patient, jamais de statistique globale).
- Cette carte est un résumé des rôles **au niveau route** (`authorize(...)` déclaré dans le fichier de routes) — elle ne remplace pas une lecture du contrôleur pour les cas où un filtre de portée supplémentaire s'applique à l'intérieur du contrôleur lui-même (ex. `medecinStats`/`receptionnisteStats` filtrent en plus par `req.user._id`, `portal.controller.js` filtre systématiquement par le dossier Patient lié au compte connecté).
