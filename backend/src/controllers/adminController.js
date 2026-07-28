const User = require("../models/User");
const Shop = require("../models/Shop");
const Booking = require("../models/Booking");

const trimText = (value, max = 120) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, max);
};

const toNumberInRange = (value, min, max) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const clamped = Math.min(max, Math.max(min, parsed));
  return clamped;
};

const normalizePartnerDraftPayload = (payload = {}) => {
  const draft = {};

  const ownerName = trimText(payload.ownerName, 80);
  if (ownerName !== undefined) draft.ownerName = ownerName;

  const businessName = trimText(payload.businessName, 120);
  if (businessName !== undefined) draft.businessName = businessName;

  const shopName = trimText(payload.shopName, 120);
  if (shopName !== undefined) draft.shopName = shopName;

  const address = trimText(payload.address, 300);
  if (address !== undefined) draft.address = address;

  if (payload.coordinates && typeof payload.coordinates === "object") {
    const lat = toNumberInRange(payload.coordinates.lat, -90, 90);
    const lng = toNumberInRange(payload.coordinates.lng, -180, 180);
    if (lat !== undefined && lng !== undefined) {
      draft.coordinates = { lat, lng };
    }
  }

  if (["male", "female", "unisex"].includes(payload.shopType)) {
    draft.shopType = payload.shopType;
  }

  const bufferTime = toNumberInRange(payload.bufferTime, 0, 180);
  if (bufferTime !== undefined) draft.bufferTime = Math.round(bufferTime);

  const minBookingNotice = toNumberInRange(
    payload.minBookingNotice,
    0,
    7 * 24 * 60,
  );
  if (minBookingNotice !== undefined) {
    draft.minBookingNotice = Math.round(minBookingNotice);
  }

  const maxBookingNotice = toNumberInRange(payload.maxBookingNotice, 1, 365);
  if (maxBookingNotice !== undefined) {
    draft.maxBookingNotice = Math.round(maxBookingNotice);
  }

  if (typeof payload.autoApproveBookings === "boolean") {
    draft.autoApproveBookings = payload.autoApproveBookings;
  }

  return draft;
};

/**
 * =================================================================================================
 * ADMIN CONTROLLER
 * =================================================================================================
 *
 * Purpose:
 * This controller handles the super-admin functions. It is the "Control Tower" of the application.
 *
 * Key Responsibilities:
 * 1. Application Management: Approving/Rejecting new shop owners.
 * 2. Shop Oversight: Suspending shops (which cancels their bookings) and viewing all shops.
 * 3. System Health: Viewing high-level stats (Total Users, Revenue, etc.).
 * 4. Global Configuration: Setting the Commission Rate and User Discounts.
 * =================================================================================================
 */

// USER: Submit Application
// Called when a user fills out the "Join as Partner" form.
exports.submitApplication = async (req, res) => {
  const { businessName, ownerName } = req.body;
  const userId = req.user.id;

  try {
    if (req.user.role === "owner" && req.user.myShopId) {
      return res
        .status(400)
        .json({ message: "Shop already exists for this account" });
    }

    if (req.user.applicationStatus === "pending") {
      return res
        .status(409)
        .json({ message: "Application is already pending review" });
    }

    if (req.user.applicationStatus === "approved") {
      return res
        .status(409)
        .json({ message: "Application is already approved" });
    }

    const cleanBusinessName = trimText(businessName, 120);
    const cleanOwnerName = trimText(ownerName, 80);

    if (!cleanBusinessName || !cleanOwnerName) {
      return res
        .status(400)
        .json({ message: "Business name and owner name are required" });
    }

    const updateData = {
      applicationStatus: "pending",
      businessName: cleanBusinessName,
      name: cleanOwnerName,
      applicationSubmittedAt: new Date(),
      applicationReviewedAt: null,
      applicationReviewedBy: null,
      applicationRejectionReason: null,
      partnerDraft: {
        ...(req.user.partnerDraft || {}),
        ownerName: cleanOwnerName,
        businessName: cleanBusinessName,
        shopName: cleanBusinessName,
        updatedAt: new Date(),
      },
    };

    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: "Application failed" });
  }
};

