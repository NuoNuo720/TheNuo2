exports.handler = async (event) => {
  // 获取请求头中的用户名
  const username = event.headers['x-username'];
  
  // 简单验证逻辑（实际项目中应连接数据库验证）
  if (username && username.length > 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({ valid: true })
    };
  }
  
  return {
    statusCode: 401,
    body: JSON.stringify({ valid: false, message: '无效的用户名' })
  };
};