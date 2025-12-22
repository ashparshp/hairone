const Booking = require('../models/Booking');
const Settlement = require('../models/Settlement');
const Shop = require('../models/Shop');
const mongoose = require('mongoose');

// Helper to calculate net
const calculateNet = (bookings) => {
    let adminOwesShop = 0; // From Online bookings (Barber Net Revenue)
    let shopOwesAdmin = 0; // From Cash bookings (Admin Net Revenue/Commission)

    bookings.forEach(b => {
        if (b.amountCollectedBy === 'ADMIN') {
            adminOwesShop += (b.barberNetRevenue || 0);
        } else if (b.amountCollectedBy === 'BARBER') {
            shopOwesAdmin += (b.adminNetRevenue || 0);
        }
    });

    const net = adminOwesShop - shopOwesAdmin;
    return {
        net, // Positive = Admin Pays Shop. Negative = Shop Pays Admin.
        adminOwesShop,
        shopOwesAdmin
    };
};

exports.getPendingSettlements = async (req, res) => {
    try {
        // Find all completed bookings that are not settled
        const bookings = await Booking.find({
            status: 'completed',
            settlementStatus: 'PENDING'
        }).populate('shopId', 'name address');

        // Group by shop
        const shopMap = {};

        bookings.forEach(b => {
            const sId = b.shopId._id.toString();
            if (!shopMap[sId]) {
                shopMap[sId] = {
                    shopId: sId,
                    shopName: b.shopId.name,
                    bookings: [],
                    totalPending: 0
                };
            }
            shopMap[sId].bookings.push(b);
        });

        // Calculate Net
        const result = Object.values(shopMap).map(shop => {
            const { net, adminOwesShop, shopOwesAdmin } = calculateNet(shop.bookings);
            return {
                shopId: shop.shopId,
                shopName: shop.shopName,
                totalPending: net, // The Net Balance
                details: {
                    adminOwesShop,
                    shopOwesAdmin,
                    bookingCount: shop.bookings.length
                }
            };
        });

        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getShopPendingDetails = async (req, res) => {
    try {
        const { shopId } = req.params;
        const bookings = await Booking.find({
            shopId,
            status: 'completed',
            settlementStatus: 'PENDING'
        }).sort({ date: 1, startTime: 1 });

        res.json(bookings);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createSettlement = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { shopId, bookingIds } = req.body; // If bookingIds provided, only settle those. Else all pending.

        const query = {
            shopId,
            status: 'completed',
            settlementStatus: 'PENDING'
        };

        if (bookingIds && bookingIds.length > 0) {
            query._id = { $in: bookingIds };
        }

        const bookings = await Booking.find(query).session(session);

        if (bookings.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'No pending bookings found to settle.' });
        }

        const { net } = calculateNet(bookings);
        const type = net >= 0 ? 'PAYOUT' : 'COLLECTION';
        const absAmount = Math.abs(net);

        // Date Range
        const dates = bookings.map(b => new Date(b.date));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        const settlement = new Settlement({
            shopId,
            adminId: req.user._id,
            type,
            amount: absAmount,
            bookings: bookings.map(b => b._id),
            dateRange: { start: minDate, end: maxDate },
            status: 'COMPLETED'
        });

        await settlement.save({ session });

        // Update Bookings
        await Booking.updateMany(
            { _id: { $in: bookings.map(b => b._id) } },
            {
                $set: {
                    settlementStatus: 'SETTLED',
                    settlementId: settlement._id
                }
            },
            { session }
        );

        await session.commitTransaction();
        res.json({ message: 'Settlement created successfully', settlement });

    } catch (e) {
        await session.abortTransaction();
        console.error(e);
        res.status(500).json({ message: 'Settlement failed' });
    } finally {
        session.endSession();
    }
};

exports.getSettlementHistory = async (req, res) => {
    try {
        const settlements = await Settlement.find()
            .populate('shopId', 'name')
            .sort({ createdAt: -1 });
        res.json(settlements);
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getSettlementDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const settlement = await Settlement.findById(id).populate('bookings');
        if (!settlement) return res.status(404).json({ message: 'Not found' });
        res.json(settlement);
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getShopFinanceSummary = async (req, res) => {
    try {
        const { shopId } = req.params;
        // Check ownership
        if (req.user.role !== 'admin' && req.user.myShopId?.toString() !== shopId) {
             return res.status(403).json({ message: 'Unauthorized' });
        }

        // 1. Total Earnings (All time or filtered?) - Let's do All Time for "Earnings" card
        // Earnings = Sum of (BarberNetRevenue) for ALL completed bookings (Cash + Online)
        // Actually, Barber Earnings = FinalPrice - AdminCommission.
        // Wait, BarberNetRevenue is exactly that.
        const allCompleted = await Booking.find({ shopId, status: 'completed' });

        // Fallback to totalPrice or 0 if barberNetRevenue is missing (legacy data)
        const totalEarnings = allCompleted.reduce((sum, b) => sum + (Number(b.barberNetRevenue) || Number(b.totalPrice) || 0), 0);

        // 2. Pending Settlement (Same logic as Admin pending)
        const pendingBookings = allCompleted.filter(b => b.settlementStatus === 'PENDING');
        const { net, adminOwesShop, shopOwesAdmin } = calculateNet(pendingBookings);

        // 3. Payouts (History)
        // Last 5 settlements?
        const history = await Settlement.find({ shopId }).sort({ createdAt: -1 }).limit(5);

        res.json({
            totalEarnings,
            currentBalance: net, // Positive = Admin owes you. Negative = You owe Admin.
            details: {
                pendingPayout: adminOwesShop,
                pendingDues: shopOwesAdmin
            },
            recentSettlements: history
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getShopSettlements = async (req, res) => {
    try {
        const { shopId } = req.params;
         // Check ownership
         if (req.user.role !== 'admin' && req.user.myShopId?.toString() !== shopId) {
            return res.status(403).json({ message: 'Unauthorized' });
       }

       const settlements = await Settlement.find({ shopId }).sort({ createdAt: -1 });
       res.json(settlements);
    } catch(e) {
        res.status(500).json({ message: 'Server error' });
    }
};
