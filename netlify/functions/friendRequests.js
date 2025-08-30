const { MongoClient } = require('mongodb');

// 1. 替换成你的MongoDB连接字符串（和friends.js一致）
const MONGODB_URI = 'mongodb+srv://3668417644:nuonuo001@cluster0.u1nuqn9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'userDB';
const COLLECTION_NAME = 'users';

// 2. 连接MongoDB（复用工具函数）
let client;
async function connectToMongo() {
  if (!client) {
    client = await MongoClient.connect(MONGODB_URI);
  }
  return client.db(DB_NAME).collection(COLLECTION_NAME);
}

// 3. Netlify函数主逻辑（处理POST请求）
exports.handler = async (event) => {
  // 只允许POST请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '只支持POST请求' })
    };
  }

  try {
    // 解析前端发送的JSON数据（fromUsername=发起方，toUsername=目标方）
    const { fromUsername, toUsername, verifyMessage } = JSON.parse(event.body);
    if (!fromUsername || !toUsername) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: '缺少fromUsername或toUsername' })
      };
    }

    // 连接MongoDB，检查目标用户是否存在
    const collection = await connectToMongo();
    const targetUser = await collection.findOne({ username: toUsername });
    if (!targetUser) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: '目标用户不存在' })
      };
    }

    // 检查是否已添加过好友（避免重复）
    const fromUser = await collection.findOne({ username: fromUsername });
    if (fromUser?.friends?.includes(toUsername)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: '已添加该用户为好友' })
      };
    }

    // 双向添加好友（发起方和目标方的friends数组都加对方）
    await collection.updateOne(
      { username: fromUsername },
      { $push: { friends: toUsername } }
    );
    await collection.updateOne(
      { username: toUsername },
      { $push: { friends: fromUsername } }
    );

    // 返回成功结果
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, message: '好友添加成功', verifyMessage })
    };

  } catch (error) {
    console.error('添加好友失败：', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '服务器内部错误' })
    };
  }
};