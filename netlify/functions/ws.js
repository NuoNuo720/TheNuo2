// 修复：补充缺失的模块导入
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');

// 存储连接的客户端
const clients = new Map();

exports.handler = async (event, context) => {
  // 检查是否是WebSocket请求
  if (!event.headers['sec-websocket-key']) {
    return { statusCode: 400, body: '不是WebSocket请求' };
  }

  // 从查询参数获取用户ID和token（处理空值）
  const queryParams = new URLSearchParams(event.rawQuery);
  const userId = queryParams.get('userId') || ''; // 避免undefined
  const token = queryParams.get('token') || '';

  // 验证用户身份
  try {
    // 验证JWT令牌（兼容login.js生成的格式）
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // 额外验证：确保token中的用户ID与请求参数一致
    if (decoded.userId !== userId) {
      throw new Error('用户ID与令牌不匹配');
    }
    
    // 处理WebSocket连接
    const wss = new WebSocketServer({ noServer: true });
    
    wss.on('connection', (ws) => {
      console.log(`用户 ${userId} 已连接`);
      clients.set(userId, ws);
      
      // 发送连接成功消息
      ws.send(JSON.stringify({
        type: 'connection_established',
        message: '已成功连接到实时服务器'
      }));
      
      // 处理收到的消息
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log(`收到用户 ${userId} 的消息:`, message);
          
          switch (message.type) {
            case 'friend_request':
              sendToUser(message.recipientId, {
                type: 'friend_request',
                sender: { id: userId, username: message.senderUsername },
                message: message.message
              });
              break;
            case 'request_accepted':
            case 'request_rejected':
              sendToUser(message.recipientId, {
                type: message.type,
                friend: { id: userId, username: message.senderUsername }
              });
              break;
            default:
              console.log('未知消息类型:', message.type);
              // 新增：通知客户端未知消息类型
              ws.send(JSON.stringify({ type: 'error', message: '未知消息类型' }));
          }
        } catch (error) {
          console.error('处理消息错误:', error);
          // 新增：通知客户端解析失败
          ws.send(JSON.stringify({ type: 'error', message: '消息格式错误' }));
        }
      });
      
      ws.on('close', () => {
        console.log(`用户 ${userId} 已断开连接`);
        clients.delete(userId);
      });
      
      ws.on('error', (error) => {
        console.error(`用户 ${userId} 的WebSocket错误:`, error);
      });
    });
    
    // 完成握手
    context.callbackWaitsForEmptyEventLoop = false;
    const server = context.websocket;
    server.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });
    
    return { 
      statusCode: 101, 
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Accept': crypto.createHash('sha1')
          .update(event.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
          .digest('base64')
      }
    };
  } catch (error) {
    console.error('身份验证失败:', error);
    return { statusCode: 401, body: '身份验证失败' };
  }
};

// 修复：参数名和WebSocket引用
function sendToUser(targetUserId, message) {
  const client = clients.get(targetUserId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
    return true;
  }
  return false;
}
