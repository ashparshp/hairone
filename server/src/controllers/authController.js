const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * =================================================================================================
 * AUTH CONTROLLER
 * =================================================================================================
 *
 * Purpose:
 * Manages user authentication and profile management.
 *
 * Key Responsibilities:
 * 1. Login/Registration: Currently uses a "Mock OTP" flow for simplicity.
 * 2. JWT Generation: Creates secure tokens for session management.
 * 3. Profile Updates: Handles user details and avatar uploads.
 * 4. Favorites: Toggles favorite shops for the user.
 * =================================================================================================
 */

// 1. Send OTP (Mock)
// In a real production environment, this would call an SMS Gateway API (e.g., Twilio, Msg91).
// Currently, it just logs the OTP to the console for testing.
exports.sendOTP = async (req, res) => {
  const { phone } = req.body;
  console.log(`[OTP SERVICE] Sent 1234 to ${phone}`);
  // In real app, integrate SMS provider here
  res.status(200).json({ message: "OTP sent successfully" });
};

// 2. Verify OTP & Login
// This is the main entry point. It checks the OTP and returns a JWT.
// Logic:
// - Validate OTP (Hardcoded '1234').
// - Find User by Phone.
// - If User doesn't exist -> Create new User (Auto-Registration).
// - Generate JWT Token signing the User ID and Role.
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
    // Expires in 30 days to keep users logged in for a long time on mobile.
    const token = jwt.sign({ id: user._id, role: user.role, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, {
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

// 3. Update Profile
// Standard CRUD to update name, email, gender, and avatar image.
exports.updateProfile = async (req, res) => {
  const { name, email, gender } = req.body;
  
  try {
    const updateData = { name, email, gender };
    if (req.file) {
        updateData.avatar = req.file.location; // S3/Multer
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    );
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: "Update failed" });
  }
};

// 4. Toggle Favorite
// Adds or removes a Shop ID from the user's `favorites` array.
exports.toggleFavorite = async (req, res) => {
  const { shopId } = req.body;
  const userId = req.user.id;
  
  try {
    const user = await User.findById(userId);
    const index = user.favorites.indexOf(shopId);
    
    if (index === -1) {
      user.favorites.push(shopId); // Add
    } else {
      user.favorites.splice(index, 1); // Remove
    }
    
    await user.save();
    res.json(user.favorites);
  } catch (e) {
    res.status(500).json({ message: "Failed to update favorites" });
  }
};

// 5. Get Current User Profile
// Returns the full user object for the authenticated session.
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};
