const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: 'https://picsum.photos/200' },
  loginTime: { type: Date, default: Date.now },
  profile: {
    currentTitleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Title' },
    // 其他个人资料字段
  },
  isAdmin: { type: Boolean, default: false }, // 管理员标识，默认false
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  friends: [{ type: String, ref: 'User', refPath: 'username' }],
  friendRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
  }]
}, { timestamps: true });

// 密码加密方法
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// 密码验证方法
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});
module.exports = mongoose.model('User', userSchema);
