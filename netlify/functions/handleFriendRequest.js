// handleFriendRequest.js
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

let client;

// 数据库连接函数（复用连接，提高性能）
async function connectToDatabase() {
  if (!client) {
    client = await MongoClient.connect(process.env.MONGODB_URI);
  }
  return client.db('userDB');
}

exports.handler = async (event) => {
  // 添加CORS headers，解决跨域问题
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // 仅允许POST方法
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: '只支持POST请求' }) 
    };
  }

  try {
    const db = await connectToDatabase();
    let requestData;
    
    // 解析请求体（增加错误处理）
    try {
      requestData = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '无效的JSON格式' })
      };
    }

    const { requestId, action, userId } = requestData;

    // 参数验证
    if (!requestId || !action || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '参数不完整（需要requestId、action、userId）' })
      };
    }

    // 验证action合法性
    if (!['accept', 'reject'].includes(action)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'action必须是"accept"或"reject"' })
      };
    }

    // 查找请求并验证接收者
    const request = await db.collection('friendRequests').findOne({
      _id: new ObjectId(requestId),
      recipientId: userId,
      status: 'pending' // 确保只能处理待处理的请求
    });

    if (!request) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '请求不存在或已处理' })
      };
    }

    // 更新请求状态和时间（供checkUpdates识别新处理的请求）
    await db.collection('friendRequests').updateOne(
      { _id: new ObjectId(requestId) },
      { 
        $set: { 
          status: action,
          updatedAt: new Date() 
        } 
      }
    );

    // 如果是接受请求，添加到双方好友列表
    if (action === 'accept') {
      // 向发送者的好友列表添加接收者
      await db.collection('users').updateOne(
        { id: request.senderId },
        { $addToSet: { friends: request.recipientId } } // 用$addToSet避免重复添加
      );

      // 向接收者的好友列表添加发送者
      await db.collection('users').updateOne(
        { id: request.recipientId },
        { $addToSet: { friends: request.senderId } }
      );
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: action === 'accept' ? '已成功添加好友' : '已拒绝好友请求',
        action: action
      })
    };
  } catch (error) {
    console.error('处理好友请求错误:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '处理请求失败',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};