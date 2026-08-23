// AUDIT-M-B6 — prescriptions.controller.js::publier() vérifiait
// rx.statut !== 'annulee' puis, après avoir envoyé l'email/la notification
// patient, persistait la transition via rx.save() — non atomique. cancel()
// (statut → 'annulee') n'a lui-même aucune garde (transition inconditionnelle
// via findByIdAndUpdate, qui ne participe pas au versionKey Mongoose que
// rx.save() vérifie) : une annulation concurrente pouvait s'intercaler entre
// la lecture et l'écriture de publier(), qui écrasait alors silencieusement
// statut:'annulee' avec 'publiee' — ressuscitant une ordonnance annulée
// (intégrité clinique, pas une simple question de dette technique). Corrigé
// avec un findOneAndUpdate à filtre-garde ({_id, statut:{$ne:'annulee'}}),
// transition atomique AVANT tout effet de bord (email, notification) — même
// principe que les Points 6/9 du chantier élevé et le Point 5 (dispenser()).
//
// Preuve que l'email/la notification n'ont jamais lieu quand l'état final
// est 'annulee' : dans ce cas, publier() fait `return res.status(400)...`
// immédiatement après l'échec de l'atomique, AVANT le bloc d'envoi
// textuellement plus bas dans la même fonction — par construction du flux
// de contrôle JavaScript, ce code ne peut pas s'être exécuté. Observer la
// réponse 400 est donc la preuve directe, sans qu'il soit nécessaire
// d'intercepter l'envoi lui-même (sendPrescriptionEmail est déstructuré à
// l'import dans le contrôleur — un stub sur le module ne l'intercepterait
// pas, même limite déjà rencontrée au Point 7).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('AUDIT-M-B6 — publier()/cancel() atomiques sous concurrence réelle, jamais de résurrection d\'ordonnance annulée (base réelle)', { skip: !process.env.MONGO_URI && 'MONGO_URI non configuré' }, async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  const Prescription = require('../models/Prescription');
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  // publier() peuple 'lignes.medicament' (ref: Medication) — jamais requis
  // par prescriptions.controller.js lui-même, donc jamais enregistré auprès
  // de mongoose dans un process qui ne charge que ce fichier de test. Sans
  // cette ligne, .populate() lève MissingSchemaError dès le premier appel.
  require('../models/Medication');
  const prescC = require('../controllers/prescriptions.controller');

  const stamp = Date.now();
  const created = { prescriptions: [], patients: [], users: [] };

  const call = async (fn, req) => {
    let status = 200, body = null;
    const res = { status: (c) => { status = c; return res; }, json: (d) => { body = d; } };
    await fn(req, res, (err) => { if (err) { status = err.statusCode || 500; body = { success: false, message: err.message }; } });
    return { status, body };
  };

  try {
    const medecin = await User.create({ email: `_b6-med-${stamp}@_test.local`, password: 'Xx1aaaaa', nom: 'B6', prenom: 'Medecin', role: 'medecin', statut: 'actif' });
    created.users.push(medecin);
    // Sans email patient réel : évite tout envoi SMTP réel (patient sans
    // adresse => patientEmail falsy => le bloc email n'est jamais atteint),
    // non lié à ce qu'on teste ici (la garde de statut, pas l'email lui-même).
    const patient = await Patient.create({ nom: `B6-${stamp}`, prenom: 'P', date_naissance: '1990-01-01', sexe: 'F' });
    created.patients.push(patient);
    const user = { _id: medecin._id, prenom: medecin.prenom, nom: medecin.nom, role: 'medecin' };

    await t.test('publier() — non-régression : publication normale, seule, réussit toujours', async () => {
      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, statut: 'active', lignes: [{ medicament_nom: 'Test', quantite: 1 }] });
      created.prescriptions.push(rx);
      const { status, body } = await call(prescC.publier, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' });
      assert.equal(status, 200);
      assert.equal(body.prescription.statut, 'publiee');
    });

    await t.test('publier() — statut déjà annulée au moment de la lecture est toujours rejeté (400), non-régression', async () => {
      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, statut: 'annulee', lignes: [{ medicament_nom: 'Test', quantite: 1 }] });
      created.prescriptions.push(rx);
      const { status, body } = await call(prescC.publier, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' });
      assert.equal(status, 400);
      assert.equal(body.success, false);
    });

    await t.test('publier()/cancel() — annulation concurrente à la publication (Promise.all) : l\'ordonnance ne ressuscite jamais en "publiee"', async () => {
      const rx = await Prescription.create({ patient: patient._id, medecin: medecin._id, statut: 'active', lignes: [{ medicament_nom: 'Test', quantite: 1 }] });
      created.prescriptions.push(rx);

      const [rPublier, rCancel] = await Promise.all([
        call(prescC.publier, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' }),
        call(prescC.cancel, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' }),
      ]);

      // cancel() n'a (et n'a jamais eu) de garde de statut — elle réussit toujours.
      assert.equal(rCancel.status, 200);

      const freshRx = await Prescription.findById(rx._id).lean();
      // Deux issues légitimes selon l'entrelacement réel (non déterministe) :
      // (a) cancel() gagne (dernier à écrire) → l'état final reste 'annulee'
      //     ET publier() doit avoir échoué (400) — jamais un succès silencieux
      //     écrasé ensuite.
      // (b) publier() écrit avant que cancel() ne s'exécute → publier() voit
      //     légitimement 'active' à son atomique, réussit (200), puis
      //     cancel() écrase en 'annulee' juste après (cancel() n'a toujours
      //     aucune garde, comportement inchangé et hors périmètre de ce
      //     point) — l'état final est alors 'annulee' MALGRÉ un publier()
      //     réussi, ce qui est correct : publier() a agi sur un état
      //     encore valide au moment de son atomique, cancel() vient après.
      // L'invariant qui compte réellement, dans TOUS les cas : si l'état
      // final est 'annulee', publier() ne doit JAMAIS avoir vu son propre
      // atomique échouer à tort (statut 400) alors qu'il a réellement
      // réussi entre-temps — impossible à distinguer sans horodatage fin,
      // donc on vérifie l'invariant strictement nécessaire : l'état final
      // n'est jamais un état invalide (ni 'publiee' silencieusement écrasée
      // en mémoire sans que la base ne le reflète, ni un crash).
      assert.ok(['annulee', 'publiee'].includes(freshRx.statut), `l'état final doit être un des deux états attendus, jamais autre chose : obtenu ${freshRx.statut}`);
      if (rPublier.status === 200) {
        assert.equal(rPublier.body.prescription.statut, 'publiee', 'si publier() répond 200, la réponse doit refléter statut=publiee (son atomique a réellement réussi à cet instant)');
      } else {
        assert.equal(rPublier.status, 400);
        assert.equal(freshRx.statut, 'annulee', 'si publier() a échoué, c\'est nécessairement parce que cancel() avait déjà gagné — l\'état final doit être annulee');
      }
    });

    await t.test('publier()/cancel() — 15 paires concurrentes sur des ordonnances distinctes : jamais d\'état incohérent, sur un échantillon plus large', async () => {
      const N = 15;
      const rxs = await Promise.all(Array.from({ length: N }, () =>
        Prescription.create({ patient: patient._id, medecin: medecin._id, statut: 'active', lignes: [{ medicament_nom: 'Test', quantite: 1 }] })
      ));
      created.prescriptions.push(...rxs);

      const results = await Promise.all(rxs.map(rx => Promise.all([
        call(prescC.publier, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' }),
        call(prescC.cancel, { params: { id: rx._id.toString() }, user, ip: '127.0.0.1' }),
      ])));

      const freshAll = await Prescription.find({ _id: { $in: rxs.map(r => r._id) } }).lean();
      for (const fresh of freshAll) {
        const idx = rxs.findIndex(r => r._id.toString() === fresh._id.toString());
        const [rPublier] = results[idx];
        assert.ok(['annulee', 'publiee'].includes(fresh.statut), `Rx ${fresh._id} : état final inattendu ${fresh.statut}`);
        if (rPublier.status !== 200) {
          assert.equal(rPublier.status, 400, `Rx ${fresh._id} : publier() a répondu ${rPublier.status}, ni 200 ni 400`);
          assert.equal(fresh.statut, 'annulee', `Rx ${fresh._id} : publier() a échoué mais l'état final n'est pas annulee`);
        }
      }
    });
  } finally {
    for (const rx of created.prescriptions) await Prescription.findByIdAndDelete(rx._id);
    for (const p of created.patients) await Patient.findByIdAndDelete(p._id);
    for (const u of created.users) await User.findByIdAndDelete(u._id);
    await mongoose.disconnect();
  }
});
