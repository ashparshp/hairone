const User = require('../models/User');
const Shop = require('../models/Shop');
const Booking = require('../models/Booking');

// USER: Submit Application
exports.submitApplication = async (req, res) => {
  const { businessName, ownerName } = req.body;
  const userId = req.user.id;

  try {
    const updateData = {
      applicationStatus: 'pending',
      businessName: businessName || 'Untitled Shop'
    };
    
    // FIX: Update User Name to Owner Name if provided
    if (ownerName) updateData.name = ownerName;

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: "Application failed" });
  }
};

// ADMIN: Get Pending Applications
exports.getApplications = async (req, res) => {
  try {
    const applicants = await User.find({ applicationStatus: 'pending' });
    res.json(applicants);
  } catch (e) {
    res.status(500).json({ message: "Fetch failed" });
  }
};

// ADMIN: Approve/Reject
exports.processApplication = async (req, res) => {
  const { userId, action } = req.body;
  try {
    if (action === 'approve') {
      const user = await User.findByIdAndUpdate(userId, { role: 'owner', applicationStatus: 'approved' }, { new: true });
      // If shop exists (re-approval), enable it
      if (user.myShopId) {
        await Shop.findByIdAndUpdate(user.myShopId, { isDisabled: false });
      }
    } else {
      await User.findByIdAndUpdate(userId, { applicationStatus: 'rejected' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: "Process failed" });
  }
};

// ADMIN: Suspend Shop
exports.suspendShop = async (req, res) => {
  const { shopId } = req.params;
  const { reason } = req.body;

  try {
    if (!reason) return res.status(400).json({ message: "Suspension reason is required." });

    // 1. Disable Shop
    const shop = await Shop.findByIdAndUpdate(shopId, { isDisabled: true }, { new: true });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // 2. Suspend Owner
    await User.findByIdAndUpdate(shop.ownerId, {
      applicationStatus: 'suspended',
      suspensionReason: reason
    });

    // 3. Cancel Upcoming Bookings
    const cancelled = await Booking.updateMany(
      { shopId: shop._id, status: 'upcoming' },
      {
        status: 'cancelled',
        notes: `Cancelled due to shop suspension: ${reason}`
      }
    );

    res.json({ message: "Shop suspended", cancelledBookings: cancelled.modifiedCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to suspend shop" });
  }
};

// USER: Reapply (Recover from Suspension)
exports.reapply = async (req, res) => {
  const userId = req.user.id;
  try {
    const user = await User.findByIdAndUpdate(userId, {
      applicationStatus: 'pending'
      // We keep suspensionReason for history or overwrite it?
      // Let's leave it, it will be overwritten on next suspension or ignored on approval.
    }, { new: true });

    res.json({ message: "Re-application submitted", user });
  } catch (e) {
    res.status(500).json({ message: "Failed to reapply" });
  }
};

// ADMIN: Get All Shops
exports.getAllShops = async (req, res) => {
    try {
        const shops = await require('../models/Shop').find()
            .populate('ownerId', 'name email phone')
            .sort({ createdAt: -1 });
        res.json(shops);
    } catch (e) {
        res.status(500).json({ message: "Failed to fetch shops" });
    }
};

// ADMIN: Get System Stats
exports.getSystemStats = async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        const User = require('../models/User');
        const Shop = require('../models/Shop');

        const totalUsers = await User.countDocuments({ role: 'user' });
        const totalOwners = await User.countDocuments({ role: 'owner' });
        const totalShops = await Shop.countDocuments();

        // Aggregation for Bookings & Revenue
        const bookingStats = await Booking.aggregate([
            {
                $group: {
                    _id: null,
                    totalBookings: { $sum: 1 },
                    completedBookings: {
                        $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
                    },
                    totalRevenue: {
                        $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$totalPrice", 0] }
                    }
                }
            }
        ]);

        const stats = bookingStats[0] || { totalBookings: 0, completedBookings: 0, totalRevenue: 0 };

        res.json({
            users: totalUsers,
            owners: totalOwners,
            shops: totalShops,
            ...stats
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch stats" });
    }
};