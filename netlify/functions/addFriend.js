const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;

let client;

async function connectToDatabase() {
  if (!client) {
    client = await MongoClient.connect(process.env.MONGODB_URI);
  }
  return client.db('userDB');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const db = await connectToDatabase();
    const { senderId, recipientId, message } = JSON.parse(event.body);
    console.log('收到的请求参数:',{ senderId, recipientId, message })
    // 检查是否已发送请求
    if (!senderId || !recipientId) {
        console.error('缺少必要参数:', { senderId, recipientId });
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'senderId和recipientId为必填项' })
        };
    }
    const existingRequest = await db.collection('friendRequests').findOne({
      senderId,
      recipientId,
      status: { $in: ['pending', 'accepted'] }
    });

    if (existingRequest) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '已发送好友请求' })
      };
    }

    // 创建新请求
    const result = await db.collection('friendRequests').insertOne({
      senderId,
      recipientId,
      message,
      status: 'pending',
      sentAt: new Date(),
      updatedAt:new Date()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: '好友请求已发送',
        requestId: result.insertedId
      })
    };
  } catch (error) {
    console.error('解析请求体错误:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '请求格式错误，必须为JSON' })
    };
  }
};