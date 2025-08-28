// checkUpdates.js
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS' // 支持OPTIONS预检请求
    };

    // 处理预检请求（解决跨域时的浏览器预检问题）
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // 仅允许POST方法
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
            requestData = event.body ? JSON.parse(event.body) : {};
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '无效的JSON格式' })
            };
        }

        const { username } = requestData;
        if (!username) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '用户名为空' })
            };
        }

        // 连接数据库
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db('userDB');
        
        // 确定上次检查时间（默认为24小时前，避免首次查询返回过多历史数据）
        let lastCheckTime = new Date();
        lastCheckTime.setDate(lastCheckTime.getDate() - 1); // 24小时前
        
        if (requestData.lastCheckTime) {
            try {
                lastCheckTime = new Date(requestData.lastCheckTime);
                // 验证日期有效性
                if (isNaN(lastCheckTime.getTime())) {
                    throw new Error('无效的日期格式');
                }
            } catch (dateError) {
                console.warn('无效的lastCheckTime，使用默认值:', dateError.message);
            }
        }

        // 检查新的好友请求（自上次检查以来）
        const newRequests = await db.collection('friendRequests')
            .find({ 
                recipientUsername: username,       // 接收者是当前用户
                status: 'pending',         // 状态为待处理
                sentAt: { $gt: lastCheckTime } // 只查询上次检查后新增的
            })
            .count();
        
        // 检查新接受的请求（对方接受了当前用户的请求）
        const newAcceptedRequests = await db.collection('friendRequests')
            .find({ 
                senderUsername: username,          // 发送者是当前用户
                status: 'accepted',        // 状态为已接受
                updatedAt: { $gt: lastCheckTime } // 只查询上次检查后更新的
            })
            .toArray();
        
        // 获取接受请求的用户信息（用户名等）
        const acceptedUserIds = newAcceptedRequests.map(req => req.recipientId);
        const acceptedUsers = acceptedUserIds.length > 0 
            ? await db.collection('users')
                .find({ _id: { $in: acceptedUserIds.map(id => new ObjectId(id)) } })
                .project({ username: 1, avatar: 1 }) // 只返回需要的字段
                .toArray()
            : [];

        // 格式化返回的用户数据（适配前端显示）
        const formattedUsers = acceptedUsers.map(user => ({
            id: user._id.toString(),
            username: user.username,
            avatar: user.avatar || '' // 处理没有头像的情况
        }));

        // 返回结果
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                newFriendRequests: newRequests,       // 新增的好友请求数量
                newAcceptedRequests: formattedUsers,  // 新接受请求的用户列表
                lastCheckTime: new Date().toISOString() // 当前时间，用于下次查询
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
        // 确保数据库连接关闭
        if (client) {
            try {
                await client.close();
            } catch (closeErr) {
                console.error('关闭数据库连接错误:', closeErr);
            }
        }
    }
};