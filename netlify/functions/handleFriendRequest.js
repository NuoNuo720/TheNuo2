// netlify/functions/handleFriendRequest.js
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: '只支持POST请求' }) };
  }

  let client;
  try {
    // 验证token（与其他函数一致）
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: '未提供有效令牌' }) };
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET);

    // 解析请求参数
    const { requestId, action, userId } = JSON.parse(event.body);
    
    // 验证必要参数
    if (!requestId || !action || !userId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '参数不完整' }) };
    }

    // 连接数据库
    client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db('userDB');

    // 验证请求是否存在且属于当前用户
    const friendRequest = await db.collection('friendRequests').findOne({
      _id: new ObjectId(requestId), // 注意：若requestId是字符串，需转为ObjectId
      recipientId: userId // 确保当前用户是请求的接收者
    });

    if (!friendRequest) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: '好友请求不存在' }) };
    }

    // 更新请求状态（接受/拒绝）
    const updateData = {
      status: action === 'accept' ? 'accepted' : 'rejected',
      updatedAt: new Date()
    };

    // 若接受请求，可额外添加好友关系（根据业务需求）
    if (action === 'accept') {
      // 例如：在用户的好友列表中互相添加
      await db.collection('users').updateOne(
        { id: userId },
        { $addToSet: { friends: friendRequest.senderId } }
      );
      await db.collection('users').updateOne(
        { id: friendRequest.senderId },
        { $addToSet: { friends: userId } }
      );
    }

    // 更新请求状态
    await db.collection('friendRequests').updateOne(
      { _id: new ObjectId(requestId) },
      { $set: updateData }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: `已${action === 'accept' ? '接受' : '拒绝'}请求` })
    };

  } catch (error) {
    console.error('处理好友请求错误:', error); // 关键：打印详细错误日志
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '服务器内部错误', details: error.message })
    };
  } finally {
    if (client) await client.close();
  }
};