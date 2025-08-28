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
        const { 
            recipientUsername, // 接收通知的用户名（必传）
            type, // 通知类型：friend_request/request_accepted/request_rejected/friend_deleted（必传）
            senderUsername, // 发送通知的用户名（必传）
            content, // 通知内容（如请求消息、请求ID等，可选）
            token // 身份令牌（验证发送者合法性，必传）
        } = requestBody;

        // 2. 参数校验
        if (!recipientUsername || !type || !senderUsername || !token) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少必要参数（recipientUsername/type/senderUsername/token）' }) };
        }

        // 3. 身份验证（确保发送者是合法用户）
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.username !== senderUsername) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: '身份验证失败：发送者与令牌不匹配' }) };
        }

        // 4. 连接数据库，存储通知
        mongoClient = await MongoClient.connect(process.env.MONGODB_URI);
        const db = mongoClient.db('userDB');
        const notificationsCollection = db.collection('notifications'); // 新建 notifications 集合

        // 5. 构造通知数据
        const notificationData = {
            recipientUsername: recipientUsername, // 接收者
            senderUsername: senderUsername, // 发送者
            type: type, // 通知类型
            content: content || {}, // 自定义内容（如 { requestId: "xxx", message: "加个好友吧" }）
            isRead: false, // 是否已读（默认未读）
            createdAt: new Date(), // 创建时间（用于短轮询增量查询）
            updatedAt: new Date()
        };

        // 6. 插入数据库
        const result = await notificationsCollection.insertOne(notificationData);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                notificationId: result.insertedId.toString(), // 返回通知ID（便于后续操作）
                message: '通知已存储'
            })
        };

    } catch (error) {
        console.error('存储通知失败:', error);
        // 区分错误类型
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, headers, body: JSON.stringify({ error: '令牌无效或已过期' }) };
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