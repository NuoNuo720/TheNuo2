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

        // 检查是否已发送过请求（避免重复）
        const existingRequest = await db.collection('friendRequests').findOne({
            senderId,
            recipientId,
            status: { $in: ['pending', 'accepted'] }  // 待处理或已接受的请求视为重复
        });
        
        if (existingRequest) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: '已发送好友请求' }) 
            };
        }
        console.log('验证接收者存在性:', {
            recipientId: recipientId,
            queryCondition: { id: recipientId } // 打印查询条件
        });
        // 检查接收者是否存在
        const recipientExists = await db.collection('users').findOne(
            { _id: new ObjectId(recipientId) },
            { projection: { _id: 1 } }
        );
        console.log('接收者查询结果:', recipientExists);
        if (!recipientExists) {
            return { 
                statusCode: 404, 
                headers, 
                body: JSON.stringify({ 
                    error: '目标用户不存在',
                    debug: `recipientId=${recipientId}, exists=${!!recipientExists}`,
                    tip: '检查用户ID是否正确或是否存在于数据库'
                }) 
            };
        }
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
            senderId,
            recipientId,
            message: message || '请求添加为好友',  // 默认为空消息
            status: 'pending',                     // 初始状态：待处理
            sentAt: now,                           // 发送时间
            updatedAt: now                         // 更新时间（用于轮询）
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
            body: JSON.stringify({ error: '发送请求失败', details: error.message })
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
