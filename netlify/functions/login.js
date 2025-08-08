const { MongoClient } = require('mongodb');

exports.handler = async (event) => {
  // 只允许POST请求
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: '只支持POST请求' }) };
  }

  try {
    // 解析前端发送的登录数据（用户名/密码）
    const { username, password } = JSON.parse(event.body);
    
    // 连接数据库
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('你的数据库名'); // 替换为你的数据库名（如socialapp）
    const usersCollection = db.collection('users'); // 替换为你的用户集合名

    // 查询用户
    const user = await usersCollection.findOne({ username });
    if (!user) {
      await client.close();
      return { statusCode: 401, body: JSON.stringify({ error: '用户名不存在' }) };
    }

    // 验证密码（实际项目需用bcrypt等工具加密比对，这里简化处理）
    if (user.password !== password) { // 注意：生产环境必须加密！
      await client.close();
      return { statusCode: 401, body: JSON.stringify({ error: '密码错误' }) };
    }

    // 登录成功
    await client.close();
    return {
      statusCode: 200,
      body: JSON.stringify({ message: '登录成功', username: user.username })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '服务器错误', details: err.message })
    };
  }
};
