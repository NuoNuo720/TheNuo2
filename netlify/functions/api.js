const express = require('express');
const app = express();
app.use(express.json());

// 直接处理 /api/titles 请求
app.get('/titles', async (req, res) => {
  try {
    // 返回模拟称号数据
    res.json([
      { id: "001", name: "测试称号", description: "示例数据" }
    ]);
  } catch (err) {
    res.status(500).json({ error: "获取称号失败" });
  }
});

// Netlify 函数入口
exports.handler = app;