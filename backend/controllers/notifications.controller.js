const Notification = require('../models/Notification');

exports.getAll = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ destinataire: req.user._id })
      .sort('-createdAt').limit(50);
    const unread = await Notification.countDocuments({ destinataire: req.user._id, lu: false });
    res.json({ success: true, notifications, unread });
  } catch (err) { next(err); }
};

exports.markRead = async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, destinataire: req.user._id },
      { lu: true, lu_at: new Date() }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ destinataire: req.user._id, lu: false }, { lu: true, lu_at: new Date() });
    res.json({ success: true });
  } catch (err) { next(err); }
};
