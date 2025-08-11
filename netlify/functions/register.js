const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

exports.handler = async (event) => {
    // 设置响应头，支持跨域和JSON格式
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }

    // 只允许POST请求
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '只支持POST请求' })
        };
    }

    let client; // 数据库客户端连接

    try {
        // 解析请求数据
        if (!event.body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '请求数据不能为空' })
            };
        }

        let requestData;
        try {
            requestData = JSON.parse(event.body);
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '无效的数据格式，请使用JSON' })
            };
        }

        const { username, email, password } = requestData;

        // 验证输入数据
        if (!username || !email || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '用户名、邮箱和密码不能为空' })
            };
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '请输入有效的邮箱地址' })
            };
        }

        // 验证密码长度
        if (password.length < 6) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '密码长度不能少于6个字符' })
            };
        }

        // 检查数据库连接字符串是否配置
        if (!process.env.MONGODB_URI) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: '服务器配置错误，缺少数据库连接信息' })
            };
        }

        // 连接数据库
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db('userDB'); // 数据库名称
        const usersCollection = db.collection('users'); // 集合名称

        // 检查用户名是否已存在
        const existingUser = await usersCollection.findOne({ username });
        if (existingUser) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '用户名已存在' })
            };
        }

        // 检查邮箱是否已被注册
        const existingEmail = await usersCollection.findOne({ email });
        if (existingEmail) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '邮箱已被注册' })
            };
        }

        // 加密密码（使用bcrypt，安全存储）
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 生成用户唯一标识token
        const token = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 准备要存储的用户数据
        const newUser = {
            username,
            email,
            password: hashedPassword, // 存储加密后的密码，而非明文
            token,
            createdAt: new Date(),
            lastLogin: null,
            status: 'active'
        };

        // 将用户数据插入数据库
        await usersCollection.insertOne(newUser);

        // 返回注册成功响应
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
                message: '注册成功',
                username: newUser.username,
                token: newUser.token
            })
        };

    } catch (error) {
        console.error('注册过程错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: '服务器内部错误',
                // 开发环境显示详细错误，生产环境移除
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    } finally {
        // 确保数据库连接关闭
        if (client) {
            try {
                await client.close();
            } catch (closeError) {
                console.error('关闭数据库连接错误:', closeError);
            }
        }
    }
};