exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  // 模拟返回两个称号
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify([
      { id: "001", name: "测试称号1", description: "模拟数据", icon: "star" },
      { id: "002", name: "测试称号2", description: "模拟数据", icon: "users" }
    ])
  };
};