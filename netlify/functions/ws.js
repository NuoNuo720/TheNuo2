// 导入必要的模块
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

// 存储连接的客户端
const clients = new Map();

// 处理WebSocket连接
exports.handler = async (event, context) => {
    // 检查是否是WebSocket请求
    if (!event.headers['sec-websocket-key']) {
        return { statusCode: 400, body: '不是WebSocket请求' };
    }

    // 从查询参数获取用户ID和token
    const queryParams = new URLSearchParams(event.rawQuery);
    const userId = queryParams.get('userId'); // 只声明一次userId
    const token = queryParams.get('token');

    // 验证用户身份
    try {
        // 验证JWT令牌
        jwt.verify(token, process.env.JWT_SECRET);
        
        // 如果验证成功，继续处理WebSocket连接
        // 这里使用Netlify的WebSocket支持
        const wss = new WebSocketServer({ noServer: true });
        
        // 处理连接
        wss.on('connection', (ws) => {
            console.log(`用户 ${userId} 已连接`);
            
            // 存储客户端连接
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
                    
                    // 根据消息类型处理
                    switch (message.type) {
                        case 'friend_request':
                            // 处理好友请求
                            sendToUser(message.recipientId, {
                                type: 'friend_request',
                                sender: {
                                    id: userId,
                                    username: message.senderUsername
                                },
                                message: message.message
                            });
                            break;
                        case 'request_accepted':
                        case 'request_rejected':
                            // 处理请求接受/拒绝
                            sendToUser(message.recipientId, {
                                type: message.type,
                                friend: {
                                    id: userId,
                                    username: message.senderUsername
                                }
                            });
                            break;
                        default:
                            console.log('未知消息类型:', message.type);
                    }
                } catch (error) {
                    console.error('处理消息错误:', error);
                }
            });
            
            // 处理连接关闭
            ws.on('close', () => {
                console.log(`用户 ${userId} 已断开连接`);
                clients.delete(userId);
            });
            
            // 处理错误
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
        
        return { statusCode: 101, headers: {
            'Upgrade': 'websocket',
            'Connection': 'Upgrade',
            'Sec-WebSocket-Accept': crypto.createHash('sha1')
                .update(event.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
                .digest('base64')
        }};
    } catch (error) {
        console.error('身份验证失败:', error);
        return { statusCode: 401, body: '身份验证失败' };
    }
};

// 发送消息给指定用户
function sendToUser(userId, message) {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
        return true;
    }
    return false;
}
    