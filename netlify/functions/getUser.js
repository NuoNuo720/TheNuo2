const { MongoClient } = require('mongodb');
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
    try {
        // 验证token（实际项目需完善）
        const token = event.headers.authorization?.split(' ')[1];
        if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: '未授权' }) };

        // 从数据库查询用户（根据token关联的用户ID）
        const client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('userDB');
        const user = await db.collection('users').findOne({ authToken: token });
        client.close();

        if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: '用户不存在' }) };

        // 返回用户信息（包含ObjectID）
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                _id: user._id, // MongoDB的ObjectID
                username: user.username,
                isAdmin: user.isAdmin
            })
        };
    } catch (e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
};