const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    // 跨域配置
    const headers = {
        'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: '仅支持 POST 请求' }) };
    }

    let mongoClient;
    try {
        // 1. 解析请求体
        const requestBody = JSON.parse(event.body || '{}');
        const { notificationId, username, token } = requestBody;

        // 2. 参数校验
        if (!notificationId || !username || !token) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少必要参数（notificationId/username/token）' }) };
        }

        // 3. 身份验证
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.username !== username) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: '身份验证失败' }) };
        }

        // 4. 连接数据库，标记已读
        mongoClient = await MongoClient.connect(process.env.MONGOD_URI);
        const db = mongoClient.db('userDB');
        const notificationsCollection = db.collection('notifications');

        // 5. 执行更新（仅允许标记自己的通知为已读）
        const result = await notificationsCollection.updateOne(
            { 
                _id: new ObjectId(notificationId), 
                recipientUsername: username // 确保是当前用户的通知
            },
            { $set: { isRead: true, updatedAt: new Date() } }
        );

        if (result.modifiedCount === 0) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: '通知不存在或已标记为已读' }) };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: '通知已标记为已读' })
        };

    } catch (error) {
        console.error('标记通知失败:', error);
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, headers, body: JSON.stringify({ error: '令牌无效或已过期' }) };
        }
        if (error.name === 'MongoParseError') {
            return { statusCode: 400, headers, body: JSON.stringify({ error: '通知ID格式错误' }) };
        }
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '服务器处理失败', details: process.env.NODE_ENV === 'development' ? error.message : undefined })
        };
    } finally {
        if (mongoClient) await mongoClient.close();
    }
};