const express = require('express');
const router = express.Router();
const { runSettlementJob } = require('../jobs/settlementJob');
const Settlement = require('../models/Settlement');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// --- Middleware: Verify Admin Access ---
const verifyAdmin = async (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required." });
    }
    next();
};

const verifyShopOrAdmin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role === 'admin') return next();

    // If shop owner, check if the settlement belongs to their shop
    // This logic is better placed inside the controller method
    next();
};

// --- 1. Manual Trigger (Admin Only) ---
router.post('/generate-settlements', protect, verifyAdmin, async (req, res) => {
    try {
        const result = await runSettlementJob(req.user._id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ message: "Job failed", error: e.message });
    }
});

// --- 2. Get Settlements (Admin: All, Shop: Own) ---
router.get('/settlements', protect, async (req, res) => {
    try {
        const query = {};

        if (req.user.role !== 'admin') {
            // If User is Shop Owner, find their shopId
            // The User model has `myShopId`.
            if (!req.user.myShopId) {
                return res.status(400).json({ message: "User is not a shop owner." });
            }
            query.shopId = req.user.myShopId;
        }

        const settlements = await Settlement.find(query)
            .populate('shopId', 'name address')
            .sort({ createdAt: -1 });

        res.json(settlements);
    } catch (e) {
        res.status(500).json({ message: "Failed to fetch settlements" });
    }
});

// --- 3. Pay Settlement (Shop -> Admin) ---
// Generates a mock payment link
router.post('/settlements/:id/pay', protect, async (req, res) => {
    try {
        const settlement = await Settlement.findById(req.params.id);
        if (!settlement) return res.status(404).json({ message: "Settlement not found" });

        // Security: Ensure user owns this shop
        if (req.user.role !== 'admin') {
             if (settlement.shopId.toString() !== req.user.myShopId?.toString()) {
                 return res.status(403).json({ message: "Unauthorized" });
             }
        }

        if (settlement.type !== 'COLLECTION') {
            return res.status(400).json({ message: "This settlement is a Payout, not a Collection." });
        }

        // Mock Payment Link Generation
        const mockLink = `https://payments.example.com/pay/${settlement._id}?amt=${settlement.amount}`;

        settlement.paymentLink = mockLink;
        await settlement.save();

        res.json({ message: "Payment link generated", link: mockLink });
    } catch (e) {
        res.status(500).json({ message: "Failed to generate payment link" });
    }
});

// --- 4. Mark Complete (Admin Only) ---
// Confirms that money has moved (Payout sent OR Collection received)
router.post('/settlements/:id/complete', protect, verifyAdmin, async (req, res) => {
    try {
        const settlement = await Settlement.findById(req.params.id);
        if (!settlement) return res.status(404).json({ message: "Settlement not found" });

        settlement.status = 'COMPLETED';
        settlement.notes = (settlement.notes || '') + `\nCompleted manually by Admin ${req.user.name} on ${new Date().toISOString()}`;

        await settlement.save();
        res.json(settlement);
    } catch (e) {
        res.status(500).json({ message: "Failed to complete settlement" });
    }
});

module.exports = router;
