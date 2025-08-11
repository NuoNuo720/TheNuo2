// 纯原生JavaScript实现，无任何外部依赖
exports.handler = (event, context, callback) => {
  // 1. 强制设置响应结构（Netlify要求的最低结构）
  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      success: true,
      message: "称号接口正常响应",
      data: []
    })
  };

  // 2. 无论任何情况，都通过callback返回响应
  try {
    // 这里可以逐步添加逻辑，但目前保持空
    callback(null, response);
  } catch (err) {
    // 即使发生错误，也返回修改后的响应
    response.statusCode = 500;
    response.body = JSON.stringify({
      success: false,
      message: "接口执行出错",
      error: err.toString()
    });
    callback(null, response);
  }
};
