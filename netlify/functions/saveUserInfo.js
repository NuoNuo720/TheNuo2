const { MongoClient } = require('mongodb');

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
    const userData = JSON.parse(event.body);
    
    // 保存或更新用户信息
    await db.collection('users').updateOne(
      { userId: userData.userId },
      { $set: userData },
      { upsert: true }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: '用户信息保存成功' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};