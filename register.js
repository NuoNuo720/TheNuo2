const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

exports.handler = async (event) => {
  // 设置默认响应头，确保始终返回JSON
  const headers = {
    'Content-Type': 'application/json',
    // 允许跨域请求
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  // 只允许POST请求
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: '只支持POST请求' }) 
    };
  }

  let client;
  
  try {
    // 验证请求体是否存在
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '请求体不能为空' })
      };
    }

    // 解析请求体，增加错误捕获
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: '无效的JSON格式',
          details: process.env.NODE_ENV === 'development' ? parseError.message : undefined
        })
      };
    }

    const { username, password, email } = requestData;
    
    // 数据验证
    if (!username || !password || !email) {
      return { 
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '用户名、密码和邮箱不能为空' }) 
      };
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '请输入有效的邮箱地址' })
      };
    }

    // 密码强度验证
    if (password.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '密码长度不能少于6个字符' })
      };
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
      return { 
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '用户名已存在' }) 
      };
    }

    // 检查邮箱是否已被使用
    const existingEmail = await usersCollection.findOne({ email });
    if (existingEmail) {
      return { 
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '邮箱已被注册' }) 
      };
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
    
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ 
        message: '注册成功', 
        username: newUser.username,
        token: newUser.token
      })
    };
  } catch (err) {
    console.error('注册函数错误：', err);
    // 确保错误响应也是有效的JSON
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '服务器内部错误',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      })
    };
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