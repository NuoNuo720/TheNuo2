const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TitleSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  icon: { type: String }, // 称号图标URL
  isAdminGranted: { type: Boolean, default: false }, // 是否管理员授予
  createdAt: { type: Date, default: Date.now },
  isEquipped: { type: Boolean, default: false }
});

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true }, // 实际项目中应存储哈希值
  isAdmin: { type: Boolean, default: false },
  titles: [TitleSchema],
  currentTitle: { type: Schema.Types.ObjectId, ref: 'Title' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 中间件：更新updatedAt字段
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 方法：获取用户所有称号
UserSchema.methods.getAllTitles = function() {
  return this.titles;
};

// 方法：获取当前佩戴的称号
UserSchema.methods.getCurrentEquippedTitle = function() {
  return this.titles.find(title => title.isEquipped) || null;
};

// 静态方法：通过用户名查找用户（包含称号）
UserSchema.statics.findByUsernameWithTitles = async function(username) {
  return this.findOne({ username }).lean();
};

module.exports = mongoose.model('User', UserSchema);
