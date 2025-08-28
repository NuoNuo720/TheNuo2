const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST'
    };

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers,
            body: JSON.stringify({ error: '只支持POST请求' }) 
        };
    }

    let client;
    try {
        // 验证token（保持不变）
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: '未提供有效令牌' })
            };
        }
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET);

        // 解析请求参数
        const requestData = JSON.parse(event.body);
        const { query = '', excludeUsername } = requestData;

        if (!excludeUsername) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少排除用户ID' })
            };
        }

        // 连接数据库
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db('userDB');

        // 构建查询条件
        const queryCondition = query 
            ? { username: new RegExp(query, 'i') } 
            : {};

        // 关键修复：使用MongoDB默认的`_id`字段进行查询和投影
        const users = await db.collection('users')
            .find({
                ...queryCondition,
                // 排除当前用户（使用`_id`而非`id`）
                username: { $ne: excludeUsername } 
            })
            // 投影需要的字段（`_id`是MongoDB默认主键）
            .project({ _id: 1, username: 1, avatar: 1, isOnline: 1 })
            .toArray();

        // 格式化结果：将`_id`映射为前端需要的`id`
        const result = users.map(user => ({
            id: user._id.toString(), // 将ObjectId转为字符串
            username: user.username,
            avatar: user.avatar || '',
            isOnline: user.isOnline || false
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('搜索用户错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '搜索失败', details: error.message })
        };
    } finally {
        if (client) await client.close();
    }
};