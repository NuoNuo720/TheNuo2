const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // 新增JWT依赖
const { v4: uuidv4 } = require('uuid'); // 新增：引入UUID
exports.handler = async (event) => {
    // 设置响应头
    const allowedOrigins = ['https://thenuo2.netlify.app']; // 替换为你的Netlify域名
    const origin = event.headers.origin || '';
    const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowOrigin,  // 用前面计算的allowOrigin
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, User-Agent',
        'Access-Control-Allow-Credentials': 'true'  // 统一添加这个头
    };
    
    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Preflight OK' })
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

    let client;

    try {
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

        // 验证环境变量
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI环境变量未配置');
        }
        
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET环境变量未配置');
        }

        // 连接数据库
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db('userDB');
        const usersCollection = db.collection('users');

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
        const userId = uuidv4(); // 生成UUID作为用户唯一标识
        // 加密密码
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 使用JWT生成令牌（与登录逻辑一致）
        const token = jwt.sign(
            { username: username , userId: userId},
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 准备用户数据
        const newUser = {
            userId: userId, // 新增：用户唯一ID
            username,
            email,
            password: hashedPassword,
            token,
            createdAt: new Date(),
            lastLogin: null,
            status: 'active'
        };

        // 插入数据库
        const result = await usersCollection.insertOne(newUser);

        // 返回注册成功响应
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
                message: '注册成功',
                username: newUser.username,
                userId: userId, // 返回用户ID
                id: result.insertedId.toString(), // 返回用户ID
                token: newUser.token,
                
            })
        };
        
    } catch (error) {
        console.error('注册过程错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: '服务器内部错误',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    } finally {
        if (client) {
            try {
                await client.close();
            } catch (closeError) {
                console.error('关闭数据库连接错误:', closeError);
            }
        }
    }
};