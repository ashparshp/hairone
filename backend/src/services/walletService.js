const User = require("../models/User");
const Booking = require("../models/Booking");
const WalletTransaction = require("../models/WalletTransaction");

const roundMoney = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

class WalletServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const getWalletBalance = async (userId) => {
  const user = await User.findById(userId).select("walletBalance");
  return roundMoney(user?.walletBalance || 0);
};

const creditWallet = async (
  userId,
  amount,
  { reason, referenceType, referenceId, note },
  session = null,
) => {
  const creditAmount = roundMoney(amount);
  if (creditAmount <= 0) {
    throw new WalletServiceError(400, "Credit amount must be positive.");
  }

  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: creditAmount } },
    { returnDocument: 'after', session },
  );

  if (!updated) {
    throw new WalletServiceError(404, "User not found.");
  }

  await WalletTransaction.create(
    [
      {
        userId,
        type: "credit",
        amount: creditAmount,
        balanceAfter: roundMoney(updated.walletBalance),
        reason,
        referenceType,
        referenceId,
        note,
      },
    ],
    session ? { session } : undefined,
  );

  return roundMoney(updated.walletBalance);
};

const debitWallet = async (
  userId,
  amount,
  { reason, referenceType, referenceId, note },
  session = null,
) => {
  const debitAmount = roundMoney(amount);
  if (debitAmount <= 0) {
    return getWalletBalance(userId);
  }

  const updated = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: debitAmount } },
    { $inc: { walletBalance: -debitAmount } },
    { returnDocument: 'after', session },
  );

  if (!updated) {
    throw new WalletServiceError(400, "Insufficient wallet balance.");
  }

  await WalletTransaction.create(
    [
      {
        userId,
        type: "debit",
        amount: debitAmount,
        balanceAfter: roundMoney(updated.walletBalance),
        reason,
        referenceType,
        referenceId,
        note,
      },
    ],
    session ? { session } : undefined,
  );

  return roundMoney(updated.walletBalance);
};

const resolveWalletCredit = async (userId, finalPrice, options = {}) => {
  const { applyWalletCredit = false, walletCreditToUse } = options;
  const balance = await getWalletBalance(userId);

  if (!applyWalletCredit && !(walletCreditToUse > 0)) {
    return {
      walletCreditApplied: 0,
      amountDue: finalPrice,
      walletBalance: balance,
    };
  }

  let walletCreditApplied = 0;
  if (walletCreditToUse > 0) {
    walletCreditApplied = Math.min(
      roundMoney(walletCreditToUse),
      balance,
      finalPrice,
    );
    if (walletCreditApplied < roundMoney(walletCreditToUse)) {
      throw new WalletServiceError(400, "Insufficient wallet balance.");
    }
  } else if (applyWalletCredit) {
    walletCreditApplied = Math.min(balance, finalPrice);
  }

  return {
    walletCreditApplied,
    amountDue: roundMoney(finalPrice - walletCreditApplied),
    walletBalance: balance,
  };
};

const getCancelCreditAmount = (booking) => {
  if (booking.cancelWalletCreditedAt) return 0;
  if (!["upcoming", "pending", "checked-in"].includes(booking.status)) return 0;

  const paymentMethod = (booking.paymentMethod || "CASH").toUpperCase();
  const finalPrice = roundMoney(booking.finalPrice ?? booking.totalPrice ?? 0);
  const walletCreditApplied = roundMoney(booking.walletCreditApplied || 0);
  const isOnlinePaid =
    paymentMethod === "ONLINE" ||
    Boolean(booking.razorpayPaymentId || booking.paymentOrderId);

  if (isOnlinePaid && finalPrice > 0) {
    return finalPrice;
  }

  if (walletCreditApplied > 0) {
    return walletCreditApplied;
  }

  return 0;
};

const creditBookingCancellation = async (booking, session = null) => {
  if (!booking.userId) {
    return booking.cancelWalletCreditAmount || 0;
  }

  const creditAmount = getCancelCreditAmount(booking);
  if (creditAmount <= 0) {
    return booking.cancelWalletCreditAmount || 0;
  }

  const claimed = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      userId: { $ne: null },
      cancelWalletCreditedAt: { $exists: false },
      status: { $in: ["upcoming", "pending", "checked-in"] },
    },
    {
      $set: {
        cancelWalletCreditedAt: new Date(),
        cancelWalletCreditAmount: creditAmount,
      },
    },
    { session, returnDocument: 'after' },
  );

  if (!claimed) {
    return booking.cancelWalletCreditAmount || 0;
  }

  await creditWallet(
    booking.userId,
    creditAmount,
    {
      reason: "booking_cancellation",
      referenceType: "booking",
      referenceId: booking._id,
      note: `Cancellation credit for booking on ${booking.date} ${booking.startTime}`,
    },
    session,
  );

  booking.cancelWalletCreditedAt = claimed.cancelWalletCreditedAt;
  booking.cancelWalletCreditAmount = creditAmount;
  return creditAmount;
};

const REASON_LABELS = {
  unfulfilled_payment: "Booking failed — credited",
  booking_payment: "Used for booking",
  booking_cancellation: "Booking cancelled",
  admin_adjustment: "Account adjustment",
};

const serializeWalletTransaction = (tx) => ({
  id: tx._id,
  type: tx.type,
  amount: roundMoney(tx.amount),
  balanceAfter: roundMoney(tx.balanceAfter),
  reason: tx.reason,
  reasonLabel: REASON_LABELS[tx.reason] || tx.reason,
  note: tx.note || null,
  createdAt: tx.createdAt,
});

const getWalletHistory = async (userId, { limit = 50, page = 1 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [balance, transactions, total] = await Promise.all([
    getWalletBalance(userId),
    WalletTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    WalletTransaction.countDocuments({ userId }),
  ]);

  return {
    balance,
    transactions: transactions.map(serializeWalletTransaction),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: skip + transactions.length < total,
    },
  };
};

module.exports = {
  WalletServiceError,
  roundMoney,
  getWalletBalance,
  creditWallet,
  debitWallet,
  resolveWalletCredit,
  getCancelCreditAmount,
  creditBookingCancellation,
  getWalletHistory,
  REASON_LABELS,
};
