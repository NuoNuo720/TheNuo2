// netlify/functions/addFriend.js
const { MongoClient } = require('mongodb');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
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
        const { senderId, recipientId, message } = JSON.parse(event.body);
        
        // 验证参数
        if (!senderId || !recipientId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少senderId或recipientId' }) };
        }

        // 连接数据库
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db('userDB');
        const requestsCollection = db.collection('friendRequests');

        // 检查是否已存在待处理请求
        const existingRequest = await requestsCollection.findOne({
            senderId,
            recipientId,
            status: 'pending'
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

        // 关键修复：正确存储发送者和接收者（不颠倒）
        const newRequest = {
            senderId: senderId,       // 发送者ID（如test）
            recipientId: recipientId, // 接收者ID（如test7）
            message: message || '',
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
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '发送好友请求失败' })
        };
    }
};