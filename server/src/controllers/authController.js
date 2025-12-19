const User = require('../models/User');
const jwt = require('jsonwebtoken');

// 1. Send OTP (Mock)
exports.sendOTP = async (req, res) => {
  const { phone } = req.body;
  console.log(`[OTP SERVICE] Sent 1234 to ${phone}`);
  // In real app, integrate SMS provider here
  res.status(200).json({ message: "OTP sent successfully" });
};

// 2. Verify OTP & Login
exports.verifyOTP = async (req, res) => {
  const { phone, otp } = req.body;

  try {
    // Simple Mock OTP check
    if (otp !== '1234') {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Check if user exists, or create new
    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({
        phone,
        role: 'user', // Default role
        applicationStatus: 'none'
      });
    }

    // Generate JWT Token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    res.status(200).json({
      message: "Login Successful",
      token,
      user
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};