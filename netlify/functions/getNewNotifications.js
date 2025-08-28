const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    // 跨域配置
    const headers = {
        'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: '仅支持 GET 请求' }) };
    }

    let mongoClient;
    try {
        // 1. 从查询参数获取数据
        const queryParams = new URLSearchParams(event.rawQuery);
        const username = queryParams.get('username') || ''; // 当前用户（接收通知者）
        const lastCheckTime = queryParams.get('lastCheckTime') || ''; // 上次检查时间（前端传入）
        const token = queryParams.get('token') || ''; // 身份令牌

        // 2. 参数校验
        if (!username || !token) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少必要参数（username/token）' }) };
        }

        // 3. 身份验证
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.username !== username) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: '身份验证失败：用户名与令牌不匹配' }) };
        }

        // 4. 连接数据库，查询新通知
        mongoClient = await MongoClient.connect(process.env.MONGODB_URI);
        const db = mongoClient.db('userDB');
        const notificationsCollection = db.collection('notifications');

        // 5. 构造查询条件：接收者是当前用户 + 通知创建时间晚于上次检查时间
        const query = {
            recipientUsername: username,
            createdAt: lastCheckTime ? { $gt: new Date(lastCheckTime) } : {} // 增量查询核心
        };

        // 6. 查询通知（按创建时间倒序，最新的在前）
        const newNotifications = await notificationsCollection.find(query)
            .sort({ createdAt: -1 })
            .toArray();

        // 7. 格式化返回结果（将 ObjectId 转为字符串，便于前端处理）
        const formattedNotifications = newNotifications.map(notify => ({
            ...notify,
            _id: notify._id.toString(), // ObjectId 转字符串
            createdAt: notify.createdAt.toISOString(), // 时间格式化
            updatedAt: notify.updatedAt.toISOString()
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                newNotifications: formattedNotifications, // 新通知列表
                currentTime: new Date().toISOString() // 当前时间（前端下次轮询时作为 lastCheckTime）
            })
        };

    } catch (error) {
        console.error('查询新通知失败:', error);
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