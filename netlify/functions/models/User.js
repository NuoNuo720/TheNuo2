const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  avatar: { type: String, default: '' },
  loginTime: { type: Date, default: Date.now },
  profile: {
    currentTitleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Title' }
  }
});

module.exports = mongoose.model('User', userSchema);