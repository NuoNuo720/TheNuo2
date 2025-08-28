// netlify/functions/cancelFriendRequest.js
/**
 * 功能：取消当前用户发送的待处理好友请求
 * 核心逻辑：
 * 1. 统一使用 username 作为用户标识（与其他接口对齐）
 * 2. 严格参数校验与格式验证（含 ObjectId 合法性检查）
 * 3. 处理请求不存在、已处理、异常数据等边界场景
 * 4. 安全的跨域配置与详细错误提示
 */

const { MongoClient, ObjectId } = require('mongodb');

exports.handler = async (event) => {
    // 1. 跨域配置：生产环境通过 CLIENT_ORIGIN 限制来源，避免任意域名访问
    const headers = {
        'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // 2. 处理浏览器预检请求（OPTIONS 方法，解决复杂请求跨域问题）
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // 3. 校验请求方法（仅支持 POST）
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers, 
            body: JSON.stringify({ error: '仅支持 POST 请求' }) 
        };
    }

    let mongoClient; // 数据库客户端实例，用于 finally 中确保关闭连接
    try {
        // 4. 解析请求体（容错处理：避免空 body 导致 JSON.parse 报错）
        let requestBody = {};
        if (event.body) {
            requestBody = JSON.parse(event.body);
        }
        const { requestId, senderUsername } = requestBody; // 统一用 senderUsername（与其他接口对齐）

        // 5. 基础参数校验（确保关键参数存在）
        if (!requestId || !senderUsername) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: '缺少 requestId 或 senderUsername 参数' }) 
            };
        }

        // 6. 用户名格式校验（与前端规则一致：3-20位字母/数字/下划线）
        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
        if (!usernameRegex.test(senderUsername)) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'senderUsername 格式无效（需3-20位字母/数字/下划线）' }) 
            };
        }

        // 7. 连接 MongoDB 数据库
        mongoClient = await MongoClient.connect(process.env.MONGODB_URI);
        const db = mongoClient.db('userDB');
        const requestsCollection = db.collection('friendRequests');

        // 8. 查询待取消的请求（处理 ObjectId 格式错误）
        let targetRequest;
        try {
            targetRequest = await requestsCollection.findOne({
                _id: new ObjectId(requestId), // 转换为 MongoDB  ObjectId 类型
                senderUsername: senderUsername, // 用 username 匹配（与集合字段对齐）
                status: 'pending' // 仅允许取消“待处理”状态的请求
            });
        } catch (idError) {
            // 捕获无效 ObjectId 错误（如 requestId 是随机字符串而非合法 ID）
            console.error('requestId 格式错误:', idError);
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'requestId 格式无效（需为 MongoDB ObjectId 格式）' }) 
            };
        }

        // 9. 处理“请求不存在或已处理”的场景
        if (!targetRequest) {
            return { 
                statusCode: 404, 
                headers, 
                body: JSON.stringify({ error: '好友请求不存在或已被处理（如已同意/取消）' }) 
            };
        }

        // 10. 处理异常数据（如接收者 username 缺失，直接删除无效请求）
        if (!targetRequest.recipientUsername || targetRequest.recipientUsername === 'undefined') {
            console.warn(`检测到异常请求（无接收者信息），直接删除：${requestId}`);
            await requestsCollection.deleteOne({ _id: new ObjectId(requestId) });
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ 
                    success: true, 
                    message: '异常请求已清除（无接收者信息）' 
                }) 
            };
        }

        // 11. 正常取消请求：更新状态为 cancelled 并记录时间
        await requestsCollection.updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { 
                status: 'cancelled', // 状态改为“已取消”
                updatedAt: new Date() // 更新最后操作时间
            }}
        );

        // 12. 返回成功结果
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ 
                success: true, 
                message: '好友请求已成功取消',
                requestId: requestId // 返回 requestId 便于前端同步状态
            }) 
        };

    } catch (error) {
        // 13. 捕获所有未处理异常（如数据库连接失败、查询超时等）
        console.error('取消好友请求失败:', error);
        // 开发环境返回详细错误，生产环境隐藏细节（避免泄露敏感信息）
        const errorDetails = process.env.NODE_ENV === 'development' ? error.message : '服务器内部处理细节';
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ 
                error: '服务器处理失败，请稍后重试', 
                details: errorDetails 
            }) 
        };
    } finally {
        // 14. 确保数据库连接无论成功/失败都关闭（避免连接泄露）
        if (mongoClient) {
            await mongoClient.close().catch(closeErr => 
                console.error('关闭 MongoDB 连接失败:', closeErr)
            );
        }
    }
};