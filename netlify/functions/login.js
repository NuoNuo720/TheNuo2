const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  // 改进CORS配置，支持移动端跨域
  const allowedOrigins = ['https://thenuo2.netlify.app', 'https://www.thenuo2.netlify.app'];
  const origin = event.headers.origin || event.headers.Origin || ''; // 兼容不同浏览器的Origin头写法
  const allowOrigin = allowedOrigins.includes(origin) ? origin : '*'; // 允许所有来源作为 fallback
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store, no-cache' // 防止移动端缓存导致的问题
  };             
  
  // 处理预检请求（OPTIONS）
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204, // 使用204 No Content更符合规范
      headers,
      body: '' // 预检请求不需要返回内容
    };
  }

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

    // 解析请求体，增加错误处理
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '无效的JSON格式，请检查输入' })
      };
    }

    const { username, password } = requestData;
    
    // 验证必要参数
    if (!username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '用户名和密码不能为空' })
      };
    }

    // 验证环境变量
    if (!process.env.MONGODB_URI) {
      throw new Error('数据库配置错误');
    }
    
    if (!process.env.JWT_SECRET) {
      throw new Error('认证配置错误');
    }

    // 改进数据库连接 - 增加重试机制和更长超时
    const connectWithRetry = async (uri, retries = 2) => {
      let lastError;
      for (let i = 0; i <= retries; i++) {
        try {
          const client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 8000, // 服务器选择超时
            connectTimeoutMS: 8000 // 连接超时
          });
          await client.connect();
          return client;
        } catch (err) {
          lastError = err;
          if (i < retries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // 指数退避
          }
        }
      }
      throw lastError || new Error('数据库连接失败');
    };
    
    client = await connectWithRetry(process.env.MONGODB_URI);
    
    const db = client.db('userDB');
    const usersCollection = db.collection('users');

    // 查询用户
    const user = await usersCollection.findOne({ username });
    if (!user) {
      return { 
        statusCode: 401, 
        headers,
        body: JSON.stringify({ error: '用户名或密码不正确' }) // 模糊错误信息，提高安全性
      };
    }

    // 验证密码
    if (!user.password) {
      throw new Error('用户数据不完整');
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return { 
        statusCode: 401, 
        headers,
        body: JSON.stringify({ error: '用户名或密码不正确' }) // 模糊错误信息
      };
    }

    // 生成JWT令牌 - 增加算法指定
    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      process.env.JWT_SECRET,
      { 
        expiresIn: '24h',
        algorithm: 'HS256' // 明确指定算法
      }
    );

    // 更新数据库中的token
    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { token: token, lastLogin: new Date() } }
    );

    // 返回成功结果
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: '登录成功', 
        username: user.username,
        id: user._id.toString(),
        token: token
      })
    };

  } catch (err) {
    console.error('登录处理错误:', err);
    // 为移动端提供更友好的错误信息
    const errorMessages = {
      '数据库连接超时': '网络连接缓慢，请稍后再试',
      '数据库连接失败': '无法连接到服务器，请检查网络',
      '认证配置错误': '系统暂时无法处理登录请求'
    };
    
    const userMessage = errorMessages[err.message] || '登录失败，请稍后重试';
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: userMessage
      })
    };
  } finally {
    // 确保连接关闭
    if (client) {
      try {
        await client.close();
      } catch (closeErr) {
        console.error('关闭数据库连接错误:', closeErr);
      }
    }
  }
};