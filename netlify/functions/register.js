// 移除所有可能引起问题的依赖
// 这个版本不连接数据库，不使用bcrypt，仅返回基础响应

exports.handler = async (event) => {
  // 强制设置响应头为JSON
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    // 只返回简单的成功响应，不执行任何其他操作
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: '函数执行成功',
        method: event.httpMethod,
        timestamp: new Date().toISOString()
      })
    };
  } catch (err) {
    // 最基础的错误处理
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '服务器错误',
        message: '发生未知错误'
      })
    };
  }
};