const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

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
        // 验证JWT令牌
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: '未提供有效令牌' })
            };
        }
        
        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: '令牌无效或已过期' })
            };
        }

        // 解析请求数据
        let requestData;
        try {
            requestData = JSON.parse(event.body);
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '无效的JSON格式' })
            };
        }

        const userId = requestData.userId;
        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '用户ID不能为空' })
            };
        }

        // 连接数据库
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db('userDB');
        
        // 确定上次检查时间（默认为24小时前）
        let lastCheckTime = new Date();
        lastCheckTime.setDate(lastCheckTime.getDate() - 1); // 24小时前
        
        if (requestData.lastCheckTime) {
            try {
                lastCheckTime = new Date(requestData.lastCheckTime);
            } catch (dateError) {
                console.warn('无效的lastCheckTime，使用默认值');
            }
        }

        // 检查新的好友请求（自上次检查以来）
        const newRequests = await db.collection('friendRequests')
            .find({ 
                recipientId: userId,
                status: 'pending',
                sentAt: { $gt: lastCheckTime }
            })
            .count();
        
        // 检查新接受的请求
        const newAcceptedRequests = await db.collection('friendRequests')
            .find({ 
                senderId: userId,
                status: 'accepted',
                updatedAt: { $gt: lastCheckTime }
            })
            .toArray();
        
        // 获取接受请求的用户信息
        const acceptedUserIds = newAcceptedRequests.map(req => req.recipientId);
        const acceptedUsers = acceptedUserIds.length > 0 
            ? await db.collection('users')
                .find({ _id: { $in: acceptedUserIds.map(id => new ObjectId(id)) } })
                .project({ username: 1 })
                .toArray()
            : [];

        // 格式化返回的用户数据
        const formattedUsers = acceptedUsers.map(user => ({
            id: user._id.toString(),
            username: user.username
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                newFriendRequests: newRequests,
                newAcceptedRequests: formattedUsers,
                lastCheckTime: new Date().toISOString()
            })
        };

    } catch (err) {
        console.error('检查更新错误:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: '服务器错误', 
                details: process.env.NODE_ENV === 'development' ? err.message : undefined 
            })
        };
    } finally {
        if (client) {
            try {
                await client.close();
            } catch (closeErr) {
                console.error('关闭数据库连接错误:', closeErr);
            }
        }
    }
};