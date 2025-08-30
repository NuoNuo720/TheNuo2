const { Server } = require("socket.io");
const { createServer } = require("http");
const { URL } = require("url");

// 存储用户连接映射
const userConnections = new Map();

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // 处理预检请求
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "https://thenuo2.netlify.app",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400"
      },
      body: ""
    };
  }

  // 初始化 HTTP 服务器和 Socket.io
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: "https://thenuo2.netlify.app",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // 处理 Socket 连接
  io.on("connection", (socket) => {
    console.log("新连接:", socket.id);

    // 用户认证（通过查询参数传递 token）
    const url = new URL(socket.handshake.headers.referer || "");
    const token = url.searchParams.get("token");
    const username = url.searchParams.get("username");

    if (token && username) {
      // 简单验证 token（实际项目需对接你的 JWT 验证逻辑）
      userConnections.set(username, socket.id);
      socket.username = username;
      socket.emit("connected", { message: "连接成功", timestamp: new Date() });
      console.log(`用户 ${username} 已连接`);
    } else {
      socket.disconnect(true);
      return;
    }

    // 加入个人房间（用于点对点聊天）
    socket.join(`user:${username}`);

    // 处理私聊消息
    socket.on("private_message", (data) => {
      const { to, message, timestamp } = data;
      const from = username;
      
      // 构建消息对象
      const chatMessage = {
        from,
        to,
        message,
        timestamp: timestamp || new Date().toISOString(),
        id: Date.now().toString()
      };

      // 发送给接收方
      const recipientSocketId = userConnections.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("new_message", chatMessage);
      }

      // 回发给发送方（确认消息已发送）
      socket.emit("message_sent", chatMessage);
    });

    // 处理正在输入状态
    socket.on("typing", (data) => {
      const { to, isTyping } = data;
      const recipientSocketId = userConnections.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("user_typing", {
          user: username,
          isTyping
        });
      }
    });

    // 断开连接时清理
    socket.on("disconnect", () => {
      console.log(`用户 ${username} 断开连接`);
      userConnections.delete(username);
    });
  });

  // 处理升级请求（WebSocket 握手）
  if (event.headers.upgrade === "websocket") {
    return {
      statusCode: 101,
      headers: {
        "Connection": "Upgrade",
        "Upgrade": "websocket",
        "Sec-WebSocket-Accept": calculateAcceptValue(event.headers["sec-websocket-key"])
      }
    };
  }

  return {
    statusCode: 400,
    body: "仅支持 WebSocket 连接"
  };
};

// 计算 WebSocket 握手响应值
function calculateAcceptValue(key) {
  const crypto = require("crypto");
  const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  return crypto
    .createHash("sha1")
    .update(key + GUID)
    .digest("base64");
}
