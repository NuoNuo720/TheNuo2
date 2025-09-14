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
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

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
    
    // 获取用户的好友列表
    const user = await db.collection('users').findOne({ username });
    
    if (!user || !user.friends) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ friends: [] })
      };
    }

    // 获取好友的详细信息
    const friendUsernames = user.friends.map(f => f.username);
    const friends = await db.collection('users').find({
      username: { $in: friendUsernames }
    }, { 
      projection: { 
        username: 1, 
        avatar: 1, 
        status: 1,
        lastActive: 1,
        _id: 0 
      } 
    }).toArray();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ friends })
    };
  } catch (error) {
    console.error('获取好友列表失败:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '获取好友列表失败' })
    };
  }
};