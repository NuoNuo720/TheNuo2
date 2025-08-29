const mongoose = require('mongoose');
const User = require('./models/User');  // 确保User模型正确映射到users集合

// 数据库连接配置 - 修改为连接userDB数据库
const dbConnectionString = 'mongodb+srv://3668417644:nuonuo001@cluster0.u1nuqn9.mongodb.net/userDB?retryWrites=true&w=majority&appName=Cluster0';
const targetUsername = 'good2';  // 要操作的用户名

// 连接数据库函数
async function connectDB() {
  try {
    await mongoose.connect(dbConnectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('数据库连接成功');
    console.log('当前连接的数据库:', mongoose.connection.name); // 应该显示为userDB
    return true;
  } catch (err) {
    console.error('数据库连接失败:', err);
    return false;
  }
}

// 查询所有用户的用户名（从users集合）
async function listAllUsers() {
  try {
    // 这将从users集合查询所有文档
    const users = await User.find({}, 'username');
    if (users.length === 0) {
      console.log('users集合中没有找到任何用户');
      return;
    }
    console.log('\nusers集合中的所有用户:');
    users.forEach(user => console.log('-', user.username));
  } catch (err) {
    console.error('查询用户列表失败:', err);
  }
}

// 检查指定用户的管理员状态
async function checkAdminStatus(username) {
  try {
    const user = await User.findOne({ username: username }, 'username isAdmin');
    if (!user) {
      console.log(`\nusers集合中未找到用户: ${username}`);
      return false;
    }
    console.log(`\n用户 ${username} 的状态: 管理员权限 = ${user.isAdmin ? '开启' : '关闭'}`);
    return user;
  } catch (err) {
    console.error('检查管理员状态失败:', err);
    return false;
  }
}

// 设置用户为管理员
async function makeAdmin(username) {
  try {
    const result = await User.updateOne(
      { username: username },
      { $set: { isAdmin: true } }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`\n成功将users集合中的用户 ${username} 设置为管理员`);
    } else if (result.matchedCount > 0) {
      console.log(`\nusers集合中的用户 ${username} 已是管理员，无需重复设置`);
    } else {
      console.log(`\nusers集合中未找到用户 ${username}`);
    }
  } catch (err) {
    console.error('设置管理员失败:', err);
  }
}

// 主执行函数
async function main() {
  // 连接数据库
  const isConnected = await connectDB();
  if (!isConnected) return;

  // 执行一系列操作
  await listAllUsers();                // 列出users集合中的所有用户
  await checkAdminStatus(targetUsername);  // 检查目标用户当前状态
  await makeAdmin(targetUsername);     // 尝试设置为管理员
  await checkAdminStatus(targetUsername);  // 再次检查状态确认结果

  // 断开连接
  mongoose.disconnect();
  console.log('\n数据库连接已关闭');
}

// 启动程序
main();