const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

// 数据库连接函数
async function connectToDatabase() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    return client.db(process.env.DB_NAME || 'socialApp');
}

exports.handler = async (event, context) => {
    // 允许跨域请求
    const headers = {
        'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }

    try {
        // 验证token
        const authHeader = event.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: '未授权访问' })
            };
        }

        // 验证token有效性
        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: error.name === 'TokenExpiredError' ? '令牌已过期' : '无效的令牌' 
                })
            };
        }

        const currentUser = decoded.username;
        const db = await connectToDatabase();

        // 处理GET请求 - 获取好友请求
        if (event.httpMethod === 'GET') {
            const requests = await db.collection('friendRequests').find({
                recipient: currentUser,
                status: 'pending'
            }).toArray();

            return {
                statusCode: 200,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requests.map(req => ({
                    id: req._id.toString(),
                    sender: req.sender,
                    message: req.message,
                    timestamp: req.timestamp
                })))
            };
        }

        // 处理POST请求 - 发送/接受/拒绝好友请求
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { action, recipient, requestId } = body;

            // 发送好友请求
            if (action === 'send') {
                if (!recipient) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: '缺少接收者用户名' })
                    };
                }

                // 不能添加自己为好友
                if (recipient === currentUser) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: '不能添加自己为好友' })
                    };
                }

                // 检查接收者是否存在
                const recipientExists = await db.collection('users').findOne(
                    { username: recipient },
                    { projection: { _id: 1 } }
                );

                if (!recipientExists) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ error: '用户不存在' })
                    };
                }

                // 检查是否已经是好友
                const isFriend = await db.collection('friends').findOne({
                    $or: [
                        { user1: currentUser, user2: recipient },
                        { user1: recipient, user2: currentUser }
                    ]
                });

                if (isFriend) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: '已经是好友' })
                    };
                }

                // 检查是否已有请求
                const existingRequest = await db.collection('friendRequests').findOne({
                    $or: [
                        { sender: currentUser, recipient, status: 'pending' },
                        { sender: recipient, recipient: currentUser, status: 'pending' }
                    ]
                });

                if (existingRequest) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: '已有 pending 的好友请求' })
                    };
                }

                // 创建新请求
                const result = await db.collection('friendRequests').insertOne({
                    sender: currentUser,
                    recipient,
                    message: body.message || '请求添加你为好友',
                    status: 'pending',
                    timestamp: new Date()
                });

                return {
                    statusCode: 200,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        success: true,
                        requestId: result.insertedId.toString()
                    })
                };
            }

            // 接受好友请求
            if (action === 'accept' && requestId) {
                const request = await db.collection('friendRequests').findOne({
                    _id: new require('mongodb').ObjectId(requestId),
                    recipient: currentUser,
                    status: 'pending'
                });

                if (!request) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ error: '请求不存在' })
                    };
                }

                // 更新请求状态
                await db.collection('friendRequests').updateOne(
                    { _id: new require('mongodb').ObjectId(requestId) },
                    { $set: { status: 'accepted' } }
                );

                // 添加到好友列表
                await db.collection('friends').insertOne({
                    user1: currentUser,
                    user2: request.sender,
                    createdAt: new Date()
                });

                return {
                    statusCode: 200,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ success: true })
                };
            }

            // 拒绝好友请求
            if (action === 'reject' && requestId) {
                await db.collection('friendRequests').updateOne(
                    { 
                        _id: new require('mongodb').ObjectId(requestId),
                        recipient: currentUser,
                        status: 'pending'
                    },
                    { $set: { status: 'rejected' } }
                );

                return {
                    statusCode: 200,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ success: true })
                };
            }

            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '无效的操作' })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '不支持的请求方法' })
        };
    } catch (error) {
        console.error('处理好友请求时出错:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '服务器内部错误' })
        };
    }
};