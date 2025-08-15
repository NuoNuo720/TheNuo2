const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // 验证JWT令牌（可选，用于限制未登录用户访问）
        const authHeader = event.headers.authorization;
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            try {
                jwt.verify(token, process.env.JWT_SECRET);
            } catch (err) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: '令牌无效，请重新登录' })
                };
            }
        }

        // 连接数据库
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db('userDB');
        const usersCollection = db.collection('users');

        // 查询玩家分数（只返回需要的字段）
        const users = await usersCollection.find(
            { score: { $exists: true } }, // 只查询有分数的用户
            { projection: { username: 1, score: 1, avatar: 1, lastLogin: 1 } }
        )
            .sort({ score: -1 }) // 按分数降序排序
            .limit(10) // 只取前10名
            .toArray();

        await client.close();

        // 格式化返回数据
        const rankedUsers = users.map((user, index) => ({
            rank: index + 1,
            username: user.username,
            score: user.score || 0,
            avatar: user.avatar || `https://picsum.photos/seed/${user._id}/200`,
            lastLogin: user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '未记录'
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(rankedUsers)
        };
    } catch (error) {
        console.error('获取排行榜失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '获取排行榜数据失败' })
        };
    }
};