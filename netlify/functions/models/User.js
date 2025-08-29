const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs'); // 用于密码加密

const TitleSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  icon: { type: String }, // Font Awesome类名或图标URL
  isAdminGranted: { type: Boolean, default: false },
  isCustom: { type: Boolean, default: false }, // 新增：是否自定义称号
  colorClass: { type: String }, // 新增：称号颜色样式
  createdAt: { type: Date, default: Date.now },
  isEquipped: { type: Boolean, default: false }
});

const UserSchema = new Schema({
  username: { 
    type: String, 
    required: [true, '用户名不能为空'], 
    unique: true, 
    trim: true,
    minlength: [3, '用户名至少3个字符']
  },
  password: { 
    type: String, 
    required: [true, '密码不能为空'],
    minlength: [6, '密码至少6个字符'],
    select: false // 默认查询时不返回密码
  },
  email: { 
    type: String, 
    unique: true,
    trim: true,
    lowercase: true
  },
  isAdmin: { type: Boolean, default: false },
  titles: [TitleSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 密码加密中间件
UserSchema.pre('save', async function(next) {
  // 只有密码被修改时才重新加密
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// 验证密码方法
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// 获取当前佩戴的称号
UserSchema.methods.getCurrentEquippedTitle = function() {
  return this.titles.find(title => title.isEquipped) || null;
};

// 添加称号方法
UserSchema.methods.addTitle = function(titleData) {
  // 先取消所有已佩戴的称号
  this.titles.forEach(title => {
    title.isEquipped = false;
  });
  
  // 添加新称号并设为佩戴状态
  this.titles.push({
    ...titleData,
    isEquipped: true
  });
  
  return this.save();
};

// 佩戴/取消佩戴称号
UserSchema.methods.toggleTitleEquip = function(titleId, equip = true) {
  const titleIndex = this.titles.findIndex(t => t._id.toString() === titleId);
  
  if (titleIndex === -1) {
    throw new Error('称号不存在');
  }
  
  // 如果要佩戴新称号，先取消所有已佩戴的
  if (equip) {
    this.titles.forEach(title => {
      title.isEquipped = false;
    });
  }
  
  this.titles[titleIndex].isEquipped = equip;
  return this.save();
};

module.exports = mongoose.model('User', UserSchema);