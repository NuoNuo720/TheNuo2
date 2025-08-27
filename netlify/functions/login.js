const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  // 设置CORS headers，解决跨域问题           
  const allowedOrigins = ['https://thenuo2.netlify.app']; // 你的Netlify域名
  const origin = event.headers.origin || '';
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, User-Agent',
    'Access-Control-Allow-Credentials': 'true                                                                                                                                                                                                                                                                                                
  };             
  
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
        body: JSON.stringify({ error: '无效的JSON格式', details: parseError.message })
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
      throw new Error('MONGODB_URI环境变量未配置');
    }
    
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET环境变量未配置');
    }

    // 连接数据库
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db('userDB');
    const usersCollection = db.collection('users');

    // 查询用户
    const user = await usersCollection.findOne({ username });
    if (!user) {
      return { 
        statusCode: 401, 
        headers,
        body: JSON.stringify({ error: '用户名不存在' }) 
      };
    }

    // 验证密码
    if (!user.password) {
      throw new Error('用户记录中缺少密码字段');
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return { 
        statusCode: 401, 
        headers,
        body: JSON.stringify({ error: '密码错误' }) 
      };
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
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
    console.error('登录处理错误:', err); // 记录详细错误到日志
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '服务器内部错误', 
        // 生产环境可以去掉details，避免泄露敏感信息
        details: process.env.NODE_ENV === 'development' ? err.message : undefined 
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