const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: '只支持POST请求' }) };
  }

  try {
    const t = "111111";
    const th = "$2b$10$LpFYftOrgiVgzg9SvXnyzOxQYk13aU0yZWEAV4Zrvf2hyWyd//pTG";
    const is = await bcrypt.compare(t,th);
    console.log("直接测试结果:",is);
    const { username, password } = JSON.parse(event.body);
    console.log("前端传递数据:",{ username,password });
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('userDB');
    const usersCollection = db.collection('users');

    // 1. 查询用户
    const user = await usersCollection.findOne({ username });
    if (!user) {
      await client.close();
      return { statusCode: 401, body: JSON.stringify({ error: '用户名不存在' }) };
    }

    // 2. 用bcrypt验证密码（关键修复：解密比对）
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("输入的明文密码：", password);
    console.log("密码比对结果：", isPasswordValid);
    if (!isPasswordValid) {
      await client.close();
      return { statusCode: 401, body: JSON.stringify({ error: '密码错误' }) };
    }

    // 3. 登录成功
    await client.close();
    return {
      statusCode: 200,
      body: JSON.stringify({ message: '登录成功', username: user.username，token:user.token })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '服务器错误', details: err.message })
    };
  }
};
    