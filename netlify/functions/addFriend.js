const { MongoClient, ObjectId } = require('mongodb'); // 合并导入语句
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

    let client;
    try {
        client = await MongoClient.connect(process.env.MONGODB_URI);
        const db = client.db('userDB');
        const requestBody = JSON.parse(event.body);
        const { senderId, recipientId, message } = requestBody;

        // 验证必要参数
        if (!senderId || !recipientId) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'senderId和recipientId为必填项' }) 
            };
        }

        // 验证ID格式是否正确
        if (!ObjectId.isValid(senderId) || !ObjectId.isValid(recipientId)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '用户ID格式不正确' })
            };
        }

        // 转换为ObjectId对象
        const senderObjectId = new ObjectId(senderId);
        const recipientObjectId = new ObjectId(recipientId);

        // 检查是否已发送过请求（避免重复）
        const existingRequest = await db.collection('friendRequests').findOne({
            senderId: senderObjectId,  // 使用ObjectId查询
            recipientId: recipientObjectId,  // 使用ObjectId查询
            status: { $in: ['pending', 'accepted'] }
        });
        
        if (existingRequest) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: '已发送好友请求' }) 
            };
        }

        // 检查接收者是否存在（使用正确的_id字段查询）
        const recipientExists = await db.collection('users').findOne(
            { _id: recipientObjectId },
            { projection: { _id: 1 } }
        );
        
        if (!recipientExists) {
            return { 
                statusCode: 404, 
                headers, 
                body: JSON.stringify({ error: '目标用户不存在' }) 
            };
        }

        // 保存新请求到数据库
        const now = new Date();
        const result = await db.collection('friendRequests').insertOne({
            senderId: senderObjectId,  // 存储为ObjectId
            recipientId: recipientObjectId,  // 存储为ObjectId
            message: message || '请求添加为好友',
            status: 'pending',
            sentAt: now,
            updatedAt: now
        });

        console.log('好友请求已保存:', { 
            requestId: result.insertedId, 
            senderId, 
            recipientId 
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                message: '好友请求已发送',
                requestId: result.insertedId.toString()
            })
        };
    } catch (error) {
        console.error('发送好友请求失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: '发送请求失败', 
                details: error.message,
                // 只在开发环境显示详细错误信息
                debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    } finally {
        if (client) {
            try {
                await client.close();
            } catch (closeError) {
                console.error('关闭数据库连接失败:', closeError);
            }
        }
    }
};
