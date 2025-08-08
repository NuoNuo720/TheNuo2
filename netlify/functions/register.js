{insert\_element\_0\_}
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

let client;

async function connectToDatabase() {
  if (!client) {
    client = await MongoClient.connect(process.env.MONGODB_URI);
  }
  return client.db('userDB');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  try {
    const db = await connectToDatabase();
    const { username, email, password, token } = JSON.parse(event.body);

    
    const existingUser = await db.collection('users').findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: '用户名或邮箱已被注册' })
      };
    }

    
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    
    await db.collection('users').insertOne({
      username,
      email,
      password: hashedPassword,
      token,
      createdAt: new Date(),
      friends: [],
      friendRequests: []
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: '注册成功' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: '注册失败', error: error.message })
    };
  }
};
