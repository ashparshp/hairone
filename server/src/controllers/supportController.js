const SupportTicket = require('../models/SupportTicket');

// Create Ticket (User)
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

// Get My Tickets (User)
exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    res.json(tickets);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch tickets" });
  }
};

// Get All Tickets (Admin)
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

// Reply to Ticket (User/Admin)
exports.replyTicket = async (req, res) => {
  const { text } = req.body;
  const { id } = req.params;
  const sender = req.user.role === 'admin' ? 'admin' : 'user';

  try {
    const ticket = await SupportTicket.findById(id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    ticket.messages.push({ sender, text });
    ticket.updatedAt = Date.now();
    await ticket.save();

    res.json(ticket);
  } catch (e) {
    res.status(500).json({ message: "Failed to reply" });
  }
};

// Get Single Ticket (User/Admin)
exports.getTicket = async (req, res) => {
    try {
        const ticket = await SupportTicket.findById(req.params.id).populate('userId', 'name phone');
        res.json(ticket);
    } catch (e) {
        res.status(500).json({ message: "Failed to load ticket" });
    }
}