require('dotenv').config();
const mongoose = require('mongoose');

exports.handler = async (event) => {
  // 允许跨域请求
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  // 只处理 GET 请求
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: "只支持 GET 请求" })
    };
  }

  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // 从请求头获取当前用户ID（或直接查询test用户，根据你的认证逻辑）
    // 这里简化为直接查询test用户（根据实际情况修改）
    const userId = "689598f3b1ff5ef4d0699c8f"; // test用户的_id
    const user = await mongoose.connection.collection('user') // 确保集合名正确
      .findOne({ _id: new mongoose.Types.ObjectId(userId) });

    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "用户不存在" })
      };
    }

    // 返回用户的titles数组（若为空则返回空数组）
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(user.titles || [])
    };

  } catch (err) {
    console.error("获取称号失败:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "服务器错误" })
    };
  } finally {
    // 确保数据库连接关闭
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
};