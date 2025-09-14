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
  // 关键：配置跨域和允许的方法
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS' // 明确允许GET方法
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // 确保只处理GET请求
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: '只允许GET请求' })
    };
  }

  try {
    const username = event.queryStringParameters.username;
    
    if (!username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少用户名参数' })
      };
    }

    const db = await connectToDatabase();
    
    // 查询该用户收到的好友请求
    const requests = await db.collection('friendRequests').find({
      recipient: username,
      status: 'pending'
    }).toArray();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ requests })
    };
  } catch (error) {
    console.error('获取好友请求失败:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '获取好友请求失败' })
    };
  }
};