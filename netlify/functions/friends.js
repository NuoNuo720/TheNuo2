// 引入MongoDB驱动
const { MongoClient } = require('mongodb');

// MongoDB连接配置
const MONGODB_URI = 'mongodb+srv://3668417644:nuonuo001@cluster0.u1nuqn9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'userDB';
const COLLECTION_NAME = 'users';

// MongoDB客户端实例
let client;
let db;

// 连接MongoDB的工具函数
async function connectToMongo() {
  try {
    if (!client || !client.isConnected()) {
      client = await MongoClient.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      db = client.db(DB_NAME);
    }
    return db.collection(COLLECTION_NAME);
  } catch (error) {
    console.error('MongoDB连接失败:', error);
    throw error; // 重新抛出错误以便上层处理
  }
}

// Netlify函数主逻辑
exports.handler = async (event) => {
  // 设置跨域响应头（所有响应都需要）
  const headers = {
    'Access-Control-Allow-Origin': '*', // 生产环境应指定具体域名
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: '预检请求成功' })
    };
  }

  // 只允许GET请求
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: '只支持GET请求' })
    };
  }

  try {
    // 从URL中获取username参数
    const { username } = event.queryStringParameters;
    if (!username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少username参数' })
      };
    }

    // 连接MongoDB，查询该用户的好友列表
    const collection = await connectToMongo();
    const user = await collection.findOne(
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

    // 返回好友列表
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ friends: user.friends || [] })
    };

  } catch (error) {
    console.error('获取好友列表失败：', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '服务器内部错误' })
    };
  }
};