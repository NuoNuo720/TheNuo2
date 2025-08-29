const WebSocket = require('ws');

const wss = new WebSocket.Server({ noServer: true });

// 处理WebSocket连接
wss.on('connection', (ws, request) => {
  console.log('新客户端连接:', request.url);
  
  // 监听客户端消息
  ws.on('message', (message) => {
    console.log('收到消息:', message.toString());
    // 广播消息给所有客户端
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(`转发消息: ${message}`);
      }
    });
  });

  // 连接关闭时清理
  ws.on('close', () => {
    console.log('客户端断开连接');
  });
  
  // 发送连接成功消息
  ws.send('已成功建立WebSocket连接');
});

exports.handler = async (event, context) => {
  // 允许函数保持活跃以维持WebSocket连接
  context.callbackWaitsForEmptyEventLoop = false;
  
  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://thenuo2.netlify.app',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
  }

  // 处理WebSocket握手请求
  if (event.headers.upgrade === 'websocket') {
    // 创建模拟服务器对象
    const server = {
      on: () => {},
      emit: (event, socket, request) => {
        if (event === 'upgrade') {
          wss.handleUpgrade(request, socket, Buffer.alloc(0), (ws) => {
            wss.emit('connection', ws, request);
          });
        }
      }
    };

    // 触发升级事件
    server.emit('upgrade', event.socket, event);
    
    // 返回101切换协议响应
    return {
      statusCode: 101,
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Accept': calculateAcceptValue(event.headers['sec-websocket-key'])
      },
      body: ''
    };
  }

  // 非WebSocket请求
  return {
    statusCode: 400,
    body: '仅支持WebSocket连接'
  };
};

// 计算WebSocket握手响应值
function calculateAcceptValue(key) {
  const crypto = require('crypto');
  const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  return crypto
    .createHash('sha1')
    .update(key + GUID)
    .digest('base64');
}