const dataStore = require('./dataStore');

exports.handler = async (event, context) => {
    // 设置CORS headers，允许跨域请求
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // 只允许POST方法
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '只允许POST请求' })
        };
    }

    try {
        // 解析请求体
        const requestBody = event.body ? JSON.parse(event.body) : {};
        // 支持两种参数名以提高兼容性（recipientId是更准确的命名）
        const userId = requestBody.recipientId || requestBody.userId;
        
        // 参数验证
        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少接收者ID（recipientId）' })
            };
        }
        
        // 从数据存储获取收到的好友请求
        const requests = dataStore.getReceivedFriendRequests(userId);
        
        // 日志记录
        console.log(`用户 ${userId} 获取好友请求，共 ${requests.length} 条`);
        
        // 成功响应
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(requests)
        };
    } catch (error) {
        // 错误处理
        console.error('获取好友请求时发生错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: '获取好友请求失败',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    }
};