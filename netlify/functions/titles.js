const { MongoClient } = require('mongodb');

exports.handler = async (event) => {
  // 配置CORS，允许跨域请求
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    // 1. 从请求中获取username（同时支持GET和POST方式）
    let username;
    if (event.httpMethod === 'GET') {
      // 支持GET请求从查询参数获取
      username = event.queryStringParameters?.username;
    } else if (event.httpMethod === 'POST') {
      // 支持POST请求从请求体获取
      const body = JSON.parse(event.body || '{}');
      username = body.username;
    }

    // 验证参数
    if (!username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: '缺少username参数' })
      };
    }
    
    // 验证数据库连接配置
    if (!process.env.MONGODB_URI) {
      throw new Error('数据库连接字符串未配置');
    }
    
    // 2. 连接数据库并查询（使用username作为查询条件）
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db('your-db-name');
    // 使用username字段匹配，与前端保持一致
    const titles = await db.collection('titles')
      .find({ username: username }) // 关键：使用username作为查询条件
      .sort({ createdAt: -1 }) // 按创建时间倒序排列
      .toArray();
      
    await client.close();
    
    // 3. 返回查询结果
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(titles)
    };
  } catch (error) {
    console.error('称号查询错误:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: '获取称号时发生错误',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};