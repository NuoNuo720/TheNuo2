// 只声明一次依赖和服务器实例
const express = require('express');
const cors = require('cors'); // 解决跨域问题
const WebSocket = require('ws'); // 新增：引入WebSocket模块
const http = require('http'); // 新增：用于创建HTTP服务器
const app = express();
const PORT = 3000; // 统一端口

// 中间件（只需要一次）
app.use(cors()); // 允许跨域
app.use(express.json()); // 解析JSON请求体

// 全局模拟数据（合并所有存储变量，并新增在线状态管理）
let users = []; // 存储所有用户（替代原来的registeredUsers）
let friendRequests = []; // 好友请求
let friends = []; // 好友关系
let onlineUsers = new Set(); // 新增：记录在线用户ID


// -------------------------- HTTP 接口 --------------------------
// 1. 测试接口
app.get('/api/hello', (req, res) => {
  res.send({ message: 'Hello, 接口调用成功！' });
});

// 2. 用户注册接口（合并并优化）
app.post('/api/register', (req, res) => {
  try {
    const { username, email, password, token } = req.body;

    // 验证数据完整性
    if (!username || !email || !password || !token) {
      return res.status(400).json({ message: '注册信息不完整' });
    }

    // 检查用户名/邮箱是否已存在
    const usernameExists = users.some(user => user.username === username);
    const emailExists = users.some(user => user.email === email);
    if (usernameExists) return res.status(400).json({ message: '用户名已被注册！' });
    if (emailExists) return res.status(400).json({ message: '该邮箱已被注册！' });

    // 保存用户 - 添加更多用户信息字段以匹配前端需求
    users.push({ 
      id: Date.now().toString(), // 添加用户ID
      username, 
      email, 
      password, 
      token,
      avatar: `https://picsum.photos/seed/${username}/200`, // 生成头像URL
      loginTime: new Date().toISOString() // 登录时间
    });
    console.log('新用户注册：', username);
    res.json({ message: '注册成功', username });
  } catch (error) {
    console.error('注册接口错误：', error);
    res.status(500).json({ message: '服务器错误，注册失败' });
  }
});

// 3. 用户登录接口
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    // 更新登录时间
    user.loginTime = new Date().toISOString();
    // 标记用户为在线
    onlineUsers.add(user.id);
    // 广播在线状态更新（新增）
    broadcastStatusUpdate(user.id, true);
    
    res.send({ 
      message: '登录成功', 
      token: user.token,
      username: user.username,
      userId: user.id, // 返回用户ID
      avatar: user.avatar, // 返回头像
      loginTime: user.loginTime
    });
  } else {
    res.status(401).send({ message: '用户名或密码错误' });
  }
});

// 4. 搜索用户（用于添加好友）- 修改接口路径和参数以匹配前端
app.get('/api/users/search', (req, res) => {
  const { username } = req.query;
  const currentUser = req.query.currentUser;
  
  if (!username || !currentUser) {
    return res.status(400).json({ message: '参数不完整' });
  }
  
  // 搜索并返回符合前端需求的用户格式（新增在线状态）
  const result = users
    .filter(user => user.username.includes(username) && user.username !== currentUser)
    .map(user => ({
      id: user.id,
      name: user.username,
      avatar: user.avatar,
      isOnline: onlineUsers.has(user.id) // 新增：返回真实在线状态
    }));
  
  res.send(result);
});

// 5. 发送好友请求 - 修改接口路径以匹配前端
app.post('/api/friends/request', (req, res) => {
  const { toUserId, remark, message, fromUser } = req.body;
  
  // 找到目标用户
  const toUser = users.find(u => u.id === toUserId);
  if (!toUser) {
    return res.status(404).json({ message: '用户不存在' });
  }
  
  // 检查是否已发送请求
  const hasSent = friendRequests.some(req => 
    req.fromUser.id === fromUser.id && req.toUser.id === toUser.id && req.status === 'pending'
  );
  
  if (hasSent) {
    return res.status(409).send({ message: '已发送过请求' });
  }
  
  // 创建新请求
  const newRequest = {
    id: Date.now().toString(),
    fromUser: {
      id: fromUser.id,
      name: fromUser.username,
      avatar: fromUser.avatar
    },
    toUser: {
      id: toUser.id,
      name: toUser.username,
      avatar: toUser.avatar
    },
    remark: remark || '',
    message: message || '请求添加你为好友',
    status: 'pending',
    requestTime: new Date().toISOString()
  };
  
  friendRequests.push(newRequest);
  
  // 新增：向接收方推送新请求通知
  broadcastToUser(
    toUser.id, 
    { 
      type: 'friend_request', 
      message: `${fromUser.username} 向你发送了好友请求`,
      request: newRequest
    }
  );
  
  res.send({ message: '请求发送成功', request: newRequest });
});

