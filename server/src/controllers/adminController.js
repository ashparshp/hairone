const User = require('../models/User');

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
      await User.findByIdAndUpdate(userId, { role: 'owner', applicationStatus: 'approved' });
    } else {
      await User.findByIdAndUpdate(userId, { applicationStatus: 'rejected' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: "Process failed" });
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