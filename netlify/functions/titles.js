const { MongoClient } = require('mongodb');

// 从环境变量获取MongoDB连接信息
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('请配置MONGODB_URI环境变量');
}

const DB_NAME = 'userDB';
const COLLECTION_NAME = 'titles';

async function getDb() {
  const client = await MongoClient.connect(MONGODB_URI);
  return client.db(DB_NAME);
}

exports.handler = async (event, context) => {
  // 跨域配置
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    // 【修复路径解析】兼容不同调用方式提取用户ID
    let userId;
    // 方式1：从Netlify的路径参数中提取（推荐）
    if (event.queryStringParameters?.userId) {
      userId = event.queryStringParameters.userId;
    } 
    // 方式2：从原始URL路径中提取（兼容前端调用）
    else {
      const pathParts = event.path.split('/').filter(part => part);
      // 路径格式：/api/titles/user123 → 提取最后一部分
      userId = pathParts[pathParts.length - 1];
    }

    if (!userId || userId === 'titles') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '请提供有效的用户ID' })
      };
    }

    // 查询数据库
    const db = await getDb();
    const userTitles = await db.collection(COLLECTION_NAME)
      .find({ targetUserId: userId })
      .toArray();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(userTitles)
    };

  } catch (error) {
    console.error('函数执行错误:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '服务器错误: ' + error.message })
    };
  }
};