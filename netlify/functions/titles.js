const { MongoClient } = require('mongodb');

// MongoDB 连接配置（替换为你的 Atlas 连接字符串）
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'userDB'; // 数据库名
const COLLECTION_NAME = 'titles'; // 存储称号的集合名

// 连接MongoDB
async function connectToDatabase() {
  const client = await MongoClient.connect(MONGODB_URI);
  return client.db(DB_NAME);
}

exports.handler = async (event, context) => {
  // 允许跨域请求
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    // 从URL中提取用户ID（如 /api/titles/user123 → 用户ID是 user123）
    const userId = event.path.split('/').pop();
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少用户ID' })
      };
    }

    // 连接数据库并查询该用户的称号
    const db = await connectToDatabase();
    const titles = await db.collection(COLLECTION_NAME)
      .find({ targetUserId: userId }) // 注意：这里的字段名要和授予时一致
      .toArray();

    // 返回查询结果
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(titles)
    };

  } catch (err) {
    console.error('接口错误:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '服务器内部错误' })
    };
  }
};