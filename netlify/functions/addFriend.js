// addFriend.js
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;

exports.handler = async (event) => {
    // 跨域配置
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // 仅允许 POST 方法
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '只支持 POST 请求' })
        };
    }

    let client;
    try {
        // 解析请求体
        const requestBody = event.body ? JSON.parse(event.body) : {};
        const { senderId, recipientId, message } = requestBody;

        // 关键：严格验证必填参数
        if (!senderId || !recipientId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: '参数不完整', 
                    details: '需要 senderId（发送者ID）和 recipientId（接收者ID）' 
                })
            };
        }

        // 防止添加自己为好友
        if (senderId === recipientId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '不能添加自己为好友' })
            };
        }

        // 连接数据库
        client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('userDB');

        // 检查是否已发送过请求
        const existingRequest = await db.collection('friendRequests').findOne({
            $or: [
                { senderId, recipientId, status: 'pending' },
                { senderId: recipientId, recipientId: senderId, status: 'pending' }
            ]
        });

        if (existingRequest) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '已存在待处理的好友请求' })
            };
        }

        // 检查是否已是好友
        const isFriend = await db.collection('friends').findOne({
            $or: [
                { userId: senderId, friendId: recipientId },
                { userId: recipientId, friendId: senderId }
            ]
        });

        if (isFriend) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '对方已是你的好友' })
            };
        }

        // 创建新的好友请求
        const newRequest = {
            senderId,
            recipientId,
            message: message || '请求添加你为好友',
            status: 'pending',
            sentAt: new Date()
        };

        const result = await db.collection('friendRequests').insertOne(newRequest);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                requestId: result.insertedId.toString()
            })
        };

    } catch (error) {
        console.error('发送好友请求失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: '发送好友请求失败',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    } finally {
        // 关闭数据库连接
        if (client) {
            try {
                await client.close();
            } catch (closeError) {
                console.error('关闭数据库连接失败:', closeError);
            }
        }
    }
};