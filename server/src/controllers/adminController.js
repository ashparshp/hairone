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
    const shops = await Shop.find()
      .populate('ownerId', 'name email phone')
      .select('name address type rating ownerId');
    res.json(shops);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch shops" });
  }
};

// ADMIN: Get System Stats
exports.getSystemStats = async (req, res) => {
  try {
    // 1. Total Bookings
    const totalBookings = await Booking.countDocuments();

    // 2. Total Revenue (sum of totalPrice for completed bookings)
    const revenueStats = await Booking.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    const totalRevenue = revenueStats.length > 0 ? revenueStats[0].total : 0;

    // 3. Active Shops
    const activeShops = await Shop.countDocuments();

    // 4. Total Users
    const totalUsers = await User.countDocuments();

    res.json({
      totalBookings,
      totalRevenue,
      activeShops,
      totalUsers
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};