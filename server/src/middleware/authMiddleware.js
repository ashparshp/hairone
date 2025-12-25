const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * =================================================================================================
 * AUTH MIDDLEWARE
 * =================================================================================================
 *
 * Purpose:
 * Protects routes by ensuring the request contains a valid JWT token.
 *
 * Logic:
 * 1. Checks for 'Bearer <token>' in the Authorization header.
 * 2. Decodes the token to get the User ID.
 * 3. Fetches the full User object from the database (excluding password).
 * 4. Attaches `req.user` to the request object so subsequent controllers can use it.
 * =================================================================================================
 */

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      if (!process.env.JWT_SECRET) {
          console.error("FATAL ERROR: JWT_SECRET is not defined.");
          return res.status(500).json({ message: "Server configuration error" });
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token (exclude password)
      // This ensures req.user has all fields like myShopId, role, etc.
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      // Token Version Check (Invalidate old tokens after role change/logout)
      // We check if the token version in the payload matches the user's current version.
      // If decoded.tokenVersion is undefined (old tokens), we treat it as 0.
      const tokenVersion = decoded.tokenVersion || 0;
      if (tokenVersion !== (req.user.tokenVersion || 0)) {
        return res.status(401).json({ message: 'Not authorized, token expired or invalid' });
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

exports.admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};
