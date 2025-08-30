export default async (request) => {
  // 1. 处理浏览器预检请求（WebSocket 连接前必发的 OPTIONS 请求）
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*", // 允许所有域名（测试用，稳定后可改为你的域名）
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version",
        "Access-Control-Max-Age": "86400" // 预检结果缓存1天
      }
    });
  }

  // 2. 处理 WebSocket 升级请求
  if (request.headers.get("Upgrade") === "websocket") {
    try {
      // 关键：获取 WebSocket 握手必需的参数
      const secWebSocketKey = request.headers.get("Sec-WebSocket-Key");
      const secWebSocketVersion = request.headers.get("Sec-WebSocket-Version");

      // 验证 WebSocket 版本（必须是 13，否则不兼容）
      if (secWebSocketVersion !== "13") {
        return new Response("WebSocket 版本不支持（需版本13）", { status: 426 });
      }

      // 3. 升级为 WebSocket 连接
      const { socket, response } = Deno.upgradeWebSocket(request);
      const url = new URL(request.url);
      const username = url.searchParams.get("username") || "unknown";

      // 4. 给响应添加跨域头（之前可能漏了这步，导致浏览器拦截）
      response.headers.set("Access-Control-Allow-Origin", "*");

      // 5. 连接成功后的逻辑（简单明了，只做必要操作）
      socket.onopen = () => {
        console.log(`用户 ${username} 连接成功`);
        // 给前端发“连接成功”的确认消息（前端能收到就代表通了）
        socket.send(JSON.stringify({
          type: "conn_success",
          msg: "实时聊天已连接！",
          your_name: username
        }));
      };

      // 6. 收到前端消息后，直接回显（验证双向通信）
      socket.onmessage = (event) => {
        console.log(`收到 ${username} 的消息：${event.data}`);
        socket.send(JSON.stringify({
          type: "msg_echo",
          your_msg: event.data,
          time: new Date().toLocaleTimeString()
        }));
      };

      // 7. 错误和关闭处理
      socket.onerror = (err) => console.error(`用户 ${username} 连接错误：`, err);
      socket.onclose = () => console.log(`用户 ${username} 断开连接`);

      return response;
    } catch (err) {
      console.error("WebSocket 握手失败：", err);
      return new Response("握手失败", { status: 500 });
    }
  }

  // 非 WebSocket 请求的响应
  return new Response("请使用 WebSocket 连接", { status: 426 });
};