// 6. 获取收到的好友请求 - 修改接口路径以匹配前端
app.get('/api/friends/requests', (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ message: '用户ID不能为空' });
  }
  
  const requests = friendRequests.filter(req => 
    req.toUser.id === userId && req.status === 'pending'
  );
  
  res.send(requests);
});

// 7. 获取发出的待对方同意的请求 - 新增接口
app.get('/api/friends/pending', (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ message: '用户ID不能为空' });
  }
  
  const pendingRequests = friendRequests.filter(req => 
    req.fromUser.id === userId && req.status === 'pending'
  );
  
  res.send(pendingRequests);
});

// 8. 接受好友请求 - 修改接口路径以匹配前端
app.post('/api/friends/accept', (req, res) => {
  const { requestId } = req.body;
  
  const request = friendRequests.find(req => req.id === requestId);
  if (!request) {
    return res.status(404).send({ message: '请求不存在' });
  }
  
  request.status = 'accepted';
  
  // 添加双向好友关系
  friends.push({ 
    user: request.fromUser.id, 
    friend: request.toUser.id,
    joinedAt: new Date().toISOString()
  });
  friends.push({ 
    user: request.toUser.id, 
    friend: request.fromUser.id,
    joinedAt: new Date().toISOString()
  });
  
  // 新增：向请求发送方推送“请求被接受”通知
  broadcastToUser(
    request.fromUser.id, 
    { 
      type: 'request_accepted', 
      message: `${request.toUser.name} 接受了你的好友请求`,
      friend: request.toUser
    }
  );
  
  res.send({ message: '已接受好友请求' });
});

// 9. 拒绝好友请求 - 新增接口
app.post('/api/friends/reject', (req, res) => {
  const { requestId } = req.body;
  
  const request = friendRequests.find(req => req.id === requestId);
  if (!request) {
    return res.status(404).send({ message: '请求不存在' });
  }
  
  request.status = 'rejected';
  
  // 新增：向请求发送方推送“请求被拒绝”通知
  broadcastToUser(
    request.fromUser.id, 
    { 
      type: 'request_rejected', 
      message: `${request.toUser.name} 拒绝了你的好友请求`
    }
  );
  
  res.send({ message: '已拒绝好友请求' });
});

// 10. 获取好友列表 - 修改接口路径和返回格式以匹配前端
app.get('/api/friends', (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ message: '用户ID不能为空' });
  }
  
  // 获取好友ID列表
  const friendIds = friends
    .filter(rel => rel.user === userId)
    .map(rel => ({
      id: rel.friend,
      joinedAt: rel.joinedAt
    }));
  
  // 丰富好友信息（使用真实在线状态）
  const friendList = friendIds.map(f => {
    const user = users.find(u => u.id === f.id);
    return {
      id: user.id,
      name: user.username,
      avatar: user.avatar,
      joinedAt: f.joinedAt,
      isOnline: onlineUsers.has(user.id) // 关键修改：使用真实在线状态（替代随机）
    };
  });
  
  res.send(friendList);
});

// 11. 删除好友 - 新增接口
app.delete('/api/friends/delete/:friendId', (req, res) => {
  const { friendId } = req.params;
  const { userId } = req.body;
  
  if (!userId || !friendId) {
    return res.status(400).json({ message: '参数不完整' });
  }
  
  // 移除双向好友关系
  friends = friends.filter(rel => 
    !(rel.user === userId && rel.friend === friendId) &&
    !(rel.user === friendId && rel.friend === userId)
  );
  
  // 新增：向被删除方推送“被删除”通知
  broadcastToUser(
    friendId, 
    { 
      type: 'friend_deleted', 
      message: `你已被 ${users.find(u => u.id === userId)?.username} 从好友列表中删除`
    }
  );
  
  res.send({ message: '好友已删除' });
});

