const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

exports.handler = async (event) => {
  // 只允许POST请求
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '只支持POST请求' }) 
    };
  }

  let client; // 在外部声明客户端，以便在finally中关闭连接
  
  try {
    // 解析前端发送的注册数据
    const { username, password, email } = JSON.parse(event.body);
    
    // 前端数据验证（避免空值）
    if (!username || !password || !email) {
      return { 
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '用户名、密码和邮箱不能为空' }) 
      };
    }

    // 连接数据库
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('userDB'); // 数据库名：userDB
    const usersCollection = db.collection('users'); // 集合名：users

    // 检查用户名是否已存在
    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) {
      return { 
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '用户名已存在' }) 
      };
    }

    // 检查邮箱是否已被使用
    const existingEmail = await usersCollection.findOne({ email });
    if (existingEmail) {
      return { 
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '邮箱已被注册' }) 
      };
    }

    // 加密密码（使用bcrypt）
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 生成用户token
    const token = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 插入新用户到数据库
    const newUser = {
      username,
      password: hashedPassword, // 存储加密后的密码
      email,
      token,
      createdAt: new Date(),
      friends: [],
      friendRequests: []
    };
    
    const result = await usersCollection.insertOne(newUser);
    
    // 关闭连接并返回成功响应
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: '注册成功', 
        username: newUser.username,
        token: newUser.token
      })
    };
  } catch (err) {
    // 捕获所有错误并输出日志
    console.error('注册函数错误：', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: '服务器内部错误',
        // 生产环境建议移除details
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      })
    };
  } finally {
    // 确保客户端连接总是被关闭
    if (client) {
      try {
        await client.close();
      } catch (closeErr) {
        console.error('关闭数据库连接错误：', closeErr.message);
      }
    }
  }
};