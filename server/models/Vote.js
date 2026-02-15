const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema(
  {
    pollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Poll',
      required: true,
    },
    optionIndex: {
      type: Number,
      required: true,
    },
    visitorId: {
      type: String,
      required: true,
    },
    ip: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Unique compound index: one vote per visitor per poll
voteSchema.index({ pollId: 1, visitorId: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);
