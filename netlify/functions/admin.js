const mongoose = require('mongoose');
const Title = require('./models/Title');
const User = require('./models/User');
const jwt = require('jsonwebtoken'); // 用于验证管理员身份

// 验证管理员身份的中间件
const isAdmin = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findOne({ 
      _id: decoded.userId, 
      isAdmin: true  // 假设管理员用户有isAdmin: true字段
    });
    return !!admin;
  } catch (err) {
    return false;
  }
};

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  // 只处理添加称号的POST请求
  if (event.httpMethod !== "POST" || event.path !== "/api/admin/add-title") {
    return { statusCode: 405, headers, body: JSON.stringify({ message: "不支持的请求" }) };
  }

  try {
    // 1. 验证管理员身份
    const token = event.headers.authorization?.split(' ')[1];
    if (!token || !(await isAdmin(token))) {
      return { statusCode: 403, headers, body: JSON.stringify({ message: "无管理员权限" }) };
    }

    // 2. 解析请求数据
    const { username, name, description, icon } = JSON.parse(event.body);
    if (!username || !name || !description) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: "参数不全" }) };
    }

    // 3. 查找目标用户
    const user = await User.findOne({ username });
    if (!user) {
      return { statusCode: 404, headers, body: JSON.stringify({ message: "用户不存在" }) };
    }

    // 4. 添加称号
    const newTitle = new Title({
      name,
      description,
      icon: icon || 'trophy',
      userId: user._id,
      createdAt: new Date()
    });
    await newTitle.save();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "称号添加成功", title: newTitle })
    };
  } catch (err) {
    console.error("添加称号失败:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "添加称号失败" })
    };
  }
};