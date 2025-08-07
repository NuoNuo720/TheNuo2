const WebSocket = require('ws');
const { MongoClient } = require('mongodb');

let wss;
let client;
const users = new Map(); // 存储用户连接

async function connectToDatabase() {
  if (!client) {
    client = await MongoClient.connect(process.env.MONGODB_URI);
  }
  return client.db('userDB');
}

// 广播消息给特定用户
function sendToUser(userId, message) {
  if (users.has(userId)) {
    users.get(userId).send(JSON.stringify(message));
  }
}

exports.handler = async (event, context) => {
  if (!wss) {
    wss = new WebSocket.Server({ noServer: true });
    
    wss.on('connection', (ws, request) => {
      const urlParams = new URLSearchParams(request.url.slice(1));
      const userId = urlParams.get('userId');
      
      if (userId) {
        users.set(userId, ws);
        console.log(`User ${userId} connected`);
      }
      
      ws.on('close', () => {
        if (userId) {
          users.delete(userId);
          console.log(`User ${userId} disconnected`);
        }
      });
    });
    
    // 监听好友请求集合变化
    const db = await connectToDatabase();
    const changeStream = db.collection('friendRequests').watch();
    
    changeStream.on('change', (change) => {
      if (change.operationType === 'insert') {
        const newRequest = change.fullDocument;
        // 向接收者发送通知
        sendToUser(newRequest.recipientId, {
          type: 'friend_request',
          request: newRequest,
          sender: {
            id: newRequest.senderId,
            username: newRequest.senderUsername
          }
        });
      } else if (change.operationType === 'update') {
        const request = change.fullDocument;
        if (request.status === 'accept') {
          // 向发送者发送接受通知
          sendToUser(request.senderId, {
            type: 'request_accepted',
            friend: {
              id: request.recipientId
            }
          });
        }
      }
    });
  }

  if (event.requestContext.ws) {
    context.waitUntil(new Promise((resolve, reject) => {
      wss.handleUpgrade(event, event.socket, event.headers, (ws) => {
        wss.emit('connection', ws, event);
        resolve();
      });
    }));
    
    return { statusCode: 101, headers: { Upgrade: 'websocket', Connection: 'Upgrade' } };
  }
  
  return { statusCode: 400, body: 'Not a WebSocket request' };
};