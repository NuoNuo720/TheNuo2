// 检查新消息和状态更新
const { MongoClient } = require('mongodb');

// MongoDB连接字符串
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
    const since = event.queryStringParameters.since;
    
    if (!username || !since) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少必要参数' })
      };
    }

    // 连接数据库
    const db = await connectToDatabase();
    
    // 检查新消息
    const newMessages = await db.collection('messages').find({
      recipient: username,
      timestamp: { $gt: since },
      status: { $ne: 'deleted' }
    }).sort({ timestamp: 1 }).toArray();

    // 检查好友请求更新
    const friendRequestsCount = await db.collection('friendRequests').countDocuments({
      recipient: username,
      status: 'pending',
      timestamp: { $gt: since }
    });

    // 检查好友状态变化
    const user = await db.collection('users').findOne({ username: username });
    const friendStatusChanges = [];
    
    if (user && user.friends && user.friends.length > 0) {
      const friendUsernames = user.friends.map(f => f.username);
      
      const friends = await db.collection('users').find({
        username: { $in: friendUsernames },
        $or: [
          { status: { $ne: user.friends.find(f => f.username === username)?.status } },
          { lastActive: { $gt: since } }
        ]
      }, { projection: { username: 1, status: 1, lastActive: 1, _id: 0 } }).toArray();
      
      friendStatusChanges.push(...friends);
    }

    // 返回更新信息
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        newMessages: newMessages,
        friendRequestsUpdated: friendRequestsCount > 0,
        friendStatusChanges: friendStatusChanges
      })
    };
  } catch (error) {
    console.error('检查更新失败:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '检查更新失败' })
    };
  }
};