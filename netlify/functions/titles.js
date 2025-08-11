// netlify/functions/titles.js
exports.handler = async (event) => {
  // 强制返回有效的响应格式
  return {
    statusCode: 200, // 必须包含有效的状态码（200、400、500等）
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: "函数正常执行" })
  };
};