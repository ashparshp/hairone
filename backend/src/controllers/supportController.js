const SupportTicket = require('../models/SupportTicket');

const isAdmin = (user) => user && user.role === 'admin';

const canAccessTicket = (user, ticket) => {
  if (!ticket) return false;
  if (isAdmin(user)) return true;
  return ticket.userId.toString() === user._id.toString();
};

exports.createTicket = async (req, res) => {
  const { subject, message } = req.body;
  try {
    const ticket = await SupportTicket.create({
      userId: req.user.id,
      subject,
      messages: [{ sender: 'user', text: message }]
    });
    res.status(201).json(ticket);
  } catch (e) {
    res.status(500).json({ message: "Failed to create ticket" });
  }
};

exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    res.json(tickets);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch tickets" });
  }
};

exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find()
      .populate('userId', 'name phone')
      .sort({ updatedAt: -1 });
    res.json(tickets);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch tickets" });
  }
};

exports.replyTicket = async (req, res) => {
  const { text } = req.body;
  const { id } = req.params;
  const sender = req.user.role === 'admin' ? 'admin' : 'user';

  try {
    const ticket = await SupportTicket.findById(id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ message: "Not authorized to reply to this ticket" });
    }

    ticket.messages.push({ sender, text });
    ticket.updatedAt = Date.now();
    await ticket.save();

    res.json(ticket);
  } catch (e) {
    res.status(500).json({ message: "Failed to reply" });
  }
};

exports.getTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id).populate('userId', 'name phone');
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ message: "Not authorized to view this ticket" });
    }

    res.json(ticket);
  } catch (e) {
    res.status(500).json({ message: "Failed to load ticket" });
  }
};
