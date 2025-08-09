// getPendingRequests.js
const { MongoClient } = require('mongodb');

exports.handler = async (event) => {
    // 跨域配置
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '只支持 POST 请求' })
        };
    }

    let client;
    try {
        // 解析请求体，获取当前用户ID（发送者ID）
        const requestBody = JSON.parse(event.body);
        const { senderId } = requestBody;

        if (!senderId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少 senderId 参数' })
            };
        }

        // 连接数据库
        client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('userDB');

        // 核心查询：获取当前用户发送的所有待处理请求
        const pendingRequests = await db.collection('friendRequests')
            .find({
                senderId: senderId,  // 确保查询条件为发送者ID
                status: 'pending'    // 只查询待处理状态
            })
            .sort({ sentAt: -1 })  // 按发送时间倒序
            .toArray();

        // 补充接收者信息（如果需要）
        const requestsWithRecipient = await Promise.all(
            pendingRequests.map(async (req) => {
                const recipient = await db.collection('users').findOne(
                    { _id: req.recipientId },  // 假设用户ID存储在users集合的_id字段
                    { projection: { username: 1, avatar: 1 } }
                );
                return {
                    ...req,
                    recipient: recipient || { username: '未知用户' }
                };
            })
        );

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(requestsWithRecipient)
        };

    } catch (error) {
        console.error('获取待处理请求失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '获取待处理请求失败' })
        };
    } finally {
        if (client) {
            await client.close();
        }
    }
};