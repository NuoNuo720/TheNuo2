const dataStore = require('./dataStore');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: '只允许POST请求' })
    };
  }

  try {
    const { query, excludeUserId } = JSON.parse(event.body);
    
    if (!query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '缺少搜索关键词' })
      };
    }
    
    // 搜索用户
    const users = dataStore.searchUsers(query, excludeUserId);
    
    return {
      statusCode: 200,
      body: JSON.stringify(users)
    };
  } catch (error) {
    console.error('搜索用户错误:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '搜索用户失败' })
    };
  }
};
