const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

// 封装安全的JSON字符串化函数
const safeStringify = (data) => {
  try {
    return JSON.stringify(data);
  } catch (e) {
    console.error('JSON序列化失败:', e);
    // 返回一个保底的错误信息
    return JSON.stringify({ error: '服务器响应序列化失败' });
  }
};

exports.handler = async (event) => {
  // 初始化响应对象，确保即使在最极端情况下也有默认响应
  let response = {
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: safeStringify({ error: '服务器处理请求时发生未知错误' })
  };

  let client;
  
  try {
    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
      response.statusCode = 200;
      response.body = safeStringify({ status: 'OK' });
      return response;
    }

    // 只允许POST请求
    if (event.httpMethod !== 'POST') {
      response.statusCode = 405;
      response.body = safeStringify({ error: '只支持POST请求' });
      return response;
    }

    // 验证请求体是否存在
    if (!event.body) {
      response.statusCode = 400;
      response.body = safeStringify({ error: '请求体不能为空' });
      return response;
    }

    // 解析请求体
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (parseError) {
      response.statusCode = 400;
      response.body = safeStringify({ 
        error: '无效的JSON格式',
        details: process.env.NODE_ENV === 'development' ? parseError.message : undefined
      });
      return response;
    }

    const { username, password, email } = requestData;
    
    // 数据验证
    if (!username || !password || !email) {
      response.statusCode = 400;
      response.body = safeStringify({ error: '用户名、密码和邮箱不能为空' });
      return response;
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      response.statusCode = 400;
      response.body = safeStringify({ error: '请输入有效的邮箱地址' });
      return response;
    }

    // 密码强度验证
    if (password.length < 6) {
      response.statusCode = 400;
      response.body = safeStringify({ error: '密码长度不能少于6个字符' });
      return response;
    }

    // 检查数据库连接字符串
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI环境变量未配置');
    }

    // 连接数据库
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('userDB');
    const usersCollection = db.collection('users');

    // 检查用户名是否已存在
    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) {
      response.statusCode = 400;
      response.body = safeStringify({ error: '用户名已存在' });
      return response;
    }

    // 检查邮箱是否已被使用
    const existingEmail = await usersCollection.findOne({ email });
    if (existingEmail) {
      response.statusCode = 400;
      response.body = safeStringify({ error: '邮箱已被注册' });
      return response;
    }

    // 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 生成用户token
    const token = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 插入新用户到数据库
    const newUser = {
      username,
      password: hashedPassword,
      email,
      token,
      createdAt: new Date(),
      friends: [],
      friendRequests: []
    };
    
    await usersCollection.insertOne(newUser);
    
    response.statusCode = 201;
    response.body = safeStringify({ 
      message: '注册成功', 
      username: newUser.username,
      token: newUser.token
    });
    
    return response;
  } catch (err) {
    console.error('注册函数错误：', err);
    // 确保错误响应也是有效的JSON
    response.statusCode = 500;
    response.body = safeStringify({ 
      error: '服务器内部错误',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
    return response;
  } finally {
    // 确保客户端连接总是被关闭
    if (client) {
      try {
        await client.close();
      } catch (closeErr) {
        console.error('关闭数据库连接错误：', closeErr);
      }
    }
  }
};