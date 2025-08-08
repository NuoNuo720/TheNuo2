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
    const { requestId, action, userId } = JSON.parse(event.body);

    // 查找请求
    const request = await db.collection('friendRequests').findOne({
      _id: new ObjectId(requestId),
      recipientId: userId
    });

    if (!request) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: '请求不存在' })
      };
    }

    // 更新请求状态
    await db.collection('friendRequests').updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: action,
                    updatedAt: new Date() } }
    );

    // 如果是接受请求，添加到双方好友列表
    if (action === 'accept') {
      await db.collection('users').updateOne(
        { id: request.senderId },
        { $addToSet: { friends: request.recipientId } }
      );

      await db.collection('users').updateOne(
        { id: request.recipientId },
        { $addToSet: { friends: request.senderId } }
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: '操作成功' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};