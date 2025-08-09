// cancelFriendRequest.js
const { MongoClient, ObjectId } = require('mongodb');

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
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '只支持 POST 请求' })
        };
    }

    let client;
    try {
        const requestBody = JSON.parse(event.body);
        const { requestId, senderId } = requestBody;

        // 验证必填参数
        if (!requestId || !senderId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少参数：requestId 或 senderId' })
            };
        }

        // 连接数据库
        client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('userDB');

        // 验证请求存在且属于当前用户
        const request = await db.collection('friendRequests').findOne({
            _id: new ObjectId(requestId), // 注意：MongoDB的_id是ObjectId类型
            senderId: senderId,
            status: 'pending' // 只允许取消待处理状态的请求
        });

        if (!request) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: '请求不存在或已处理' })
            };
        }

        // 执行取消操作（更新状态）
        await db.collection('friendRequests').updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { status: 'cancelled', updatedAt: new Date() } }
        );

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: '请求已取消' })
        };

    } catch (error) {
        console.error('取消好友请求失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '取消请求失败' })
        };
    } finally {
        if (client) await client.close();
    }
};