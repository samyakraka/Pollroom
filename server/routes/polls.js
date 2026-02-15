const express = require('express');
const { nanoid } = require('nanoid');
const crypto = require('crypto');
const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const { voteLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Helper: hash an IP address for privacy-preserving storage
function hashIP(ip) {
  return crypto.createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 16);
}

// Duration presets (in minutes)
const VALID_DURATIONS = [15, 60, 360, 1440, 10080]; // 15m, 1h, 6h, 24h, 7d

// ─── GET /api/polls/feed — Browse recent public polls ───
router.get('/feed', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 12);
    const skip = (page - 1) * limit;

    const filter = { isPublic: { $ne: false } };

    // Optional: filter by active only
    if (req.query.active === 'true') {
      filter.$or = [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ];
    }

    const [polls, total] = await Promise.all([
      Poll.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Poll.countDocuments(filter),
    ]);

    const enrichedPolls = polls.map((p) => ({
      shareId: p.shareId,
      question: p.question,
      optionCount: p.options.length,
      totalVotes: p.totalVotes,
      expiresAt: p.expiresAt,
      isExpired: p.expiresAt ? new Date() > p.expiresAt : false,
      createdAt: p.createdAt,
    }));

    res.json({
      polls: enrichedPolls,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Failed to load polls.' });
  }
});

// ─── POST /api/polls — Create a new poll ───
router.post('/', async (req, res) => {
  try {
    const { question, options, duration } = req.body;

    // Validate question
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
      return res.status(400).json({ error: 'Please provide between 2 and 10 options.' });
    }

    const trimmedOptions = options
      .map((opt) => (typeof opt === 'string' ? opt.trim() : ''))
      .filter((opt) => opt.length > 0);

    if (trimmedOptions.length < 2) {
      return res.status(400).json({ error: 'At least 2 non-empty options are required.' });
    }

    const shareId = nanoid(8);

    // Calculate expiry if duration provided
    let expiresAt = null;
    if (duration && typeof duration === 'number' && VALID_DURATIONS.includes(duration)) {
      expiresAt = new Date(Date.now() + duration * 60 * 1000);
    }

    const poll = await Poll.create({
      shareId,
      question: question.trim(),
      options: trimmedOptions.map((text) => ({ text, votes: 0 })),
      totalVotes: 0,
      expiresAt,
    });

    res.status(201).json({
      poll: {
        shareId: poll.shareId,
        question: poll.question,
        options: poll.options,
        totalVotes: poll.totalVotes,
        expiresAt: poll.expiresAt,
        createdAt: poll.createdAt,
      },
      shareUrl: `/poll/${poll.shareId}`,
    });
  } catch (err) {
    console.error('Create poll error:', err);
    res.status(500).json({ error: 'Failed to create poll.' });
  }
});

// ─── GET /api/polls/:shareId — Get poll data ───
router.get('/:shareId', async (req, res) => {
  try {
    const poll = await Poll.findOne({ shareId: req.params.shareId }).lean();

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found.' });
    }

    // Check if visitor has already voted
    let hasVoted = false;
    let votedOption = null;

    const visitorId = req.query.visitorId;
    if (visitorId) {
      const existingVote = await Vote.findOne({
        pollId: poll._id,
        visitorId,
      }).lean();

      if (existingVote) {
        hasVoted = true;
        votedOption = existingVote.optionIndex;
      }
    }

    const isExpired = poll.expiresAt ? new Date() > poll.expiresAt : false;

    res.json({
      poll: {
        shareId: poll.shareId,
        question: poll.question,
        options: poll.options,
        totalVotes: poll.totalVotes,
        expiresAt: poll.expiresAt,
        createdAt: poll.createdAt,
      },
      hasVoted,
      votedOption,
      isExpired,
    });
  } catch (err) {
    console.error('Get poll error:', err);
    res.status(500).json({ error: 'Failed to load poll.' });
  }
});

// ─── GET /api/polls/:shareId/activity — Get recent vote activity ───
router.get('/:shareId/activity', async (req, res) => {
  try {
    const poll = await Poll.findOne({ shareId: req.params.shareId }).lean();
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found.' });
    }

    // Get vote timestamps for the last hour, bucketed into 1-minute intervals
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const activity = await Vote.aggregate([
      { $match: { pollId: poll._id, createdAt: { $gte: oneHourAgo } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%dT%H:%M',
              date: '$createdAt',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 60 },
    ]);

    // Votes in last 5 minutes for velocity
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentCount = await Vote.countDocuments({
      pollId: poll._id,
      createdAt: { $gte: fiveMinAgo },
    });

    res.json({
      activity: activity.map((a) => ({ time: a._id, count: a.count })),
      velocity: Math.round((recentCount / 5) * 10) / 10, // votes per minute
      recentVotes: recentCount,
    });
  } catch (err) {
    console.error('Activity error:', err);
    res.status(500).json({ error: 'Failed to load activity.' });
  }
});

// ─── POST /api/polls/:shareId/vote — Cast a vote ───
router.post('/:shareId/vote', voteLimiter, async (req, res) => {
  try {
    const { optionIndex, visitorId } = req.body;

    if (typeof optionIndex !== 'number' || !visitorId) {
      return res.status(400).json({ error: 'optionIndex and visitorId are required.' });
    }

    const poll = await Poll.findOne({ shareId: req.params.shareId });
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found.' });
    }

    // Check expiry
    if (poll.expiresAt && new Date() > poll.expiresAt) {
      return res.status(403).json({ error: 'This poll has ended.' });
    }

    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ error: 'Invalid option index.' });
    }

    // Check for duplicate vote
    const existingVote = await Vote.findOne({ pollId: poll._id, visitorId });
    if (existingVote) {
      return res.status(409).json({ error: 'You have already voted on this poll.' });
    }

    // Hash IP for privacy
    const clientIP =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const hashedIP = hashIP(clientIP);

    // Save vote
    await Vote.create({
      pollId: poll._id,
      optionIndex,
      visitorId,
      ip: hashedIP,
    });

    // Update poll counts atomically
    poll.options[optionIndex].votes += 1;
    poll.totalVotes += 1;
    await poll.save();

    const updatedPoll = {
      shareId: poll.shareId,
      question: poll.question,
      options: poll.options,
      totalVotes: poll.totalVotes,
      expiresAt: poll.expiresAt,
      createdAt: poll.createdAt,
    };

    // Broadcast to Socket.IO room
    const io = req.app.get('io');
    if (io) {
      io.to(`poll:${poll.shareId}`).emit('vote:update', {
        options: poll.options,
        totalVotes: poll.totalVotes,
        timestamp: new Date().toISOString(),
        optionIndex,
      });
    }

    res.json({ poll: updatedPoll });
  } catch (err) {
    // Handle MongoDB duplicate key error (race condition safety net)
    if (err.code === 11000) {
      return res.status(409).json({ error: 'You have already voted on this poll.' });
    }
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Failed to cast vote.' });
  }
});

module.exports = router;
