const WebSocket = require('ws'); // 需先安装依赖：npm install ws

// 存储所有连接的客户端（用于后续消息推送）
const wss = new WebSocket.Server({ noServer: true });

// 处理WebSocket连接
wss.on('connection', (ws, request) => {
  console.log('新客户端连接:', request.url);
  
  // 监听客户端消息
  ws.on('message', (message) => {
    console.log('收到消息:', message.toString());
    // 示例：广播消息给所有客户端（根据业务需求调整）
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(`转发消息: ${message}`);
      }
    });
  });

  // 连接关闭时清理
  ws.on('close', () => {
    console.log('客户端断开连接');
  });
});

// Netlify Functions 入口函数
exports.handler = async (event, context) => {
  // 1. 处理预检请求（OPTIONS）：WebSocket握手前可能触发跨域预检
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        // 允许的前端域名（生产环境必须指定具体域名，如https://your-frontend.com，不要用*）
        'Access-Control-Allow-Origin': 'https://thenuo2.netlify.app', 
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, WEBSOCKET', // 明确包含WEBSOCKET
        'Access-Control-Allow-Headers': 'Content-Type, Authorization', // 匹配前端请求头
        'Access-Control-Max-Age': '86400' // 预检请求缓存时间（24小时）
      },
      body: ''
    };
  }

  // 2. 处理WebSocket握手请求（HTTP升级为WS）
  if (event.headers.upgrade !== 'websocket') {
    return {
      statusCode: 400,
      body: '仅支持WebSocket连接' // 你看到的直接访问返回内容
    };
  }

  // 3. 完成WebSocket握手（关键：将Netlify的请求对象传递给wss）
  context.awsRequestId = context.awsRequestId || 'local-dev-id'; // 兼容本地开发
  const server = {
    on: (event, callback) => {
      if (event === 'upgrade') callback(event, event.socket, event.headers);
    },
    emit: (event, ...args) => {}
  };

  // 触发WebSocket升级逻辑
  wss.handleUpgrade(event, event.socket, event.headers, (ws) => {
    wss.emit('connection', ws, event);
  });

  // Netlify Functions 需返回200状态（握手由wss处理）
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://your-frontend-domain.com', // 再次确保跨域头
      'Connection': 'Upgrade',
      'Upgrade': 'websocket'
    },
    body: ''
  };
};