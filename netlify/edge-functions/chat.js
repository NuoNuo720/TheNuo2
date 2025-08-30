export default async (request, context) => {
  // 检查是否是WebSocket升级请求
  if (request.headers.get("Upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(request);
    
    // 从URL获取用户名和token
    const url = new URL(request.url);
    const username = url.searchParams.get('username');
    const token = url.searchParams.get('token');
    
    // 验证token (这里需要实现你的验证逻辑)
    if (!isValidToken(token)) {
      socket.close(1008, "Invalid authentication");
      return response;
    }
    
    socket.onopen = () => {
      console.log(`User ${username} connected`);
      // 存储连接以便后续广播消息
      addUserConnection(username, socket);
      // 通知其他用户该用户上线
      broadcastStatus(username, 'online');
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(username, data); // 处理收到的消息
      } catch (e) {
        console.error('Error processing message:', e);
      }
    };
    
    socket.onclose = () => {
      console.log(`User ${username} disconnected`);
      removeUserConnection(username, socket);
      // 通知其他用户该用户下线
      broadcastStatus(username, 'offline');
    };
    
    socket.onerror = (error) => console.error("WebSocket error:", error);
    
    return response;
  }
  
  return new Response("请使用WebSocket连接", { status: 426 });
};

// 存储用户连接的集合
const userConnections = new Map();

// 验证token
function isValidToken(token) {
  // 这里应该实现真实的token验证逻辑
  // 例如验证JWT签名等
  return true; // 临时返回true，实际使用时需要替换
}

// 添加用户连接
function addUserConnection(username, socket) {
  if (!userConnections.has(username)) {
    userConnections.set(username, new Set());
  }
  userConnections.get(username).add(socket);
}

// 移除用户连接
function removeUserConnection(username, socket) {
  if (userConnections.has(username)) {
    const connections = userConnections.get(username);
    connections.delete(socket);
    if (connections.size === 0) {
      userConnections.delete(username);
    }
  }
}

// 处理消息
function handleMessage(sender, data) {
  switch (data.type) {
    case 'auth':
      // 已在连接时验证过，这里可以忽略或再次验证
      break;
      
    case 'message':
      // 转发消息给接收者
      if (data.recipient && userConnections.has(data.recipient)) {
        const message = JSON.stringify({
          type: 'message',
          sender: sender,
          content: data.content,
          timestamp: data.timestamp
        });
        
        // 发送给接收者的所有连接
        userConnections.get(data.recipient).forEach(socket => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(message);
          }
        });
      }
      break;
      
    case 'friendRequest':
      // 转发好友请求
      if (data.recipient && userConnections.has(data.recipient)) {
        const request = JSON.stringify({
          type: 'friendRequest',
          sender: sender,
          message: data.message,
          timestamp: data.timestamp
        });
        
        userConnections.get(data.recipient).forEach(socket => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(request);
          }
        });
      }
      break;
      
    case 'requestAccepted':
      // 通知请求发送者请求已被接受
      if (data.recipient && userConnections.has(data.recipient)) {
        const response = JSON.stringify({
          type: 'requestAccepted',
          sender: sender,
          timestamp: data.timestamp
        });
        
        userConnections.get(data.recipient).forEach(socket => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(response);
          }
        });
      }
      break;
  }
}

// 广播用户状态变化
function broadcastStatus(username, status) {
  const statusUpdate = JSON.stringify({
    type: 'status',
    username: username,
    status: status,
    timestamp: new Date().toISOString()
  });
  
  // 发送给所有用户
  for (const [user, connections] of userConnections) {
    // 不发送给自己
    if (user !== username) {
      connections.forEach(socket => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(statusUpdate);
        }
      });
    }
  }
}