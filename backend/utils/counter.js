const Counter = require('../models/Counter');

/**
 * Retourne le prochain entier d'une séquence nommée, de façon atomique
 * ($inc + upsert), sans condition de course même sous forte concurrence.
 * @param {string} key ex: `patient-${year}`, `invoice-${year}`
 * @returns {Promise<number>}
 */
const nextSequence = async (key) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

module.exports = { nextSequence };
