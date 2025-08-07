const dataStore = require('./dataStore');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: '只允许POST请求' })
    };
  }

  try {
    const { userId } = JSON.parse(event.body);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '缺少用户ID' })
      };
    }
    
    // 获取好友请求
    const requests = dataStore.getFriendRequests(userId);
    
    return {
      statusCode: 200,
      body: JSON.stringify(requests)
    };
  } catch (error) {
    console.error('获取好友请求错误:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '获取好友请求失败' })
    };
  }
};