// ADMIN: Get Applications (Pending or All)
exports.getApplications = async (req, res) => {
  try {
    const { status } = req.query;
    let query = { applicationStatus: "pending" };

    if (status === "history") {
      // Fetch rejected or approved (processed) applications
      query = {
        applicationStatus: { $in: ["approved", "rejected", "suspended"] },
      };
    } else if (status === "all") {
      query = { applicationStatus: { $exists: true } };
    }

    const applicants = await User.find(query).sort({ updatedAt: -1 });
    res.json(applicants);
  } catch (e) {
    res.status(500).json({ message: "Fetch failed" });
  }
};

// ADMIN: Approve/Reject
// This changes the User Role from 'user' to 'owner'.
exports.processApplication = async (req, res) => {
  const { userId, action, reason } = req.body;
  try {
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.applicationStatus !== "pending") {
      return res
        .status(409)
        .json({ message: "Only pending applications can be processed" });
    }

    if (action === "approve") {
      await User.findByIdAndUpdate(
        userId,
        {
          role: "owner",
          applicationStatus: "approved",
          applicationReviewedAt: new Date(),
          applicationReviewedBy: req.user._id,
          applicationRejectionReason: null,
          businessName:
            user.businessName ||
            user.partnerDraft?.businessName ||
            "Untitled Shop",
          $inc: { tokenVersion: 1 },
        },
        { new: true },
      );
      // If shop exists (re-approval), enable it
      if (user.myShopId) {
        await Shop.findByIdAndUpdate(user.myShopId, { isDisabled: false });
      }
    } else {
      await User.findByIdAndUpdate(userId, {
        applicationStatus: "rejected",
        applicationReviewedAt: new Date(),
        applicationReviewedBy: req.user._id,
        applicationRejectionReason:
          trimText(reason, 200) || "Application rejected",
      });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: "Process failed" });
  }
};

