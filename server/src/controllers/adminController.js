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