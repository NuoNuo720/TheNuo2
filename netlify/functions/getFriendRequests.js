const dataStore = require('./dataStore');

exports.handler = async (event, context) => {
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
            body: JSON.stringify({ error: '只允许POST请求' })
        };
    }

    try {
        const requestBody = event.body ? JSON.parse(event.body) : {};
        const { userId } = requestBody;
        
        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少用户ID（userId）' })
            };
        }
        
        const requests = dataStore.getReceivedFriendRequests(userId);
        
        console.log(`查询好友请求 - 用户ID: ${userId}, 数量: ${requests.length}`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(requests)
        };
    } catch (error) {
        console.error('获取好友请求错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: '获取好友请求失败',
                details: error.message
            })
        };
    }
};