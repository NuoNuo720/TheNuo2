const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;

exports.handler = async (event) => {
    // 跨域配置（必须添加，否则前端可能无法接收响应）
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // 处理预检flight请求（浏览器预检请求）
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: '只支持POST请求' }) };
    }

    let client;
    try {
        // 连接MongoDB（使用环境变量中的连接字符串）
        client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('userDB');
        const { userId } = JSON.parse(event.body);

        // 验证用户ID
        if (!userId) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: '用户ID不能为空' }) 
            };
        }

        console.log('查询待处理请求，用户ID:', userId);

        // 查询当前用户发送的、状态为pending的请求
        const requests = await db.collection('friendRequests').find({
            senderId: userId,       // 发送者是当前用户
            status: 'pending'       // 状态为待处理
        }).sort({ sentAt: -1 })    // 按发送时间倒序（最新的在前）
          .toArray();

        console.log('找到待处理请求数量:', requests.length);

        // 获取接收者的详细信息（用户名、头像等）
        const pendingRequests = [];
        for (const req of requests) {
            // 从users集合查询接收者信息
            const recipient = await db.collection('users').findOne(
                { id: req.recipientId },  // 匹配接收者ID
                { projection: { id: 1, username: 1, avatar: 1 } }  // 只返回需要的字段
            );

            if (recipient) {
                pendingRequests.push({
                    id: req._id.toString(),  // 好友请求ID
                    recipient: {
                        id: recipient.id,
                        username: recipient.username,
                        avatar: recipient.avatar || ''  // 处理没有头像的情况
                    },
                    sentAt: req.sentAt  // 发送时间
                });
            } else {
                console.warn(`未找到接收者信息，recipientId: ${req.recipientId}`);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(pendingRequests)
        };
    } catch (error) {
        console.error('查询待处理请求失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '获取待处理请求失败', details: error.message })
        };
    } finally {
        // 确保数据库连接关闭
        if (client) {
            try {
                await client.close();
            } catch (closeError) {
                console.error('关闭数据库连接失败:', closeError);
            }
        }
    }
};
