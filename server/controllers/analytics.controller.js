const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const Consultation = require('../models/Consultation');
const Hospitalization = require('../models/Hospitalization');

exports.getAnalytics = async (req, res, next) => {
  try {
    const [
      patientsParMois, rdvParStatut, revenusParCategorie,
      hospitalisationsParService, topDiagnostics
    ] = await Promise.all([
      Patient.aggregate([
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: -1 } }, { $limit: 12 },
      ]),
      Appointment.aggregate([
        { $group: { _id: '$statut', count: { $sum: 1 } } },
      ]),
      Invoice.aggregate([
        { $unwind: '$lignes' },
        { $group: { _id: '$lignes.categorie', total: { $sum: '$lignes.montant' } } },
        { $sort: { total: -1 } },
      ]),
      Hospitalization.aggregate([
        { $group: { _id: '$service', count: { $sum: 1 } } },
        { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'service' } },
      ]),
      Consultation.aggregate([
        { $match: { diagnostic: { $exists: true, $ne: '' } } },
        { $group: { _id: '$diagnostic', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 10 },
      ]),
    ]);

    res.json({ success: true, analytics: {
      patientsParMois: patientsParMois.reverse(),
      rdvParStatut,
      revenusParCategorie,
      hospitalisationsParService,
      topDiagnostics,
    }});
  } catch (err) { next(err); }
};
