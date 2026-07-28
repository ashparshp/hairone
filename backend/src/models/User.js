const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String },
  avatar: { type: String },
  email: { type: String },
  gender: { type: String, enum: ["male", "female", "other"] },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Shop" }],

  role: { type: String, enum: ["user", "admin", "owner"], default: "user" },
  myShopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop" }, // If owner

  isPremium: { type: Boolean, default: false },

  businessName: { type: String },
  applicationStatus: {
    type: String,
    enum: ["none", "pending", "approved", "rejected", "suspended"],
    default: "none",
  },
  applicationSubmittedAt: { type: Date },
  applicationReviewedAt: { type: Date },
  applicationReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  applicationRejectionReason: { type: String },
  suspensionReason: { type: String },
  partnerDraft: {
    ownerName: { type: String },
    businessName: { type: String },
    shopName: { type: String },
    address: { type: String },
    coordinates: {
      lat: Number,
      lng: Number,
    },
    shopType: { type: String, enum: ["male", "female", "unisex"] },
    bufferTime: Number,
    minBookingNotice: Number,
    maxBookingNotice: Number,
    autoApproveBookings: Boolean,
    updatedAt: Date,
  },
  tokenVersion: { type: Number, default: 0 },

  cancellationCount: { type: Number, default: 0 },
  noShowCount: { type: Number, default: 0 },
  incidentCountsYear: { type: Number },
  isFlagged: { type: Boolean, default: false },

  /** Rupee balance from failed bookings / credits — applied at checkout. */
  walletBalance: { type: Number, default: 0, min: 0 },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
