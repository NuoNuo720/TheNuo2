const express = require('express'); const serverless = require('serverless-http'); const titleRoutes = require('./titleRoutes'); const connectDB = require('./utils/db');
// 初始化 express 应用
const app = express ();

// 中间件
app.use (express.json ());

// 连接数据库
connectDB ();

// 路由
app.use ('/titles', titleRoutes); // 称号相关路由

// 404 处理
app.use ((req, res) => {
return res.status (404).json ({ error: 'Not Found' });
});

// 导出 serverless 函数
module.exports.handler = serverless (app);