const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// 1. 连接数据库（替换为你的MongoDB连接字符串）
mongoose.connect('mongodb+srv://3668417644:nuonuo001@cluster0.u1nuqn9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('数据库连接成功'))
.catch(err => {
  console.error('连接失败:', err);
  process.exit(1); // 连接失败时退出脚本
});

// 2. 定义管理员模型（只定义一次，不要重复导入）
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// 3. 创建模型（确保只声明一次Admin）
const Admin = mongoose.model('Admin', adminSchema);

// 4. 创建管理员账号
async function createAdmin() {
  try {
    // 密码加密
    const plainPassword = 'NuoNuo001'; // 替换为你的密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    // 检查是否已存在同名管理员
    const existingAdmin = await Admin.findOne({ username: 'admin' });
    if (existingAdmin) {
      console.log('管理员账号已存在！');
      mongoose.disconnect();
      return;
    }

    // 创建新管理员
    const admin = new Admin({
      username: 'TheNuo', // 管理员用户名
      password: hashedPassword
    });

    await admin.save();
    console.log('管理员账号创建成功！');
    mongoose.disconnect(); // 关闭数据库连接
  } catch (err) {
    console.error('创建失败:', err);
    mongoose.disconnect();
  }
}

// 执行创建
createAdmin();