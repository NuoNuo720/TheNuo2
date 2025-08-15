// 引入数据库依赖（以MongoDB为例）
const { MongoClient } = require('mongodb');

// 数据库连接字符串（替换为你的MongoDB连接地址）
const MONGODB_URI = process.env.MONGODB_URI;

// 云函数主逻辑
exports.handler = async (event) => {
    // 只允许POST请求
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: '只支持POST请求' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        // 解析前端发送的分数数据
        const scoreData = JSON.parse(event.body);
        // 验证数据格式（确保包含必要字段）
        if (!scoreData.username || !scoreData.score) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: '缺少用户名或分数' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        // 连接数据库
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db('userDB'); // 数据库名
        const scoresCollection = db.collection('scores'); // 集合名

        // 保存分数到数据库
        await scoresCollection.insertOne({
            username: scoreData.username,
            score: scoreData.score,
            date: new Date(scoreData.date), // 转换为日期对象
            createdAt: new Date() // 记录提交时间
        });

        // 关闭数据库连接
        await client.close();

        // 返回成功响应
        return {
            statusCode: 200,
            body: JSON.stringify({ message: '分数保存成功' }),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error) {
        // 处理错误
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '服务器错误：' + error.message }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};
    