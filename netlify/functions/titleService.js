// titleService.js（补充完整方法）
const Title = require('./models/Title');
const User = require('./models/User');

// 1. 获取用户的所有称号
exports.getUserTitles = async (userId) => {
  return await Title.find({ userId }).sort({ createdAt: -1 });
};

// 2. 获取当前佩戴的称号
exports.getCurrentTitle = async (userId) => {
  // 先查用户表，获取当前佩戴的称号ID
  const user = await User.findById(userId, 'profile.currentTitleId');
  if (!user?.profile?.currentTitleId) {
    return null; // 未佩戴任何称号
  }

  // 再查称号详情
  const title = await Title.findById(user.profile.currentTitleId);
  return title ? {
    id: title._id,
    name: title.name,
    icon: title.icon,
    description: title.description
  } : null;
};

// 3. 创建用户自建称号
exports.createUserTitle = async (titleData) => {
  const { name, description, icon, userId } = titleData;
  if (!name || !description) {
    throw new Error('称号名称和描述不能为空');
  }

  const newTitle = new Title({
    name,
    description,
    icon: icon || 'trophy',
    userId,
    createdAt: new Date()
  });

  return await newTitle.save();
};

// 4. 佩戴/切换称号
exports.equipTitle = async (userId, titleId) => {
  // 验证称号是否属于该用户
  const title = await Title.findOne({ _id: titleId, userId });
  if (!title) {
    throw new Error('称号不存在或不属于当前用户');
  }

  // 更新用户的当前称号
  await User.findByIdAndUpdate(userId, {
    'profile.currentTitleId': titleId,
    'profile.updatedAt': new Date()
  });

  return {
    message: `已佩戴称号：${title.name}`,
    title: {
      id: title._id,
      name: title.name,
      icon: title.icon
    }
  };
};