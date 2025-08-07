const dataStore = require('./dataStore');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: '只允许POST请求' })
    };
  }

  try {
    const { requestId, userId } = JSON.parse(event.body);
    
    if (!requestId || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '缺少必要参数' })
      };
    }
    
    // 取消请求
    const success = dataStore.cancelFriendRequest(requestId, userId);
    
    if (!success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '取消请求失败' })
      };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('取消好友请求错误:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '取消好友请求失败' })
    };
  }
};
