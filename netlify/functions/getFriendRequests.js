const dataStore = require('./dataStore');

exports.handler = async (event, context) => {
    // 添加跨域支持（与其他接口保持一致）
    const headers = {
        'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // 处理预检请求
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
        // 容错处理：防止解析空请求体报错
        let requestBody = {};
        if (event.body) {
            requestBody = JSON.parse(event.body);
        }
        
        const { username } = requestBody;
        
        // 优化错误信息，保持与参数名一致
        if (!username) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少username参数' })
            };
        }

        // 验证用户名格式（可选，根据你的业务规则）
        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
        if (!usernameRegex.test(username)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '用户名格式无效' })
            };
        }
        
        // 获取好友列表                                                                                                      
        const friends = dataStore.getFriends(username);
        
        // 确保返回数组（即使没有好友也返回空数组，避免前端处理null/undefined）
        const result = Array.isArray(friends) ? friends : [];
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };
    } catch (error) {
        console.error('获取好友列表错误:', error);
        // 区分错误类型
        if (error.name === 'SyntaxError') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '请求体格式错误，应为JSON' })
            };
        }
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '获取好友列表失败' })
        };
    }
};