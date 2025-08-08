// 用于存储WebSocket连接和数据的简易存储
const dataStore = require('./dataStore');

// WebSocket连接处理
exports.handler = async (event, context) => {
  // 检查是否是WebSocket请求
  const { userId, token } = event.queryStringParameters;
  const user = await db.collection('users').findOne({ id: userId, token });
  if (!event.requestContext || !event.requestContext.webSocket) {
    return { statusCode: 400, body: '不是WebSocket请求' };
  }
  if (!user) {
    return { statusCode: 401, body: '未授权' };
  }
  const { connectionId, routeKey, queryStringParameters } = event.requestContext.webSocket;
  const userId = queryStringParameters?.userId;
  context.callbackWaitsForEmptyEventLoop = false;
  const interval = setInterval(() => {
    if (context.clientContext && context.clientContext.websocket) {
      context.clientContext.websocket.send(JSON.stringify({ type: 'ping' }));
    } else {
      clearInterval(interval);
    }
  }, 30000);

  try {
    switch (routeKey) {
      // 新连接
      case '$connect':
        console.log(`新连接: ${connectionId}, 用户: ${userId}`);
        
        if (userId) {
          // 存储用户的WebSocket连接
          dataStore.webSocketClients[userId] = {
            connectionId,
            send: async (message) => {
              await context.websocket.send(connectionId, message);
            }
          };
          
          // 更新用户在线状态
          dataStore.updateUserStatus(userId, true);
        }
        
        return { statusCode: 200, body: '连接成功' };

      // 断开连接
      case '$disconnect':
        console.log(`断开连接: ${connectionId}, 用户: ${userId}`);
        
        if (userId && dataStore.webSocketClients[userId]) {
          // 移除用户的WebSocket连接
          delete dataStore.webSocketClients[userId];
          
          // 更新用户在线状态
          dataStore.updateUserStatus(userId, false);
        }
        
        return { statusCode: 200, body: '断开连接' };

      // 接收消息
      case '$default':
        console.log(`收到消息: ${event.body}, 来自: ${connectionId}`);
        return { statusCode: 200, body: '消息已接收' };

      default:
        return { statusCode: 400, body: '未知操作' };
    }
  } catch (error) {
    console.error('WebSocket错误:', error);
    return { statusCode: 500, body: 'WebSocket处理错误' };
  }
};
