export default async (request) => {
  // 只处理WebSocket连接
  if (request.headers.get("Upgrade") === "websocket") {
    try {
      const { socket, response } = Deno.upgradeWebSocket(request);
      const url = new URL(request.url);
      const username = url.searchParams.get('username');
      
      console.log(`用户${username}尝试连接`);
      
      // 连接成功后的处理
      socket.onopen = () => {
        console.log(`用户${username}已连接`);
        socket.send(JSON.stringify({type: "info", message: "连接成功！"}));
      };
      
      // 收到消息时的处理
      socket.onmessage = (event) => {
        console.log(`收到${username}的消息: ${event.data}`);
        // 简单回复收到了消息
        socket.send(JSON.stringify({type: "reply", message: "已收到你的消息"}));
      };
      
      // 连接关闭时的处理
      socket.onclose = () => {
        console.log(`用户${username}已断开连接`);
      };
      
      return response;
    } catch (error) {
      console.error("连接出错:", error);
      return new Response("连接失败", { status: 500 });
    }
  }
  
  // 如果不是WebSocket请求，返回错误
  return new Response("请使用WebSocket连接", { status: 426 });
};