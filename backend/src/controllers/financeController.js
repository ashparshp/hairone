const Booking = require('../models/Booking');
const Settlement = require('../models/Settlement');
const Shop = require('../models/Shop');
const mongoose = require('mongoose');
const {
    pendingSettlementMatch,
    settlementGroupStage,
    calculateNetFromBookings,
    settleShopBookings,
    SettlementRaceError,
} = require('../services/settlementService');
const { userOwnsShop } = require('../utils/shopUtils');

/**
 * =================================================================================================
 * FINANCE CONTROLLER
 * =================================================================================================
 *
 * Purpose:
 * This controller manages the "Money View" of the application. It is responsible for:
 * 1. Calculating how much money is pending between Shops and the Admin.
 * 2. Showing financial summaries to Shop Owners (Earnings, Dues, Payouts).
 * 3. Handling the manual creation of Settlements (if not waiting for the Cron job).
 *
 * Key Concepts:
 * - Admin Owes Shop: Occurs when a user pays ONLINE. The Admin holds the money and must pay the Shop.
 * - Shop Owes Admin: Occurs when a user pays CASH. The Shop holds the money and owes the Admin a commission.
 * - Net Balance: The difference between the two above.
 * =================================================================================================
 */

const roundMoney = (amount) => {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const calculateNet = calculateNetFromBookings;

/**
 * GET /admin/finance/pending
 * Returns a list of all shops with pending (unsettled) money.
 * Used by the Admin Dashboard.
 */
exports.getPendingSettlements = async (req, res) => {
    try {
        // Find all completed bookings that are not settled
        const bookings = await Booking.find({
            status: 'completed',
            $or: [{ settlementStatus: 'PENDING' }, { settlementStatus: { $exists: false } }]
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
            $or: [{ settlementStatus: 'PENDING' }, { settlementStatus: { $exists: false } }]
        }).sort({ date: 1, startTime: 1 });

        res.json(bookings);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- NEW ENDPOINT FOR SHOP OWNERS ---
exports.getMyShopPendingDetails = async (req, res) => {
    try {
        const { shopId } = req.params;

        if (!userOwnsShop(req.user, shopId)) {
             return res.status(403).json({ message: 'Unauthorized' });
        }

        const bookings = await Booking.find({
            shopId,
            status: 'completed',
            $or: [{ settlementStatus: 'PENDING' }, { settlementStatus: { $exists: false } }]
        }).sort({ date: 1, startTime: 1 });

        res.json(bookings);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * POST /admin/finance/settle
 * Manually creates a settlement record for a shop.
 * This effectively "Closes the books" for the selected bookings.
 */
exports.createSettlement = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { shopId, bookingIds } = req.body;

        const settlement = await settleShopBookings({
            shopId,
            bookingIds: bookingIds?.length ? bookingIds : null,
            adminId: req.user._id,
            settlementRecordStatus: 'COMPLETED',
            notes: `Manual settlement by admin ${req.user.name || req.user._id}.`,
            session,
        });

        if (!settlement) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'No pending bookings found to settle.' });
        }

        await session.commitTransaction();
        res.json({ message: 'Settlement created successfully', settlement });

    } catch (e) {
        await session.abortTransaction();
        console.error(e);
        if (e instanceof SettlementRaceError) {
            return res.status(409).json({ message: e.message });
        }
        res.status(500).json({ message: 'Settlement failed' });
    } finally {
        session.endSession();
    }
};

/**
 * POST /admin/finance/preview
 * Calculates upcoming settlements WITHOUT saving anything.
 */
exports.previewSettlementJob = async (req, res) => {
    try {
        const { startOfWeek, format } = require('date-fns');

        // 1. Define Cutoff (Same as job)
        const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const cutoffDateStr = format(currentWeekStart, 'yyyy-MM-dd');

        // 2. Aggregate (Same as job, but without updating anything)
        const settlementGroups = await Booking.aggregate([
            { $match: pendingSettlementMatch(cutoffDateStr) },
            settlementGroupStage,
            {
                $lookup: {
                    from: 'shops',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'shop'
                }
            }
        ]);

        let totalPayout = 0;
        let totalCollection = 0;
        let shopCount = 0;

        settlementGroups.forEach(group => {
            const rawNet = group.totalBarberNet - group.totalAdminNet;
            const netAmount = roundMoney(rawNet);
            shopCount++;

            if (netAmount >= 0) {
                totalPayout += netAmount;
            } else {
                totalCollection += Math.abs(netAmount);
            }
        });

        res.json({
            cutoffDate: cutoffDateStr,
            shopCount,
            totalPayout: roundMoney(totalPayout),
            totalCollection: roundMoney(totalCollection)
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Preview failed' });
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

/**
 * GET /shops/:id/finance/summary
 * Returns the "Revenue Stats" card data for the Shop Owner Dashboard.
 */
exports.getShopFinanceSummary = async (req, res) => {
    try {
        const { shopId } = req.params;
        if (req.user.role !== 'admin' && !userOwnsShop(req.user, shopId)) {
             return res.status(403).json({ message: 'Unauthorized' });
        }

        // 1. Total Earnings (All time or filtered?) - Let's do All Time for "Earnings" card
        // Earnings = Sum of (BarberNetRevenue) for ALL completed bookings (Cash + Online)
        // Actually, Barber Earnings = FinalPrice - AdminCommission.
        // Wait, BarberNetRevenue is exactly that.
        const allCompleted = await Booking.find({ shopId, status: 'completed' });

        const totalEarnings = roundMoney(allCompleted.reduce((sum, b) => sum + (b.barberNetRevenue || 0), 0));

        // 2. Pending Settlement (Same logic as Admin pending)
        const pendingBookings = allCompleted.filter(b => b.settlementStatus === 'PENDING' || !b.settlementStatus);
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
         if (req.user.role !== 'admin' && !userOwnsShop(req.user, shopId)) {
            return res.status(403).json({ message: 'Unauthorized' });
       }

       const settlements = await Settlement.find({ shopId }).sort({ createdAt: -1 });
       res.json(settlements);
    } catch(e) {
        res.status(500).json({ message: 'Server error' });
    }
};
