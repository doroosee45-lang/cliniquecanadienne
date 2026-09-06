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

**Écart réel, partiellement résolu (Correction 4, 6 sept. 2026)** : `Consultation.prescriptions[]` et `Consultation.examens_complementaires[]` restent des sous-documents **texte libre** (aucun `ref` — le schéma `Consultation` lui-même n'a pas changé). Mais depuis Correction 4, à la clôture d'une consultation (statut `terminee`), chaque ligne de `examens_complementaires[]` dont le libellé correspond **exactement** à l'un des 9 libellés curatés de `backend/utils/examLibelleVersCatalogue.js` (même liste que la facturation Sous-phase 5.7) génère réellement un `LabResult` ou `ImagingResult`, avec son champ `consultation` renseigné — le pont existe désormais **pour ces cas reconnus**. Les examens saisis en texte libre sans correspondance (la majorité probable des saisies réelles, le catalogue curaté étant volontairement restreint) restent non pontés — jamais un rattachement inventé. `Prescription.consultation` fait le même lien depuis T5.2, sans cette limite (toute ligne de prescription génère une vraie `Prescription`).

> Ancien point d'attention "reporté à la Phase 6" du plan directeur (voir `cartographie-modules.md` §6, `relationships.md` constat #4) : traité par anticipation, partiellement, sur demande explicite (Correction 4) plutôt que d'attendre cette phase. Ce qui reste pour une Phase 6 éventuelle : ponter aussi les examens hors catalogue curaté — nécessiterait de migrer la saisie vers une sélection dans le vrai catalogue plutôt que du texte libre, un chantier de refonte UI distinct.

## 3. Consultation → Laboratoire / Imagerie

`LabResult` et `ImagingResult` référencent `patient`, `medecin_prescripteur` (User) et, depuis Correction 12 (FLOW-003) puis Correction 4 pour les cas reconnus, `consultation` (optionnel — renseigné uniquement quand une correspondance catalogue exacte a permis la génération automatique, voir §2). Pour tout le reste (examens créés hors de ce pont, ou dont le libellé n'a pas de correspondance), le lien entre une consultation et les examens qu'elle prescrit reste **une saisie humaine indépendante** (le personnel de laboratoire/imagerie recrée la demande à partir du même patient), pas une chaîne de références en base. Idem pour `Echographie` (`patient` seulement — renommé depuis `patient_ref`, DATA-003 —, décision 0003 ; pas concernée par le pont de Correction 4, qui ne couvre que Laboratoire/Radiology).

> Même écart que §2, partiellement résolu par Correction 4 pour les mêmes raisons.

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
DossierChirurgical (patient — renommé depuis patient_id, ADR-0006 —, chirurgien_id — porte AUSSI la programmation bloc :
                     salle_prevue, date_intervention_prev, statut)
   → Complication[] / Bilan[] / SuiviPostop[] (dossier_chirurgical_id, requis)
```

**Écart réel** (voir `relationships.md` §5) : `decision` inclut `'hospitalisation'` mais aucun champ ne relie `DossierChirurgical` à `Hospitalization`. Contrairement à Urgences (résolu par l'ADR-0005), **cet écart n'est pas encore traité** — reporté à la Phase 9 (Hospitalisation → Chirurgie → Bloc) du plan directeur. Ne pas automatiser ni créer de champ de liaison avant cette phase.

## 6. Facturation

`Invoice.lignes[].categorie` est un **enum texte** (`consultation`/`hospitalisation`/`laboratoire`/`imagerie`/`pharmacie`/`autre`), **jamais une référence** vers le document clinique d'origine (pas de `consultation_id`/`hospitalization_id` sur `Invoice` ou ses lignes). La facturation est donc une saisie indépendante qui catégorise la prestation par type, sans lien structurel vers l'enregistrement clinique exact qui l'a motivée. `analytics.controller.js::getReport` utilise cette catégorisation pour la répartition des revenus par service — une agrégation par catégorie déclarée, pas une jointure réelle.

> **Point d'attention reporté à la Phase 3** du plan directeur — ne pas corriger avant cette phase (voir `cartographie-modules.md` §6).

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

> **Point d'attention reporté à la Phase 21** du plan directeur — ne pas corriger avant cette phase (voir `cartographie-modules.md` §6, `relationships.md` constat #3).
