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

        // 获取查询参数
        const { with: friendUsername, limit = 50, before } = event.queryStringParameters;
        const currentUser = event.queryStringParameters.username;

        // 验证必要参数
        if (!currentUser || !friendUsername) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少必要参数' })
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
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.username !== currentUser) {
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

        // 连接数据库
        const db = await connectToDatabase();
        
        // 构建查询条件：双方之间的消息
        const query = {
            $or: [
                { sender: currentUser, recipient: friendUsername },
                { sender: friendUsername, recipient: currentUser }
            ]
        };
        
        // 如果指定了before参数，只查询该时间之前的消息
        if (before) {
            query.timestamp = { $lt: new Date(before) };
        }

        // 查询聊天历史
        const messages = await db.collection('messages')
            .find(query)
            .sort({ timestamp: -1 }) // 按时间倒序
            .limit(parseInt(limit))
            .toArray();
        
        // 反转数组，让消息按时间正序排列
        messages.reverse();

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messages.map(msg => ({
                id: msg._id.toString(),
                sender: msg.sender,
                recipient: msg.recipient,
                content: msg.content,
                timestamp: msg.timestamp,
                status: msg.status
            })))
        };
    } catch (error) {
        console.error('获取聊天历史时出错:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '服务器内部错误' })
        };
    }
};