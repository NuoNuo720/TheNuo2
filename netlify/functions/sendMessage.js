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
        const { username, targetUsername, content } = requestBody;
        
        // 验证参数
        if (!username || !targetUsername || !content) {
            return { 
                statusCode: 400, 
                headers,
                body: JSON.stringify({ error: '参数不完整，需要username、targetUsername和content' }) 
            };
        }

        // 防止发送空消息
        if (content.trim() === '') {
            return { 
                statusCode: 400, 
                headers,
                body: JSON.stringify({ error: '消息内容不能为空' }) 
            };
        }

        // 防止向自己发送消息
        if (username === targetUsername) {
            return { 
                statusCode: 400, 
                headers,
                body: JSON.stringify({ error: '不能向自己发送消息' }) 
            };
        }

        // 连接数据库
        const db = await connectToDatabase();
        const messagesCollection = db.collection('messages');
        const usersCollection = db.collection('users');

        // 检查用户是否存在（可选，根据你的业务需求）
        const userExists = await usersCollection.countDocuments({
            username: { $in: [username, targetUsername] }
        }) >= 2;

        if (!userExists) {
            return { 
                statusCode: 404, 
                headers,
                body: JSON.stringify({ error: '用户不存在' }) 
            };
        }

        // 检查是否为好友（可选，根据你的业务需求）
        const isFriend = await usersCollection.countDocuments({
            username: username,
            friends: targetUsername
        }) > 0;

        if (!isFriend) {
            return { 
                statusCode: 403, 
                headers,
                body: JSON.stringify({ error: '只能向好友发送消息' }) 
            };
        }

        // 保存消息到数据库
        const result = await messagesCollection.insertOne({
            sender: username,
            receiver: targetUsername,
            content: content,
            timestamp: new Date(),
            isRead: false
        });

        // 返回成功响应
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                messageId: result.insertedId,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('发送消息失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '发送消息失败，请稍后重试' })
        };
    }
};