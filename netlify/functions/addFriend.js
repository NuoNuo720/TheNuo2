// addFriend.js
const { MongoClient, ObjectId } = require('mongodb'); // 统一使用解构语法

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

    // 仅允许 POST 方法
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '只支持 POST 请求' })
        };
    }

    let client;
    try {
        // 解析请求体（增强错误处理）
        let requestBody;
        try {
            requestBody = event.body ? JSON.parse(event.body) : {};
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '无效的JSON格式', details: parseError.message })
            };
        }

        const { senderId, recipientId, message } = requestBody;

        // 严格验证必填参数
        if (!senderId || !recipientId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: '参数不完整', 
                    details: '需要 senderId（发送者ID）和 recipientId（接收者ID）' 
                })
            };
        }

        // 防止添加自己为好友
        if (senderId === recipientId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '不能添加自己为好友' })
            };
        }

        // 连接数据库
        client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('userDB');

        // 优化查询：精确检查双向待处理请求
        const existingRequest = await db.collection('friendRequests').findOne({
            $or: [
                // 检查当前用户是否已向对方发送请求
                { senderId, recipientId, status: 'pending' },
                // 检查对方是否已向当前用户发送请求
                { senderId: recipientId, recipientId: senderId, status: 'pending' }
            ]
        });

        if (existingRequest) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: '已存在待处理的好友请求',
                    requestId: existingRequest._id.toString() // 返回已有请求ID，便于前端处理
                })
            };
        }

        // 检查是否已是好友（优化查询条件）
        const isFriend = await db.collection('friends').findOne({
            $or: [
                { userId: senderId, friendId: recipientId, status: 'active' },
                { userId: recipientId, friendId: senderId, status: 'active' }
            ]
        });

        if (isFriend) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '对方已是你的好友' })
            };
        }

        // 创建新的好友请求（补充必要字段）
        const newRequest = {
            senderId,
            recipientId,
            message: message || '请求添加你为好友',
            status: 'pending',
            sentAt: new Date(),
            updatedAt: new Date() // 新增字段，便于后续状态更新追踪
        };

        const result = await db.collection('friendRequests').insertOne(newRequest);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                requestId: result.insertedId.toString(),
                message: '好友请求已发送'
            })
        };

    } catch (error) {
        console.error('发送好友请求失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: '发送好友请求失败',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
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