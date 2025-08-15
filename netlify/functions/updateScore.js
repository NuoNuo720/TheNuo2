const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // 验证token
        const token = event.headers.authorization?.split(' ')[1];
        if (!token) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: '未提供令牌' }) };
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const username = decoded.username;

        // 解析请求数据
        const { score } = JSON.parse(event.body);
        if (typeof score !== 'number' || score < 0) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: '无效的分数' }) };
        }

        // 更新数据库
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db('userDB');
        const usersCollection = db.collection('users');

        // 只更新更高的分数
        await usersCollection.updateOne(
            { username },
            { $max: { score }, $set: { lastLogin: new Date() } }
        );

        await client.close();
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error('更新分数失败:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: '更新分数失败' }) };
    }
};