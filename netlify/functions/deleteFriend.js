const dataStore = require('./dataStore');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: '只允许POST请求' })
    };
  }

  try {
    const { userId, friendId } = JSON.parse(event.body);
    
    if (!userId || !friendId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '缺少必要参数' })
      };
    }
    
    // 删除好友
    const success = dataStore.deleteFriend(userId, friendId);
    
    if (!success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '删除好友失败' })
      };
    }
    
    // 通知被删除的好友
    if (dataStore.webSocketClients[friendId]) {
      dataStore.webSocketClients[friendId].send(JSON.stringify({
        type: 'friend_deleted',
        user: {
          id: userId,
          username: dataStore.getUserById(userId)?.username || '未知用户'
        }
      }));
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('删除好友错误:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '删除好友失败' })
    };
  }
};
