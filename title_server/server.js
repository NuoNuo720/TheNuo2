const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

// 1. 连接你的MongoDB（替换成你的连接字符串）
const mongoUri = 'mongodb+srv://<db_username>:<db_password>@cluster0.u1nuqn9.mongodb.net/userdb?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoUri)
  .then(() => console.log('已连接MongoDB，可以直接读数据了'))
  .catch(err => console.error('连接失败:', err));

// 定义称号的数据结构（和你手动添加的字段对应）
const titleSchema = new mongoose.Schema({
  userId: String,
  titleName: String,
  description: String,
  icon: String,
  isExclusive: Boolean,
  createdAt: String
});
const Title = mongoose.model('Title', titleSchema);

// 2. 前端读取用户的称号（直接从数据库查）
app.get('/getTitles/:userId', async (req, res) => {
  try {
    // 直接查数据库中这个用户的所有称号
    const titles = await Title.find({ userId: req.params.userId });
    res.json(titles); // 返回给前端
  } catch (err) {
    res.json({ error: '读取失败' });
  }
});

// 3. 大小号同步称号（带验证码）
// 存储验证码（实际项目可以存在数据库，这里简化用变量）
let verifyCodes = {};

// 生成验证码
app.post('/getVerifyCode', (req, res) => {
  const { sourceUserId, targetUserId } = req.body;
  // 生成6位验证码
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  // 保存验证码（有效期5分钟）
  verifyCodes[code] = { sourceUserId, targetUserId, expires: Date.now() + 300000 };
  res.json({ code }); // 返回验证码给前端
});

// 验证并同步
app.post('/syncWithCode', async (req, res) => {
  const { code } = req.body;
  const verifyInfo = verifyCodes[code];
  
  if (!verifyInfo || verifyInfo.expires < Date.now()) {
    return res.json({ error: '验证码无效或已过期' });
  }
  
  try {
    // 从源用户（大号）复制称号到目标用户（小号）
    const titles = await Title.find({ userId: verifyInfo.sourceUserId });
    const newTitles = titles.map(title => ({
      ...title.toObject(),
      userId: verifyInfo.targetUserId // 改成小号的ID
    }));
    await Title.insertMany(newTitles);
    
    // 同步后删除验证码
    delete verifyCodes[code];
    res.json({ success: true, message: `同步了${newTitles.length}个称号` });
  } catch (err) {
    res.json({ error: '同步失败' });
  }
});

// 启动服务（端口3000）
app.listen(3000, () => {
  console.log('极简后端启动：http:// thenuo2.netlify.app');
});
// 管理员给指定用户授予称号（跨账号核心接口）
app.post('/api/admin/grantTitle', async (req, res) => {
  try {
    const { adminToken, targetUserId, titleName, description, icon, isExclusive } = req.body;

    // 1. 验证管理员权限（简单版：用固定token，正式环境可换成密码/登录验证）
    const ADMIN_TOKEN = "NuoNuo001"; // 自己设置一个管理员密钥（比如 "admin123"）
    if (adminToken !== ADMIN_TOKEN) {
      return res.json({ error: "无管理员权限" });
    }

    // 2. 给目标用户（朋友的userId）添加称号到数据库
    const newTitle = new Title({
      userId: targetUserId, // 朋友的用户ID
      titleName,
      description,
      icon: icon || "trophy",
      isExclusive: isExclusive || false,
      createdAt: new Date().toLocaleDateString()
    });
    await newTitle.save();

    res.json({ success: true, message: `已给用户 ${targetUserId} 授予称号：${titleName}` });
  } catch (err) {
    res.json({ error: "授予失败", detail: err.message });
  }
});