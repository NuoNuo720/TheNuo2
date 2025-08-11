const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

// 最简单的错误处理包装器
const withErrorHandling = (fn) => async (event) => {
  try {
    // 立即返回一个简单响应测试基础功能
    // 注释掉下面这行以测试完整功能
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '测试响应：函数运行正常' })
    };

    // 基础CORS设置
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers };
    }

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: '只支持POST请求' })
      };
    }

    // 执行实际逻辑
    return await fn(event, headers);
  } catch (err) {
    console.error('致命错误:', err);
    // 最简化的错误响应，确保JSON有效
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: '服务器错误',
        message: '注册过程中发生错误'
      })
    };
  }
};

// 实际处理逻辑
const handleRegister = async (event, headers) => {
  let client;
  
  try {
    // 解析请求数据
    const { username, password, email } = JSON.parse(event.body || '{}');
    
    // 基础验证
    if (!username || !password || !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '所有字段都是必填的' })
      };
    }

    // 连接数据库
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('userDB');
    const usersCollection = db.collection('users');

    // 检查用户名和邮箱
    const [existingUser, existingEmail] = await Promise.all([
      usersCollection.findOne({ username }),
      usersCollection.findOne({ email })
    ]);

    if (existingUser) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '用户名已存在' })
      };
    }

    if (existingEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '邮箱已被注册' })
      };
    }

    // 加密密码并创建用户
    const hashedPassword = await bcrypt.hash(password, 10);
    const token = `user_${Date.now()}`;
    
    const newUser = {
      username,
      password: hashedPassword,
      email,
      token,
      createdAt: new Date()
    };
    
    await usersCollection.insertOne(newUser);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: '注册成功',
        username,
        token
      })
    };
  } finally {
    if (client) {
      await client.close().catch(err => console.error('关闭连接错误:', err));
    }
  }
};

// 导出包装后的处理函数
exports.handler = withErrorHandling(handleRegister);