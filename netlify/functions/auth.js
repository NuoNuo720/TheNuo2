const jwt = require('jsonwebtoken');

// 普通用户登录验证（用于用户端接口，如获取/添加个人称号）
exports.auth = (req, res, next) => {
  try {
    // 从请求头提取 token（格式：Bearer <token>）
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: '未登录，请先登录' });
    }

    const token = authHeader.split(' ')[1];
    // 验证 token 有效性（使用你的 JWT 密钥）
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 将用户信息挂载到 req 对象，供后续接口使用
    req.user = {
      userId: decoded.userId,
      username: decoded.username
    };
    next(); // 验证通过，继续处理请求
  } catch (error) {
    return res.status(401).json({ message: '登录已失效，请重新登录' });
  }
};

// 管理员权限验证（新增！用于管理员接口）
exports.adminAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: '请先登录管理员账号' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 关键：验证该用户是否为管理员（必须有 isAdmin: true）
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: '没有管理员权限，无法操作' });
    }

    // 将管理员信息挂载到 req 对象
    req.admin = {
      adminId: decoded.adminId,
      username: decoded.username
    };
    next(); // 验证通过，继续处理请求
  } catch (error) {
    return res.status(401).json({ message: '管理员登录已失效，请重新登录' });
  }
};