exports.handler = async (event) => {
  // 获取请求头中的用户ID
  const userId = event.headers['x-user-id'];
  
  // 简单验证逻辑（实际项目中应连接数据库验证）
  if (userId && userId.length > 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({ valid: true })
    };
  }
  
  return {
    statusCode: 401,
    body: JSON.stringify({ valid: false, message: '无效的用户ID' })
  };
};