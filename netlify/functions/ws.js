const crypto = require('crypto');
const { WebSocket } = require('ws'); // 无需创建WebSocketServer，用Netlify提供的实例
const jwt = require('jsonwebtoken');

// 存储在线客户端：key=userId，value=WebSocket实例
const clients = new Map();

exports.handler = async (event, context) => {
  // 1. 检查是否是WebSocket升级请求（必须先判断，否则无法进入握手流程）
  if (event.requestContext?.eventType !== 'CONNECT') {
    return { statusCode: 400, body: '仅支持WebSocket连接' };
  }

  try {
    // 2. 解析前端传入的URL参数（修复：支持username和token，与前端对齐）
    const queryParams = new URLSearchParams(event.rawQuery);
    const username = queryParams.get('username') || ''; // 前端传的是username
    const token = queryParams.get('token') || ''; // 前端必须传token

    // 3. 验证token（修复：从token中获取userId，而非前端传userId）
    if (!token) throw new Error('缺少token');
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // 确保环境变量JWT_SECRET已配置
    const userId = decoded.userId; // 从token中解析userId（与login.js生成的token字段一致）
    if (!userId) throw new Error('token中无有效userId');

    // 4. 获取Netlify提供的WebSocket实例（关键：无需自己创建Server）
    const ws = context.websocket;

    // 5. 处理连接建立
    ws.on('open', () => {
      console.log(`用户 ${username}（userId: ${userId}）已连接`);
      clients.set(userId, ws); // 用userId作为key存储，便于后续消息转发

      // 发送连接成功通知给前端
      ws.send(JSON.stringify({
        type: 'connection_established',
        message: '实时连接已建立',
        username: username,
        userId: userId
      }));
    });

    // 6. 处理前端发送的消息
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()); // 需转成字符串再解析
        console.log(`收到 ${username} 的消息:`, message);

        // 根据消息类型分发（保持原有逻辑，适配前端消息格式）
        switch (message.type) {
          case 'friend_request':
            // 转发好友请求给接收者（需知道接收者的userId）
            sendToUser(message.recipientUserId, {
              type: 'friend_request',
              sender: { id: userId, username: username },
              message: message.content, // 假设前端传的消息内容字段是content
              requestId: message.requestId // 携带请求ID，便于前端匹配
            });
            break;

          case 'request_accepted':
          case 'request_rejected':
            // 转发同意/拒绝通知给请求发送者
            sendToUser(message.senderUserId, {
              type: message.type,
              friend: { id: userId, username: username },
              requestId: message.requestId
            });
            break;

          default:
            console.warn('未知消息类型:', message.type);
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: `未知消息类型: ${message.type}` 
            }));
        }
      } catch (error) {
        console.error('处理消息失败:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: '消息格式错误，请检查JSON格式' 
        }));
      }
    });

    // 7. 处理连接关闭
    ws.on('close', (code, reason) => {
      console.log(`用户 ${username} 已断开连接，代码: ${code}，原因: ${reason.toString()}`);
      clients.delete(userId); // 从在线列表中移除
    });

    // 8. 处理连接错误
    ws.on('error', (error) => {
      console.error(`用户 ${username} 连接错误:`, error);
      clients.delete(userId);
    });

    // 9. 关键：阻止Netlify关闭空闲连接（Netlify Functions默认会关闭空闲连接）
    context.callbackWaitsForEmptyEventLoop = false;

    // 10. 返回101状态码，完成WebSocket握手
    return {
      statusCode: 101,
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Accept': crypto
          .createHash('sha1')
          .update(event.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
          .digest('base64'),
        'Access-Control-Allow-Origin': '*' // 开发环境可先用*，生产环境替换为前端域名
      }
    };

  } catch (error) {
    console.error('WebSocket连接失败（身份验证/参数错误）:', error.message);
    // 验证失败时，返回401并关闭连接
    return {
      statusCode: 401,
      body: `连接失败: ${error.message}`,
      headers: { 'Content-Type': 'text/plain' }
    };
  }
};

// 修复：消息转发函数（确保目标用户在线且连接正常）
function sendToUser(targetUserId, message) {
  const targetWs = clients.get(targetUserId);
  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
    targetWs.send(JSON.stringify(message));
    console.log(`已转发消息给 userId: ${targetUserId}`, message);
    return true;
  }
  console.warn(`目标用户 userId: ${targetUserId} 不在线或连接已关闭`);
  return false;
}