// 这个版本只做基础连接和消息回显，排除复杂逻辑干扰
export default async (request) => {
  // 1. 只处理 WebSocket 升级请求
  if (request.headers.get("Upgrade") === "websocket") {
    try {
      // 2. 升级为 WebSocket 连接
      const { socket, response } = Deno.upgradeWebSocket(request);
      // 3. 从 URL 中获取用户名（用于标识用户）
      const url = new URL(request.url);
      const username = url.searchParams.get("username") || "unknown";

      // 4. 连接成功后的逻辑
      socket.onopen = () => {
        console.log(`用户 ${username} 已连接`);
        // 给前端发送“连接成功”的确认消息
        socket.send(JSON.stringify({
          type: "success",
          message: "WebSocket 连接成功！",
          username: username
        }));
      };

      // 5. 收到前端消息后的逻辑（简单回显，验证通信正常）
      socket.onmessage = (event) => {
        console.log(`收到 ${username} 的消息：${event.data}`);
        // 回传消息给前端（证明服务器能正常响应）
        socket.send(JSON.stringify({
          type: "echo",
          yourMessage: event.data,
          timestamp: new Date().toLocaleTimeString()
        }));
      };

      // 6. 连接关闭的逻辑
      socket.onclose = () => {
        console.log(`用户 ${username} 已断开连接`);
      };

      // 7. 错误处理
      socket.onerror = (error) => {
        console.error(`用户 ${username} 连接错误：`, error);
      };

      // 8. 返回 WebSocket 响应
      return response;
    } catch (error) {
      console.error("WebSocket 初始化失败：", error);
      return new Response("连接失败", { status: 500 });
    }
  }

  // 如果不是 WebSocket 请求，返回“需要WebSocket连接”的提示
  return new Response("请使用 WebSocket 连接", { status: 426 });
};