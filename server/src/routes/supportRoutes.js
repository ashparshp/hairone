const express = require('express');
const router = express.Router();
const { createTicket, getMyTickets, getAllTickets, replyTicket, getTicket } = require('../controllers/supportController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/', protect, createTicket);
router.get('/my', protect, getMyTickets);
router.get('/all', protect, admin, getAllTickets);
router.get('/:id', protect, getTicket);
router.post('/:id/reply', protect, replyTicket);

module.exports = router;