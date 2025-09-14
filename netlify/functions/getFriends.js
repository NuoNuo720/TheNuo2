// 从MongoDB获取用户的好友列表
const { MongoClient } = require('mongodb');

// MongoDB连接字符串（建议存储在Netlify环境变量中）
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

let cachedDb = null;

// 连接到MongoDB
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

// 主函数
exports.handler = async (event, context) => {
  // 允许跨域请求
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // 验证请求方法
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: '方法不允许' })
    };
  }

  try {
    // 获取查询参数
    const username = event.queryStringParameters.username;
    
    if (!username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少用户名参数' })
      };
    }

    // 连接数据库
    const db = await connectToDatabase();
    
    // 查询用户的好友列表
    const user = await db.collection('users').findOne(
      { username: username },
      { projection: { friends: 1, _id: 0 } }
    );

    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '用户不存在' })
      };
    }

    // 获取好友详细信息
    const friends = user.friends || [];
    const friendDetails = [];
    
    for (const friend of friends) {
      const friendUser = await db.collection('users').findOne(
        { username: friend.username },
        { projection: { username: 1, avatar: 1, status: 1, lastActive: 1, _id: 0 } }
      );
      
      if (friendUser) {
        friendDetails.push({
          ...friendUser,
          unreadCount: friend.unreadCount || 0,
          lastMessage: friend.lastMessage || '',
          lastMessageTime: friend.lastMessageTime || null
        });
      }
    }

    // 返回好友列表
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(friendDetails)
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