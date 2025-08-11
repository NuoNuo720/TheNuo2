require('dotenv').config();
const mongoose = require('mongoose');
const { ObjectId } = require('mongoose').Types; // 引入ObjectId类型

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('数据库连接成功');

  // 直接使用test用户的_id查询（替换为你的实际_id）
  const testUserId = new ObjectId('689598f3b1ff5ef4d0699c8f');
  const testUser = await mongoose.connection.collection('user').findOne({ _id: testUserId });

  if (!testUser) {
    console.error('未找到test用户（通过_id）');
    mongoose.disconnect();
    return;
  }

  // 添加两个新称号
  const newTitles = [
    { 
      id: "002", 
      name: "游戏先锋", 
      description: "首批注册的忠实玩家", 
      icon: "star", 
      createdAt: new Date().toISOString() 
    },
    { 
      id: "003", 
      name: "社交达人", 
      description: "累计添加100位好友", 
      icon: "users", 
      createdAt: new Date().toISOString() 
    }
  ];

  // 合并现有称号（避免重复）
  const existingTitles = testUser.titles || [];
  const titlesToKeep = existingTitles.filter(title => 
    !newTitles.some(newTitle => newTitle.id === title.id)
  );
  const updatedTitles = [...titlesToKeep, ...newTitles];

  // 更新数据库
  await mongoose.connection.collection('user').updateOne(
    { _id: testUserId },
    { $set: { titles: updatedTitles } }
  );

  console.log('成功给test用户添加两个称号');
  mongoose.disconnect();
})
.catch(err => {
  console.error('错误:', err);
  mongoose.disconnect();
});