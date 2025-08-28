// titles.js 后端函数示例
const { MongoClient } = require('mongodb');

exports.handler = async (event) => {
  try {
    // 验证请求参数
    const username = event.queryStringParameters?.username;
    if (!username) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: '缺少用户名参数' })
      };
    }
    
    // 验证数据库连接
    if (!process.env.MONGODB_URI) {
      throw new Error('数据库连接字符串未配置');
    }
    
    // 连接数据库并查询
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db('your-db-name');
    const titles = await db.collection('titles')
      .find({ username: username }) // 假设你的集合中用username字段关联
      .toArray();
      
    await client.close();
    
    return {
      statusCode: 200,
      body: JSON.stringify(titles)
    };
  } catch (error) {
    console.error('称号查询错误:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: '获取称号时发生错误',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};