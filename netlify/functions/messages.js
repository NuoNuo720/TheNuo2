const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

// 数据库连接函数
async function connectToDatabase() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    return client.db(process.env.DB_NAME || 'socialApp');
}

exports.handler = async (event, context) => {
    // 允许跨域请求
    const headers = {
        'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }

    try {
        // 仅允许GET请求
        if (event.httpMethod !== 'GET') {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: '只允许GET请求' })
            };
        }

        // 从查询参数中获取用户名和时间戳
        const { username, since } = event.queryStringParameters;

        // 验证必要参数
        if (!username || !since) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少必要必要参数（username或since）' })
            };
        }

        // 验证token
        const authHeader = event.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: '未授权访问' })
            };
        }

        // 验证token有效性
        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            // 确保token中的用户名与请求的用户名一致
            if (decoded.username !== username) {
                return {
                    statusCode: 403,
                    headers,
                    body: JSON.stringify({ error: '权限不足' })
                };
            }
        } catch (error) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: error.name === 'TokenExpiredError' ? '令牌已过期' : '无效的令牌' 
                })
            };
        }

        // 连接数据库并获取新消息
        const db = await connectToDatabase();
        const messagesCollection = db.collection('messages');
        
        // 查询指定时间之后的消息
        const newMessages = await messagesCollection.find({
            recipient: username,
            timestamp: { $gt: new Date(since) }
        }).sort({ timestamp: 1 }).toArray();

        // 更新用户最后活跃时间
        await db.collection('users').updateOne(
            { username },
            { $set: { lastActive: new Date() } }
        );

        // 返回消息列表
        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: newMessages.map(msg => ({
                    id: msg._id.toString(),
                    sender: msg.sender,
                    recipient: msg.recipient,
                    content: msg.content,
                    timestamp: msg.timestamp,
                    type: 'message',
                    status: msg.status
                }))
            })
        };
    } catch (error) {
        console.error('处理消息请求时出错:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '服务器内部错误' })
        };
    }
};