// ADMIN: Suspend Shop
// A critical safety feature. If a shop is bad, we suspend it.
// LOGIC:
// 1. Disable the Shop record.
// 2. Mark the Owner as 'suspended'.
// 3. CANCEL all future bookings for this shop to prevent customers from showing up.
exports.suspendShop = async (req, res) => {
  const { shopId } = req.params;
  const { reason } = req.body;

  try {
    if (!reason)
      return res
        .status(400)
        .json({ message: "Suspension reason is required." });

    // 1. Disable Shop
    const shop = await Shop.findByIdAndUpdate(
      shopId,
      { isDisabled: true },
      { new: true },
    );
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // 2. Suspend Owner
    await User.findByIdAndUpdate(shop.ownerId, {
      applicationStatus: "suspended",
      suspensionReason: reason,
      $inc: { tokenVersion: 1 },
    });

    // 3. Cancel Upcoming Bookings
    const cancelled = await Booking.updateMany(
      { shopId: shop._id, status: { $in: ["upcoming", "pending"] } },
      {
        status: "cancelled",
        activeBooking: false,
        notes: `Cancelled due to shop suspension: ${reason}`,
      },
    );

    res.json({
      message: "Shop suspended",
      cancelledBookings: cancelled.modifiedCount,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to suspend shop" });
  }
};

// ADMIN: Reactivate Shop (Revoke Suspension)
exports.reactivateShop = async (req, res) => {
  const { shopId } = req.params;
  try {
    const shop = await Shop.findByIdAndUpdate(
      shopId,
      { isDisabled: false },
      { new: true },
    );
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    await User.findByIdAndUpdate(shop.ownerId, {
      applicationStatus: "approved",
      $unset: { suspensionReason: 1 }, // Remove reason
    });

    res.json({ message: "Shop reactivated successfully." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to reactivate shop" });
  }
};

// USER: Reapply (Recover from Suspension)
exports.reapply = async (req, res) => {
  const userId = req.user.id;
  try {
    if (
      req.user.role === "owner" &&
      req.user.myShopId &&
      req.user.applicationStatus !== "suspended"
    ) {
      return res
        .status(400)
        .json({ message: "Shop already exists for this account" });
    }

    if (!["rejected", "suspended"].includes(req.user.applicationStatus)) {
      return res
        .status(400)
        .json({
          message: "Re-apply is only allowed after rejection or suspension",
        });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        applicationStatus: "pending",
        applicationSubmittedAt: new Date(),
        applicationReviewedAt: null,
        applicationReviewedBy: null,
        applicationRejectionReason: null,
        partnerDraft: {
          ...(req.user.partnerDraft || {}),
          ownerName: req.user.name || req.user.partnerDraft?.ownerName || "",
          businessName:
            req.user.businessName || req.user.partnerDraft?.businessName || "",
          shopName:
            req.user.partnerDraft?.shopName ||
            req.user.businessName ||
            req.user.partnerDraft?.businessName ||
            "",
          updatedAt: new Date(),
        },
      },
      { new: true },
    );

    res.json({ message: "Re-application submitted", user });
  } catch (e) {
    res.status(500).json({ message: "Failed to reapply" });
  }
};

exports.getMyApplicationDraft = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "name businessName role myShopId applicationStatus partnerDraft",
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    const canEdit = !(user.role === "owner" && user.myShopId);

    res.json({
      canEdit,
      applicationStatus: user.applicationStatus,
      draft: user.partnerDraft || {},
      defaults: {
        ownerName: user.name || "",
        businessName: user.businessName || "",
      },
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch draft" });
  }
};

exports.saveMyApplicationDraft = async (req, res) => {
  try {
    if (req.user.role === "owner" && req.user.myShopId) {
      return res
        .status(400)
        .json({ message: "Draft editing is disabled for active shop owners" });
    }

    const draftPatch = normalizePartnerDraftPayload(req.body);
    if (Object.keys(draftPatch).length === 0) {
      return res
        .status(400)
        .json({ message: "No valid draft fields provided" });
    }

    const update = {
      $set: {
        ...Object.entries(draftPatch).reduce((acc, [key, value]) => {
          acc[`partnerDraft.${key}`] = value;
          return acc;
        }, {}),
        "partnerDraft.updatedAt": new Date(),
      },
    };

    if (draftPatch.businessName !== undefined) {
      update.$set.businessName = draftPatch.businessName;
    }
    if (draftPatch.ownerName !== undefined) {
      update.$set.name = draftPatch.ownerName;
    }

    const user = await User.findByIdAndUpdate(req.user.id, update, {
      new: true,
      runValidators: true,
    }).select("name businessName partnerDraft");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      draft: user.partnerDraft || {},
      defaults: {
        ownerName: user.name || "",
        businessName: user.businessName || "",
      },
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to save draft" });
  }
};

// ADMIN: Get All Shops
exports.getAllShops = async (req, res) => {
  try {
    const shops = await require("../models/Shop")
      .find()
      .populate("ownerId", "name email phone")
      .sort({ createdAt: -1 });
    res.json(shops);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch shops" });
  }
};

// ADMIN: Get System Stats
// Aggregates data for the Admin Dashboard "Reports" tab.
exports.getSystemStats = async (req, res) => {
  try {
    const Booking = require("../models/Booking");
    const User = require("../models/User");
    const Shop = require("../models/Shop");

    const totalUsers = await User.countDocuments({ role: "user" });
    const totalOwners = await User.countDocuments({ role: "owner" });
    const totalShops = await Shop.countDocuments();

    // Aggregation for Bookings & Revenue
    const bookingStats = await Booking.aggregate([
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, "$totalPrice", 0],
            },
          },
        },
      },
    ]);

    const stats = bookingStats[0] || {
      totalBookings: 0,
      completedBookings: 0,
      totalRevenue: 0,
    };

    res.json({
      users: totalUsers,
      owners: totalOwners,
      shops: totalShops,
      ...stats,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};

// ADMIN: Get Shop Bookings
exports.getShopBookings = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { status, limit = 50 } = req.query;

    const query = { shopId };
    if (status && status !== "all") {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate("userId", "name phone")
      .populate("barberId", "name")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(bookings);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
};

// ADMIN: Get/Update System Config
const SystemConfig = require("../models/SystemConfig");

exports.getSystemConfig = async (req, res) => {
  try {
    const config = await SystemConfig.findOne({ key: "global" });
    res.json(config);
  } catch (e) {
    res.status(500).json({ message: "Error fetching config" });
  }
};

exports.updateSystemConfig = async (req, res) => {
  try {
    const {
      adminCommissionRate,
      userDiscountRate,
      isPaymentTestMode,
      maxCashBookingsPerMonth,
    } = req.body;
    const config = await SystemConfig.findOneAndUpdate(
      { key: "global" },
      {
        adminCommissionRate,
        userDiscountRate,
        isPaymentTestMode,
        maxCashBookingsPerMonth,
      },
      { new: true, upsert: true },
    );
    res.json(config);
  } catch (e) {
    res.status(500).json({ message: "Error updating config" });
  }
};
