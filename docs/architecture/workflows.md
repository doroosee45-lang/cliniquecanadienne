# Workflows métier réels — MediSync

**Statut :** Référence vivante (Phase 1). Décrit les parcours **réellement implémentés** dans le code (contrôleurs + modèles), pas des parcours cibles. Chaque fois qu'une étape attendue n'est pas réellement reliée en base, c'est signalé explicitement — cohérent avec `relationships.md`.

## 1. Urgences → Hospitalisation (ADR-0005)

```
Urgence créée (patient optionnel, patient_nom en repli)
   → Décision médicale (Urgence.decision)
       → decision = 'hospitalisation'
           → admission_status = 'preparation'      (automatique, urgencesController.js::update)
       → decision retiré avant création réelle
           → admission_status = 'annulee'           (automatique, sauf si déjà 'terminee')
   → Action humaine explicite : "Préparer l'admission" (Urgences.jsx)
   → POST /hospitalization { patient, urgence_id, ... }
       → 409 si une hospitalisation est déjà active pour ce urgence_id
       → 201 → Urgence.admission_status = 'terminee' (automatique, définitif)
```

Jamais de création automatique de `Hospitalization` à la seule pose de `decision`. Voir ADR-0005 pour le détail complet et le protocole de test.

## 2. Rendez-vous → Consultation → Ordonnance → Dispensation

```
Appointment (patient, medecin, service)
   → Consultation (appointment optionnel — une consultation peut exister sans RDV, ex. urgence)
       → Prescription (consultation optionnel — une ordonnance peut aussi être créée hors consultation)
           → lignes[].medicament → Medication (optionnel — ligne texte libre possible)
           → statut : brouillon → active/publiee → dispensee (pharmacy.controller.js::dispenser)
               → décrémente Medication.stock_actuel (atomique, AUDIT-04b)
```

**Écart réel** : `Consultation.prescriptions[]` et `Consultation.examens_complementaires[]` sont des sous-documents **texte libre** (aucun `ref`). Une consultation ne référence donc jamais les `Prescription`/`LabResult`/`ImagingResult` réellement créés à partir d'elle — seul `Prescription.consultation` fait le lien, et uniquement dans ce sens. Remonter d'une consultation vers les examens qu'elle a déclenchés n'est pas une requête directe possible aujourd'hui.

## 3. Consultation → Laboratoire / Imagerie

`LabResult` et `ImagingResult` référencent `patient` et `medecin_prescripteur` (User), **jamais `Consultation`**. Le lien entre une consultation et les examens qu'elle prescrit est **une saisie humaine indépendante** (le personnel de laboratoire/imagerie recrée la demande à partir du même patient), pas une chaîne de références en base. Idem pour `Echographie` (patient_ref seulement, décision 0003).

## 4. Maternité

```
Pregnancy (patient_id optionnel, suivi prénatal via cpns[] embarqué)
   → Delivery (grossesse_id, patient_id — type_accouchement : voie_basse/cesarienne/forceps/ventouse)
       → Newborn (accouchement_id, grossesse_id, patient_id optionnel)
           → Child (child_id) — SEULEMENT sur action explicite du personnel
               (POST /maternite/nouveau-nes/:id/dossier-enfant, R-10d)
               → jamais de création automatique de dossier enfant
                   → PediatricConsultation (child_id, pas de lien direct à Patient)
```

## 5. Chirurgie / Bloc opératoire

```
DossierChirurgical (patient_id, chirurgien_id — porte AUSSI la programmation bloc :
                     salle_prevue, date_intervention_prev, statut)
   → Complication[] / Bilan[] / SuiviPostop[] (dossier_chirurgical_id, requis)
```

**Écart réel** (voir `relationships.md` §5) : `decision` inclut `'hospitalisation'` mais aucun champ ne relie `DossierChirurgical` à `Hospitalization`. Contrairement à Urgences (résolu par l'ADR-0005), **cet écart n'est pas encore traité** — reporté à la Phase 9 (Hospitalisation → Chirurgie → Bloc) du plan directeur. Ne pas automatiser ni créer de champ de liaison avant cette phase.

## 6. Facturation

`Invoice.lignes[].categorie` est un **enum texte** (`consultation`/`hospitalisation`/`laboratoire`/`imagerie`/`pharmacie`/`autre`), **jamais une référence** vers le document clinique d'origine (pas de `consultation_id`/`hospitalization_id` sur `Invoice` ou ses lignes). La facturation est donc une saisie indépendante qui catégorise la prestation par type, sans lien structurel vers l'enregistrement clinique exact qui l'a motivée. `analytics.controller.js::getReport` utilise cette catégorisation pour la répartition des revenus par service — une agrégation par catégorie déclarée, pas une jointure réelle.

## 7. Temps réel (tous modules)

```
Mutation métier (create/update dans un contrôleur)
   → emitDashboardUpdate() (utils/socket.js)
       → invalidateStatsCache() (flush du cache 30s, utils/dashboardCache.js)
       → Socket.IO broadcast 'dashboard:refresh' (tous les clients connectés)
           → useRealtimeRefresh() (frontend, hook partagé)
               → refetch immédiat de la page ouverte
```

Mécanisme unique et partagé — confirmé câblé sur 15+ contrôleurs (appointments, consultations, laboratory, radiology, pharmacy, finance, hospitalization, urgences, hr, chirurgie, blocoperatoire, echographie, maternité, pédiatrie, archive). Ne jamais dupliquer ce mécanisme (règle déjà appliquée lors des Phases Dashboard/4).

`emitActivity()` (même fichier) alimente en parallèle le flux « Activité récente » (`activity:new`), consommé par `SocketContext.jsx` — mécanisme séparé de `dashboard:refresh` mais émis par les mêmes contrôleurs, aux mêmes points de mutation.

## 8. Notifications

`createNotification()` (`utils/helpers.js`) crée un document `Notification` (`destinataire`→User) à des points de mutation ciblés (ex. confirmation d'admission, sortie d'hôpital — `hospitalization.controller.js`). Consommé par le portail patient (`portal.controller.js::getNotifications`) et la cloche de notifications de l'interface staff. Relation à `User`, jamais directement à `Patient` (un patient est notifié via son **compte** `User`, pas via son dossier clinique).

## 9. Archivage

`ArchiveEntry` ne référence pas directement le document archivé par un `ref` Mongoose typé : `source_model` (nom du modèle, String) + `source_id` (ObjectId) forment une référence polymorphe résolue manuellement par le contrôleur. C'est un **instantané + pointeur**, pas une relation vivante — contrairement à tout le reste du projet, qui utilise systématiquement des `ref:` typés à une seule collection. À connaître avant d'étendre l'archivage à une nouvelle catégorie de document.
