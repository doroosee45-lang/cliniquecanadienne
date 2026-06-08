const Conversation = require('../models/Conversation');
const { emitTo } = require('../utils/socket');

exports.getConversations = async (req, res, next) => {
  try {
    const convs = await Conversation.find({ membres: req.user._id })
      .populate('membres', 'nom prenom role avatar')
      .sort('-dernier_message');
    res.json({ success: true, conversations: convs });
  } catch (err) { next(err); }
};

exports.getOrCreate = async (req, res, next) => {
  try {
    const { userId } = req.body;
    let conv = await Conversation.findOne({
      type: 'direct',
      membres: { $all: [req.user._id, userId], $size: 2 },
    }).populate('membres', 'nom prenom role avatar');

    if (!conv) {
      conv = await Conversation.create({ type: 'direct', membres: [req.user._id, userId], created_by: req.user._id });
      await conv.populate('membres', 'nom prenom role avatar');
    }
    res.json({ success: true, conversation: conv });
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { contenu } = req.body;
    const conv = await Conversation.findOne({ _id: req.params.id, membres: req.user._id });
    if (!conv) return res.status(403).json({ success: false, message: 'Accès refusé.' });

    const msg = { expediteur: req.user._id, contenu, lu_par: [req.user._id] };
    conv.messages.push(msg);
    conv.dernier_message = new Date();
    await conv.save();

    // Populer l'expéditeur pour l'affichage temps réel
    await conv.populate('messages.expediteur', 'nom prenom avatar role');
    const lastMsg = conv.messages[conv.messages.length - 1];

    // Émettre le message à la room de la conversation
    emitTo(`conversation:${conv._id}`, 'message:new', {
      conversationId: conv._id,
      message: lastMsg,
    });
    // Notifier aussi chaque membre via sa room privée (badge non-lus)
    conv.membres.forEach(memberId => {
      if (memberId.toString() !== req.user._id.toString()) {
        emitTo(`user:${memberId}`, 'message:new', {
          conversationId: conv._id,
          message: lastMsg,
        });
      }
    });

    res.json({ success: true, message: lastMsg });
  } catch (err) { next(err); }
};

exports.getMessages = async (req, res, next) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, membres: req.user._id })
      .populate('messages.expediteur', 'nom prenom avatar role');
    if (!conv) return res.status(403).json({ success: false, message: 'Accès refusé.' });
    // Mark as read
    conv.messages.forEach(m => {
      if (!m.lu_par.includes(req.user._id)) m.lu_par.push(req.user._id);
    });
    await conv.save();
    res.json({ success: true, messages: conv.messages });
  } catch (err) { next(err); }
};
