const Booking = require('../models/Booking');
const Settlement = require('../models/Settlement');
const Shop = require('../models/Shop');
const mongoose = require('mongoose');

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

// Helper to calculate net balance for a list of bookings
// Used by both Admin and Shop dashboards to see "Live" pending stats.
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

    const net = roundMoney(adminOwesShop - shopOwesAdmin);
    return {
        net, // Positive = Admin Pays Shop. Negative = Shop Pays Admin.
        adminOwesShop: roundMoney(adminOwesShop),
        shopOwesAdmin: roundMoney(shopOwesAdmin)
    };
};

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

        // Strict ownership check
        if (req.user.myShopId?.toString() !== shopId) {
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
        const { shopId, bookingIds } = req.body; // If bookingIds provided, only settle those. Else all pending.

        const query = {
            shopId,
            status: 'completed',
            $or: [{ settlementStatus: 'PENDING' }, { settlementStatus: { $exists: false } }]
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
            {
                $match: {
                    status: 'completed',
                    $or: [
                        { settlementStatus: 'PENDING' },
                        { settlementStatus: { $exists: false } }
                    ],
                    date: { $lt: cutoffDateStr }
                }
            },
            {
                $group: {
                    _id: '$shopId',
                    count: { $sum: 1 },
                    // Calculate what Shop Owes Admin (Commission from Cash)
                    totalAdminNet: {
                        $sum: {
                            $cond: [
                                { $or: [{ $eq: ['$paymentMethod', 'CASH'] }, { $eq: ['$paymentMethod', 'cash'] }] },
                                '$adminNetRevenue',
                                0
                            ]
                        }
                    },
                    // Calculate what Admin Owes Shop (Revenue from Online)
                    totalBarberNet: {
                        $sum: {
                            $cond: [
                                { $not: { $or: [{ $eq: ['$paymentMethod', 'CASH'] }, { $eq: ['$paymentMethod', 'cash'] }] } },
                                '$barberNetRevenue',
                                0
                            ]
                        }
                    }
                }
            },
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
        // Check ownership
        if (req.user.role !== 'admin' && req.user.myShopId?.toString() !== shopId) {
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
