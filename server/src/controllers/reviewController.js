const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Shop = require('../models/Shop');

/**
 * =================================================================================================
 * REVIEW CONTROLLER
 * =================================================================================================
 *
 * Purpose:
 * Handles the creation and retrieval of User Reviews.
 *
 * Key Responsibilities:
 * 1. Validation: Ensures reviews are only linked to 'completed' bookings and are unique (1 booking = 1 review).
 * 2. Creation: Stores the review text and numeric rating (1-5).
 * 3. Aggregation: *Automatically* updates the Shop's average rating and review count whenever a new review is added.
 * =================================================================================================
 */

exports.createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const userId = req.user._id.toString();

    // 1. Validate Input
    if (!bookingId || !rating) {
      return res.status(400).json({ error: 'Booking ID and Rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // 2. Fetch Booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // 3. Verify Ownership and Status
    // Prevents reviewing someone else's booking or a booking that isn't done yet.
    if (booking.userId.toString() !== userId) {
      return res.status(403).json({ error: 'You can only review your own bookings' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ error: 'You can only review completed bookings' });
    }
    if (booking.isRated) {
      return res.status(400).json({ error: 'This booking has already been reviewed' });
    }

    // 4. Create Review
    const review = new Review({
      shopId: booking.shopId,
      bookingId: booking._id,
      userId,
      rating,
      comment
    });
    await review.save();

    // 5. Update Booking
    // Flag the booking as rated so it doesn't appear in the "Rate Now" list again.
    booking.isRated = true;
    await booking.save();

    // 6. Update Shop Stats (Real-time Aggregation)
    // We re-calculate the average rating from scratch to ensure mathematical accuracy.
    const stats = await Review.aggregate([
      { $match: { shopId: booking.shopId } },
      {
        $group: {
          _id: '$shopId',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      // Update the Shop document with the new cached values.
      // This makes searching/sorting shops by rating extremely fast (no need to join Reviews table).
      await Shop.findByIdAndUpdate(booking.shopId, {
        rating: Math.round(stats[0].avgRating * 10) / 10, // Round to 1 decimal (e.g., 4.7)
        reviewCount: stats[0].count
      });
    }

    res.status(201).json({ message: 'Review submitted successfully', review });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getShopReviews = async (req, res) => {
  try {
    const { shopId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ shopId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name avatar'); // Assuming User has name and avatar

    const total = await Review.countDocuments({ shopId });

    res.json({
      reviews,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalReviews: total
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