// 12. 取消好友请求 - 新增接口
app.post('/api/friends/cancel/:requestId', (req, res) => {
  const { requestId } = req.params;
  
  const request = friendRequests.find(req => req.id === requestId);
  if (request) {
    // 新增：向请求接收方推送“请求被取消”通知
    broadcastToUser(
      request.toUser.id, 
      { 
        type: 'request_canceled', 
        message: `${request.fromUser.name} 取消了好友请求`
      }
    );
  }
  
  friendRequests = friendRequests.filter(req => req.id !== requestId);
  res.send({ message: '好友请求已取消' });
});

// 13. 新增：更新用户在线状态接口（供前端调用）
app.post('/api/users/status', (req, res) => {
  const { isOnline } = req.body;
  const token = req.headers.authorization?.split(' ')[1]; // 从请求头获取token
  
  if (token) {
    const user = users.find(u => u.token === token);
    if (user) {
      if (isOnline) {
        onlineUsers.add(user.id);
      } else {
        onlineUsers.delete(user.id);
      }
      // 广播状态更新
      broadcastStatusUpdate(user.id, isOnline);
      return res.send({ message: `状态已更新为${isOnline ? '在线' : '离线'}` });
    }
  }
  
  res.status(401).send({ message: '验证失败' });
});


// -------------------------- WebSocket 实时通信 --------------------------
// 创建HTTP服务器并关联express实例
const server = http.createServer(app);
// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 存储客户端连接（key: userId, value: WebSocket）
const userConnections = new Map();

// 监听WebSocket连接
wss.on('connection', (ws, req) => {
  console.log('新的WebSocket连接');
  
  // 从URL参数获取userId（前端连接时传入）
  const params = new URLSearchParams(req.url.slice(1));
  const userId = params.get('userId');
  
  if (userId) {
    // 存储用户连接
    userConnections.set(userId, ws);
    console.log(`用户 ${userId} 已建立WebSocket连接`);
  }
  
  // 监听客户端消息
  ws.on('message', (message) => {
    console.log(`收到来自客户端的消息: ${message}`);
    // 可根据需求处理客户端发送的消息（如心跳检测）
  });
  
  // 监听连接关闭
  ws.on('close', () => {
    console.log('WebSocket连接关闭');
    if (userId) {
      // 移除用户连接
      userConnections.delete(userId);
      // 标记用户为离线
      onlineUsers.delete(userId);
      // 广播离线状态
      broadcastStatusUpdate(userId, false);
    }
  });
  
  // 发送连接成功消息
  ws.send(JSON.stringify({ type: 'connection', message: 'WebSocket连接成功' }));
});

// 辅助函数：向特定用户推送消息
function broadcastToUser(userId, data) {
  const ws = userConnections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// 辅助函数：广播用户状态更新（通知所有好友）
function broadcastStatusUpdate(userId, isOnline) {
  // 获取该用户的所有好友
  const userFriends = friends
    .filter(rel => rel.user === userId)
    .map(rel => rel.friend);
  
  // 向所有好友推送状态更新
  userFriends.forEach(friendId => {
    broadcastToUser(friendId, {
      type: 'status_update',
      userId: userId,
      isOnline: isOnline,
      username: users.find(u => u.id === userId)?.username
    });
  });
}


// 启动服务器（修改为启动HTTP服务器，同时支持HTTP和WebSocket）
server.listen(PORT, () => {
  console.log(`服务器已启动，地址：http://localhost:${PORT}`);
  console.log('可用接口：');
  console.log('GET /api/hello（测试）');
  console.log('POST /api/register（注册）');
  console.log('POST /api/login（登录）');
  console.log('GET /api/users/search（搜索用户）');
  console.log('POST /api/friends/request（发送好友请求）');
  console.log('GET /api/friends/requests（获取收到的好友请求）');
  console.log('GET /api/friends/pending（获取待对方同意的请求）');
  console.log('WebSocket 已启用（ws://localhost:3000）');
});