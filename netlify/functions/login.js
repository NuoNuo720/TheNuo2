const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // 新增：导入JWT模块

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: '只支持POST请求' }) };
  }

  let client; // 声明在外部，确保finally能访问
  try {
    const { username, password } = JSON.parse(event.body);
    
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db('userDB');
    const usersCollection = db.collection('users');

    // 1. 查询用户
    const user = await usersCollection.findOne({ username });
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: '用户名不存在' }) };
    }

    // 2. 验证密码（移除明文打印）
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return { statusCode: 401, body: JSON.stringify({ error: '密码错误' }) };
    }

    // 3. 动态生成JWT令牌（核心修复）
    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username }, // 存储用户ID和用户名
      process.env.JWT_SECRET, // 使用环境变量中的密钥
      { expiresIn: '24h' } // 设置过期时间（24小时）
    );

    // 4. 可选：更新数据库中的token（如果需要持久化）
    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { token: token } }
    );

    // 5. 返回成功结果
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: '登录成功', 
        username: user.username,
        id: user._id.toString(), // 新增：返回用户ID（前端需要）
        token: token // 返回新生成的token
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '服务器错误', details: err.message })
    };
  } finally {
    // 确保连接始终关闭（修复连接泄漏）
    if (client) {
      await client.close();
    }
  }
};
