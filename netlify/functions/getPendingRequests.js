// netlify/functions/getPendingRequests.js
/**
 * 功能：获取当前用户发送的待处理好友请求
 * 核心逻辑：
 * 1. 处理跨域与预检请求
 * 2. 验证请求参数与用户身份（JWT）
 * 3. 查询数据库中当前用户发送的待处理请求
 * 4. 补充接收者用户信息（用户名、头像）
 * 5. 统一返回格式并关闭数据库连接
 */

const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken'); // 需先安装：npm install jsonwebtoken

// 导出Netlify云函数处理逻辑
exports.handler = async (event) => {
    // 1. 跨域配置（生产环境建议通过CLIENT_ORIGIN环境变量限制来源）
    const headers = {
        'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // 2. 处理浏览器预检请求（OPTIONS方法）
    if (event.httpMethod === 'OPTIONS') {
        return { 
            statusCode: 200, 
            headers, 
            body: '' 
        };
    }

    // 3. 校验请求方法（仅支持POST）
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '只支持 POST 请求' })
        };
    }

    let mongoClient; // 数据库客户端实例，用于finally中关闭连接
    try {
        // 4. 解析请求体（容错处理：避免空body导致JSON.parse报错）
        let requestBody = {};
        if (event.body) {
            requestBody = JSON.parse(event.body);
        }
        const { senderUsername } = requestBody;

        // 5. 基础参数校验
        if (!senderUsername) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少 senderUsername 参数' })
            };
        }
        // 验证用户名格式（3-20位字母/数字/下划线，与前端保持一致）
        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
        if (!usernameRegex.test(senderUsername)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'senderUsername 格式无效（需3-20位字母/数字/下划线）' })
            };
        }

        // 6. 身份验证（JWT）：确保请求者是 senderUsername 本人，防止越权
        const authToken = event.headers.authorization?.split(' ')[1];
        if (!authToken) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: '未提供身份令牌（Authorization头缺失）' })
            };
        }
        // 验证token有效性与一致性
        let decodedToken;
        try {
            decodedToken = jwt.verify(authToken, process.env.JWT_SECRET);
        } catch (tokenError) {
            // 区分token错误类型（无效/过期）
            if (tokenError.name === 'TokenExpiredError') {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: '身份令牌已过期，请重新登录' })
                };
            }
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: '无效的身份令牌' })
            };
        }
        // 校验token中的用户名与请求参数一致
        if (decodedToken.username !== senderUsername) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: '身份验证失败，无权查询该用户的待处理请求' })
            };
        }

        // 7. 连接MongoDB并查询待处理请求
        mongoClient = await MongoClient.connect(process.env.MONGODB_URI);
        const db = mongoClient.db('userDB'); // 数据库名称：userDB
        const friendRequestsCol = db.collection('friendRequests'); // 好友请求集合
        const usersCol = db.collection('users'); // 用户信息集合

        // 核心查询：当前用户发送的、状态为pending的请求（按发送时间倒序）
        const pendingRequests = await friendRequestsCol
            .find({
                senderUsername: senderUsername,
                status: 'pending'
            })
            .sort({ sentAt: -1 })
            .toArray();

        // 8. 补充接收者信息（用户名、头像），统一返回格式
        const requestsWithRecipient = await Promise.all(
            pendingRequests.map(async (request) => {
                // 查询接收者用户信息（只返回必要字段，减少数据传输）
                const recipientUser = await usersCol.findOne(
                    { username: request.recipientUsername }, // 关键：用username匹配用户
                    {
                        projection: {
                            _id: 0, // 不返回ObjectId（前端无需使用）
                            username: 1,
                            avatar: 1
                        }
                    }
                );

                // 格式化返回数据（处理接收者不存在的边界情况）
                return {
                    ...request,
                    recipient: recipientUser || {
                        username: request.recipientUsername || '未知用户',
                        avatar: 'https://picsum.photos/seed/unknown-user/200' // 默认头像
                    },
                    sentAt: request.sentAt.toISOString(), // 日期转为字符串，避免前端解析问题
                    updatedAt: request.updatedAt.toISOString()
                };
            })
        );

        // 9. 返回成功结果
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(requestsWithRecipient)
        };

    } catch (error) {
        // 10. 错误处理（区分不同错误类型）
        console.error('获取待处理请求失败:', error);
        // JSON解析错误（请求体格式错误）
        if (error.name === 'SyntaxError') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '请求体格式错误，需为合法JSON' })
            };
        }
        // 其他服务器错误（数据库连接失败、查询错误等）
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '获取待处理请求失败，请稍后重试' })
        };
    } finally {
        // 11. 确保数据库连接无论成功/失败都关闭
        if (mongoClient) {
            await mongoClient.close().catch(closeErr => 
                console.error('关闭MongoDB连接失败:', closeErr)
            );
        }
    }
};