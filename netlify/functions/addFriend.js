const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken'); // 需要安装：npm install jsonwebtoken

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || '*', // 限制来源更安全
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
        // 解析请求体
        const body = JSON.parse(event.body);
        const { senderUsername, recipientUsername, message } = body;
        
        // 1. 严格参数验证
        if (!senderUsername || !recipientUsername) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: '缺少senderUsername或recipientUsername' }) 
            };
        }
        // 禁止向自己发送请求
        if (senderUsername === recipientUsername) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: '不能向自己发送好友请求' }) 
            };
        }
        // 验证用户名格式（假设只允许字母、数字、下划线，3-20位）
        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
        if (!usernameRegex.test(senderUsername) || !usernameRegex.test(recipientUsername)) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: '用户名格式无效' }) 
            };
        }

        // 2. 验证用户身份（通过JWT）
        const token = event.headers.authorization?.split(' ')[1];
        if (!token) {
            return { 
                statusCode: 401, 
                headers, 
                body: JSON.stringify({ error: '未提供身份令牌' }) 
            };
        }
        // 验证token有效性，并确保与senderUsername一致
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.username !== senderUsername) {
            return { 
                statusCode: 403, 
                headers, 
                body: JSON.stringify({ error: '身份验证失败，用户名不匹配' }) 
            };
        }

        // 3. 检查接收者是否存在（避免向不存在的用户发送请求）
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db('userDB');
        const usersCollection = db.collection('users'); // 假设用户信息存在users集合
        const recipientExists = await usersCollection.findOne(
            { username: recipientUsername },
            { projection: { _id: 1 } } // 只查ID，提高效率
        );
        if (!recipientExists) {
            await client.close();
            return { 
                statusCode: 404, 
                headers, 
                body: JSON.stringify({ error: '接收者用户不存在' }) 
            };
        }

        // 4. 检查是否已存在待处理请求或已成为好友
        const requestsCollection = db.collection('friendRequests');
        const friendsCollection = db.collection('friends'); // 假设好友关系存在friends集合
        
        // 检查是否已有待处理请求
        const existingRequest = await requestsCollection.findOne({
            $or: [
                { senderUsername, recipientUsername, status: 'pending' },
                { senderUsername: recipientUsername, recipientUsername: senderUsername, status: 'pending' }
            ]
        });
        if (existingRequest) {
            await client.close();
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ 
                    error: '已存在待处理的好友请求', 
                    requestId: existingRequest._id.toString() 
                }) 
            };
        }

        // 检查是否已是好友
        const isAlreadyFriend = await friendsCollection.findOne({
            $or: [
                { user1: senderUsername, user2: recipientUsername },
                { user1: recipientUsername, user2: senderUsername }
            ]
        });
        if (isAlreadyFriend) {
            await client.close();
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: '你们已经是好友了' }) 
            };
        }

        // 5. 创建新请求
        const newRequest = {
            senderUsername,
            recipientUsername,
            message: message || '请求添加你为好友', // 默认消息
            status: 'pending',
            sentAt: new Date(),
            updatedAt: new Date()
        };

        const result = await requestsCollection.insertOne(newRequest);
        await client.close();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                requestId: result.insertedId.toString(),
                message: '好友请求已发送'
            })
        };
    } catch (error) {
        console.error('发送请求失败:', error);
        // 区分错误类型，返回更具体的信息
        if (error.name === 'JsonWebTokenError') {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: '无效的令牌' })
            };
        }
        if (error.name === 'TokenExpiredError') {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: '令牌已过期' })
            };
        }
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '服务器内部错误' })
        };
    }
};