// netlify/functions/getFriendRequests.js
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
        const { recipientId } = JSON.parse(event.body);
        
        if (!recipientId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少recipientId' }) };
        }

        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db('userDB');
        const requestsCollection = db.collection('friendRequests');

        // 关键修复：只查询发给当前用户的请求
        const requests = await requestsCollection.find({
            recipientId: recipientId,  // 接收者是当前用户
            status: 'pending'
        }).toArray();

        await client.close();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(requests)
        };
    } catch (error) {
        console.error('获取请求失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '获取好友请求失败' })
        };
    }
};