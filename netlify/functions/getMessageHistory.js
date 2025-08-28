const { MongoClient } = require('mongodb');

// 数据库连接函数
async function connectToDatabase() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    return client.db('Cluster0'); // 替换为你的数据库名称
}

exports.handler = async (event) => {
    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    // 只处理POST请求
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers,
            body: JSON.stringify({ error: '只支持POST请求' }) 
        };
    }

    try {
        // 解析请求体
        const requestBody = JSON.parse(event.body || '{}');
        const { username, targetUsername } = requestBody;
        
        // 验证参数
        if (!username || !targetUsername) {
            return { 
                statusCode: 400, 
                headers,
                body: JSON.stringify({ error: '参数不完整，需要username和targetUsername' }) 
            };
        }

        // 连接数据库
        const db = await connectToDatabase();
        const messagesCollection = db.collection('messages');

        // 查询两个用户之间的聊天记录
        const messages = await messagesCollection.find({
            $or: [
                { sender: username, receiver: targetUsername },
                { sender: targetUsername, receiver: username }
            ]
        })
        .sort({ timestamp: 1 }) // 按时间升序排序
        .limit(100) // 限制最多返回100条记录
        .toArray();

        // 格式化返回结果
        const result = messages.map(msg => ({
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.timestamp.toISOString()
        }));

        // 返回查询到的聊天记录
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };
    } catch (error) {
        console.error('获取聊天记录失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '获取聊天记录失败，请稍后重试' })
        };
    }
};