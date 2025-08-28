const mongoose = require('mongoose');

const titleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: 'trophy' },
  createdAt: { type: Date, default: Date.now },
  username: { type: String, ref: 'User', required: true }
});

module.exports = mongoose.model('Title', titleSchema);