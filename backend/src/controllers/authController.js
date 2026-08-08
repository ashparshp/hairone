const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwt');
const { checkRateLimit } = require('../utils/rateLimitUtils');
const { withSignedUserAvatar } = require('../utils/imageUrl');
const {
  normalizeIndianPhone,
  phoneLookupVariants,
} = require('../utils/phoneUtils');

const OTP_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_PER_PHONE = 5;
const SUSPENDED_LOGIN_MESSAGE =
  "You are suspended can't login contact support@hairone.in";

const otpRateLimitKey = (phone) => `otp:${phone}`;

const isMockOtpAllowed = () =>
  process.env.NODE_ENV !== 'production' && process.env.MOCK_OTP === 'true';

const checkOtpRateLimit = async (phone) =>
  checkRateLimit(otpRateLimitKey(phone), OTP_MAX_PER_PHONE, OTP_WINDOW_MS);

const isSuspendedAccount = (user) =>
  Boolean(user && user.applicationStatus === 'suspended');

const findUserByPhone = async (normalizedPhone) => {
  const variants = phoneLookupVariants(normalizedPhone);
  return User.findOne({ phone: { $in: variants } });
};

const ensureCanonicalPhone = async (user, normalizedPhone) => {
  if (!user || user.phone === normalizedPhone) return user;
  user.phone = normalizedPhone;
  await user.save();
  return user;
};

exports.sendOTP = async (req, res) => {
  const phone = normalizeIndianPhone(req.body.phone);
  if (!phone) {
    return res.status(400).json({
      message: 'Enter a valid 10-digit Indian mobile number',
    });
  }

  if (!(await checkOtpRateLimit(phone))) {
    return res.status(429).json({ message: 'Too many OTP requests. Try again later.' });
  }

  try {
    const existing = await findUserByPhone(phone);
    if (isSuspendedAccount(existing)) {
      return res.status(403).json({ message: SUSPENDED_LOGIN_MESSAGE });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server Error' });
  }

  if (isMockOtpAllowed()) {
    console.log(`[OTP SERVICE] Mock OTP enabled for ${phone}`);
  }

  res.status(200).json({ message: 'OTP sent successfully' });
};

exports.verifyOTP = async (req, res) => {
  const { otp } = req.body;
  const phone = normalizeIndianPhone(req.body.phone);

  try {
    if (!phone || !otp) {
      return res.status(400).json({
        message: !phone
          ? 'Enter a valid 10-digit Indian mobile number'
          : 'Phone and OTP are required',
      });
    }

    if (isMockOtpAllowed()) {
      if (otp !== '1234') {
        return res.status(400).json({ message: 'Invalid OTP' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ message: 'SMS OTP is not configured for production yet.' });
    } else {
      return res.status(400).json({ message: 'OTP verification is disabled. Set MOCK_OTP=true for local dev.' });
    }

    let user = await findUserByPhone(phone);

    if (!user) {
      user = await User.create({
        phone,
        role: 'user',
        applicationStatus: 'none'
      });
    } else {
      user = await ensureCanonicalPhone(user, phone);
    }

    if (isSuspendedAccount(user)) {
      return res.status(403).json({ message: SUSPENDED_LOGIN_MESSAGE });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, tokenVersion: user.tokenVersion },
      getJwtSecret(),
      { expiresIn: '30d' },
    );

    res.status(200).json({
      message: 'Login Successful',
      token,
      user: await withSignedUserAvatar(user)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.updateProfile = async (req, res) => {
  const { name, email, gender } = req.body;
  
  try {
    const updateData = { name, email, gender };
    if (req.file) {
        updateData.avatar = req.file.location;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { returnDocument: 'after' }
    );
    res.json(await withSignedUserAvatar(user));
  } catch (e) {
    res.status(500).json({ message: 'Update failed' });
  }
};

exports.toggleFavorite = async (req, res) => {
  const { shopId } = req.body;
  const userId = req.user.id;
  
  try {
    const user = await User.findById(userId);
    const index = user.favorites.indexOf(shopId);
    
    if (index === -1) {
      user.favorites.push(shopId);
    } else {
      user.favorites.splice(index, 1);
    }
    
    await user.save();
    res.json(user.favorites);
  } catch (e) {
    res.status(500).json({ message: 'Failed to update favorites' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(await withSignedUserAvatar(user));
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Logout failed' });
  }
};
