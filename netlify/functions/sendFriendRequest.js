const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = await MongoClient.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const db = client.db(MONGODB_DB);
  cachedDb = db;
  return db;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS' // 允许POST方法
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // 确保只处理POST请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: '只允许POST请求' })
    };
  }

  try {
    // 解析请求体
    const data = JSON.parse(event.body);
    const { sender, recipient } = data;
    
    if (!sender || !recipient) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少发送者或接收者信息' })
      };
    }

    // 检查用户是否存在
    const db = await connectToDatabase();
    const recipientUser = await db.collection('users').findOne({ username: recipient });
    
    if (!recipientUser) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '用户不存在' })
      };
    }

    // 检查是否已发送过请求
    const existingRequest = await db.collection('friendRequests').findOne({
      sender,
      recipient,
      status: { $in: ['pending', 'accepted'] }
    });

    if (existingRequest) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: '已发送过好友请求' })
      };
    }

    // 创建新的好友请求
    const newRequest = {
      sender,
      recipient,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    await db.collection('friendRequests').insertOne(newRequest);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: '好友请求已发送',
        request: newRequest
      })
    };
  } catch (error) {
    console.error('发送好友请求失败:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '发送好友请求失败' })
    };
  }
};