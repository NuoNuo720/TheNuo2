const { MongoClient } = require('mongodb');

exports.handler = async (event) => {
  // 固定跨域配置
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    // 1. 获取用户ID（必须传）
    const userId = event.queryStringParameters?.userId;
    if (!userId) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: '请传入用户ID，例如 ?userId=xxx' }) 
      };
    }

    // 2. 连接数据库（使用你的数据库名 userDB）
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db('userDB'); // 这里改成你的数据库名 userDB

    // 3. 查询该用户的称号
    const titles = await db.collection('titles')
      .find({ targetUserId: userId }) // 确保授予时存的是 targetUserId 字段
      .toArray();

    await client.close(); // 关闭连接

    // 4. 返回结果（空数组也正常返回）
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(titles)
    };

  } catch (error) {
    // 出错时返回详细信息，方便排查
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: '操作失败',
        reason: error.message // 这里会显示具体错误（如连接失败、数据库不存在等）
      })
    };
  }
};