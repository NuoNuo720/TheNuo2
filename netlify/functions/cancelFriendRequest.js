// 优化后的取消请求接口，增加异常处理和数据校验
const { MongoClient, ObjectId } = require('mongodb');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: '仅支持POST请求' }) };
    }

    let client;
    try {
        const requestBody = JSON.parse(event.body);
        const { requestId, senderId } = requestBody;

        // 1. 基础参数校验
        if (!requestId || !senderId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少requestId或senderId' }) };
        }

        // 2. 连接数据库
        client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('userDB');
        const requestsCollection = db.collection('friendRequests');

        // 3. 查询请求记录（增加容错处理）
        let request;
        try {
            request = await requestsCollection.findOne({
                _id: new ObjectId(requestId), // 尝试转换为ObjectId
                senderId: senderId,
                status: 'pending'
            });
        } catch (idError) {
            // 处理无效ObjectId格式（如请求ID错误）
            console.error('无效的requestId格式:', idError);
            return { statusCode: 400, headers, body: JSON.stringify({ error: '请求ID格式错误' }) };
        }

        // 4. 处理请求不存在的情况
        if (!request) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: '请求不存在或已处理' }) };
        }

        // 5. 处理异常数据（如recipientId无效）
        if (!request.recipientId || request.recipientId === 'undefined') {
            console.warn('检测到异常请求，直接删除:', request._id);
            await requestsCollection.deleteOne({ _id: new ObjectId(requestId) });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: '异常请求已清除' }) };
        }

        // 6. 正常更新请求状态
        await requestsCollection.updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { status: 'cancelled', updatedAt: new Date() } }
        );

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: '请求已取消' }) };

    } catch (error) {
        // 捕获所有未处理的异常，避免500错误
        console.error('取消请求失败:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ 
            error: '服务器处理失败', 
            details: process.env.NODE_ENV === 'development' ? error.message : undefined 
        }) };
    } finally {
        if (client) await client.close(); // 确保数据库连接关闭
    }
};