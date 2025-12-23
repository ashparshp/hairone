const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Shop = require('../models/Shop');

exports.createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const userId = req.user.userId;

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
    booking.isRated = true;
    await booking.save();

    // 6. Update Shop Stats (Atomic Update if possible, but calculating avg is easier with 2 queries or aggregation)
    // We will do a fresh aggregation to be accurate.
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
      await Shop.findByIdAndUpdate(booking.shopId, {
        rating: Math.round(stats[0].avgRating * 10) / 10, // Round to 1 decimal
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
