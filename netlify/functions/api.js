const { MongoClient } = require('mongodb');

// MongoDB 配置（从环境变量获取）
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'userdb';
const COLLECTION_TITLES = 'titles';

// 管理员密钥
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'default_admin_token';

// 连接MongoDB
async function getDb() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client.db(DB_NAME);
}

// 解析请求体
function parseBody(body) {
  try {
    return body ? JSON.parse(body) : {};
  } catch (e) {
    return {};
  }
}

// 主处理函数
exports.handler = async (event) => {
  // 设置CORS headers（允许跨域请求）
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // 处理OPTIONS请求（跨域预检）
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    // 1. 获取用户称号（GET /titles/:userId）
    if (event.httpMethod === 'GET' && event.path.startsWith('/titles/')) {
      const userId = event.path.split('/titles/')[1];
      const db = await getDb();
      const titles = await db.collection(COLLECTION_TITLES)
        .find({ userId })
        .toArray();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(titles)
      };
    }

    // 2. 管理员授予称号（POST /admin/grantTitle）
    if (event.httpMethod === 'POST' && event.path === '/admin/grantTitle') {
      const body = parseBody(event.body);
      const { adminToken, targetUserId, titleName, description, icon, isExclusive } = body;

      // 验证权限
      if (adminToken !== ADMIN_TOKEN) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: '无管理员权限' })
        };
      }

      // 验证参数
      if (!targetUserId || !titleName) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '用户ID和称号名称为必填项' })
        };
      }

      // 写入数据库
      const db = await getDb();
      const newTitle = {
        userId: targetUserId,
        titleName,
        description: description || '无描述',
        icon: icon || 'trophy',
        isExclusive: isExclusive || false,
        createdAt: new Date().toLocaleDateString()
      };

      await db.collection(COLLECTION_TITLES).insertOne(newTitle);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `已给用户 ${targetUserId} 授予称号: ${titleName}`
        })
      };
    }

    // 未匹配的接口
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: '接口不存在' })
    };

  } catch (error) {
    console.error('处理请求失败:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '服务器内部错误' })
    };
  }
};