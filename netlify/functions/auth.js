const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 验证用户是否登录
exports.authenticate = async (req, res, next) => {
  try {
    // 从请求头获取token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供身份验证令牌' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 查找用户
    const user = await User.findOne({ username: decoded.username }).select('-password');
    
    if (!user) {
      // 用户不存在时返回错误，而不是直接跳转登录
      return res.status(401).json({ error: '身份验证失败：用户不存在' });
    }
    
    // 将用户信息添加到请求对象
    req.user = user;
    next();
  } catch (error) {
    console.error('身份验证错误:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '无效的令牌' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '令牌已过期' });
    }
    
    return res.status(500).json({ error: '身份验证过程中发生错误' });
  }
};

// 验证用户是否为管理员
exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  
  return res.status(403).json({ error: '需要管理员权限' });
};