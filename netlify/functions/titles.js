// 完全独立的测试函数，不依赖任何外部库
exports.handler = async (event) => {
  // 固定返回两个测试称号
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // 允许跨域
      "Content-Type": "application/json"
    },
    body: JSON.stringify([
      {
        "id": "test1",
        "name": "测试称号1",
        "description": "这是模拟数据，用于测试接口",
        "icon": "trophy",
        "createdAt": "2025-08-11"
      },
      {
        "id": "test2",
        "name": "测试称号2",
        "description": "接口正常时会显示此称号",
        "icon": "award",
        "createdAt": "2025-08-11"
      }
    ])
  };
};