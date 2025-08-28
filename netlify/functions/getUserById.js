// netlify/functions/getUserById.js
const { MongoClient } = require('mongodb');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: '只支持POST请求' }) };
    }

    try {
        const { username } = JSON.parse(event.body);
        if (!username) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少userId参数' }) };
        }

        // 连接数据库
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db('userDB');
        const usersCollection = db.collection('users');

        // 查询用户信息（只返回公开信息，不含密码）
        const user = await usersCollection.findOne(
            { username },
            { projection: { username: 1, avatar: 1, _id: 1 } }
        );

        await client.close();

        if (!user) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: '用户不存在' }) };
        }

        // 返回用户信息（统一格式）
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                id: user._id.toString(),
                username: user.username,
                avatar: user.avatar || `https://picsum.photos/seed/${user._id}/200`
            })
        };
    } catch (error) {
        console.error('查询用户失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '查询用户信息失败' })
        };
    }
};