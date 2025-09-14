// 发送消息到MongoDB
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
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: '方法不允许' })
    };
  }

  try {
    // 解析请求体
    const data = JSON.parse(event.body);
    
    // 验证必要参数
    if (!data.sender || !data.recipient || !data.content || !data.timestamp) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少必要参数' })
      };
    }

    // 连接数据库
    const db = await connectToDatabase();
    
    // 验证发送者和接收者是否为好友
    const senderUser = await db.collection('users').findOne({
      username: data.sender,
      'friends.username': data.recipient
    });
    
    if (!senderUser) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: '你们不是好友，无法发送消息' })
      };
    }

    // 创建消息对象
    const message = {
      id: Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
      sender: data.sender,
      recipient: data.recipient,
      content: data.content,
      timestamp: data.timestamp,
      status: 'sent'
    };

    // 保存消息到数据库
    await db.collection('messages').insertOne(message);

    // 更新发送者的好友最后消息
    await db.collection('users').updateOne(
      { 
        username: data.sender,
        'friends.username': data.recipient
      },
      { 
        $set: {
          'friends.$.lastMessage': data.content,
          'friends.$.lastMessageTime': data.timestamp
        }
      }
    );

    // 更新接收者的好友最后消息和未读计数
    await db.collection('users').updateOne(
      { 
        username: data.recipient,
        'friends.username': data.sender
      },
      { 
        $set: {
          'friends.$.lastMessage': data.content,
          'friends.$.lastMessageTime': data.timestamp
        },
        $inc: {
          'friends.$.unreadCount': 1
        }
      }
    );

    // 返回成功响应
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        id: message.id
      })
    };
  } catch (error) {
    console.error('发送消息失败:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '发送消息失败' })
    };
  }
};