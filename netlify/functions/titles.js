require('dotenv').config();
const mongoose = require('mongoose');

// 独立函数，不使用Express路由，避免中间件错误
exports.handler = async (event) => {
    // 设置跨域响应头
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
    };

    // 只处理GET请求
    if (event.httpMethod !== "GET") {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ message: "仅支持GET请求" })
        };
    }

    try {
        // 1. 连接数据库
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // 2. 查询test用户（根据你的数据库集合名调整，这里假设是'users'）
        const userCollection = mongoose.connection.collection('users');
        const testUser = await userCollection.findOne({ username: "test" });

        if (!testUser) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ message: "未找到test用户" })
            };
        }

        // 3. 返回用户的称号数组（如果为空则返回空数组）
        const userTitles = testUser.titles || [];
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(userTitles)
        };

    } catch (error) {
        // 捕获并返回错误信息
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                message: "获取称号失败",
                error: error.message // 便于调试的错误详情
            })
        };
    } finally {
        // 确保数据库连接关闭
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
};