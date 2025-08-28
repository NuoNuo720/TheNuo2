const { MongoClient, ObjectId } = require('mongodb');

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

    try {
        // 从查询参数获取用户名和 token（统一使用 username）
        const queryParams = new URLSearchParams(event.rawQuery);
        const username = queryParams.get('username') || '';
        const token = queryParams.get('token') || '';
        const lastCheckTime = queryParams.get('lastCheckTime') || ''; // 上次检查时间，用于获取增量消息

        // 验证身份
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.username !== username) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: '身份验证失败' }) };
        }

        // 连接数据库，查询未读通知
        const client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('userDB');
        const notificationsCollection = db.collection('notifications');

        // 查询条件：接收者是当前用户，且创建时间晚于上次检查时间
        const query = {
            recipientUsername: username,
            createdAt: lastCheckTime ? { $gt: new Date(lastCheckTime) } : {}
        };

        // 获取最新通知
        const newNotifications = await notificationsCollection.find(query)
            .sort({ createdAt: -1 })
            .toArray();

        await client.close();

        // 返回通知和当前时间（供下次轮询使用）
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                notifications: newNotifications,
                currentTime: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('获取通知失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '服务器处理失败' })
        };
    }
};