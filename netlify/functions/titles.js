// netlify/functions/titles.js
const mongoose = require('mongoose');

// 连接数据库（使用环境变量中的连接字符串）
const connectDB = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }
};

// 定义用户模型（匹配数据库中的 users 集合）
const userSchema = new mongoose.Schema({
  username: String,
  titles: [{  // 称号数组
    id: String,
    name: String,
    description: String,
    icon: String,
    createdAt: Date
  }]
});
const User = mongoose.model('User', userSchema);

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ message: "只支持 GET 请求" }) };
  }

  try {
    // 1. 连接数据库
    await connectDB();

    // 2. 获取请求头中的用户名（或从 token 解析，这里简化为直接查询 test 用户）
    const username = "test";  // 目标用户
    const user = await User.findOne({ username }).select('titles');  // 只查询 titles 字段

    if (!user) {
      return { statusCode: 404, headers, body: JSON.stringify({ message: "用户不存在" }) };
    }

    // 3. 返回用户的称号列表
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(user.titles || [])  // 若没有称号，返回空数组
    };
  } catch (err) {
    console.error("数据库错误:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "获取称号失败", error: err.message })
    };
  }
};