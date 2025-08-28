// netlify/functions/deleteFriend.js
/**
 * 功能：删除好友关系（基于 username 标识，与整体接口体系对齐）
 * 核心优化：
 * 1. 统一使用 username 替代 userId/friendId，避免标识冲突
 * 2. 补充跨域配置，支持前端跨域调用
 * 3. 增强 WebSocket 发送容错，避免连接异常导致的 500 错误
 * 4. 细化错误提示，便于前后端排查问题
 */

const dataStore = require('./dataStore');

exports.handler = async (event, context) => {
    // 1. 跨域配置（生产环境通过 CLIENT_ORIGIN 限制来源，提升安全性）
    const headers = {
        'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // 2. 处理浏览器预检请求（解决复杂请求跨域问题）
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // 3. 校验请求方法（仅支持 POST）
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '只允许 POST 请求' })
        };
    }

    try {
        // 4. 解析请求体（容错处理：避免空 body 导致 JSON.parse 报错）
        let requestBody = {};
        if (event.body) {
            requestBody = JSON.parse(event.body);
        }
        // 关键：统一使用 username 标识（与 addFriend、getPendingRequests 等接口对齐）
        const { currentUsername, friendUsername } = requestBody;

        // 5. 细化参数校验（明确指出缺失的参数）
        if (!currentUsername) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少 currentUsername 参数（当前用户用户名）' })
            };
        }
        if (!friendUsername) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少 friendUsername 参数（待删除好友用户名）' })
            };
        }
        // 禁止删除自己（边界场景处理）
        if (currentUsername === friendUsername) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '不能删除自己' })
            };
        }

        // 6. 调用 dataStore 删除好友（假设 dataStore 已适配 username 入参）
        // 注：需确保 dataStore.deleteFriend 方法的入参已改为 (currentUsername, friendUsername)
        const deleteResult = dataStore.deleteFriend(currentUsername, friendUsername);
        if (!deleteResult.success) {
            // 细化删除失败原因（从 dataStore 返回中获取具体信息）
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: '删除好友失败', 
                    reason: deleteResult.reason || '好友关系不存在或已删除' 
                })
            };
        }

        // 7. WebSocket 通知被删除好友（增强容错：避免连接异常导致接口崩溃）
        if (dataStore.webSocketClients && dataStore.webSocketClients[friendUsername]) {
            const friendClient = dataStore.webSocketClients[friendUsername];
            try {
                // 校验客户端连接状态（READY_STATE=1 表示连接正常）
                if (friendClient.readyState === 1) {
                    // 获取当前用户信息（补充容错，避免 getUserByUsername 返回 undefined）
                    const currentUser = dataStore.getUserByUsername(currentUsername) || {
                        username: currentUsername,
                        id: 'unknown' // 若 dataStore 需 id，可补充默认值
                    };
                    friendClient.send(JSON.stringify({
                        type: 'friend_deleted',
                        user: {
                            username: currentUser.username,
                            id: currentUser.id || 'unknown'
                        },
                        timestamp: new Date().toISOString()
                    }));
                    console.log(`已通知用户 ${friendUsername}：${currentUsername} 已删除你为好友`);
                } else {
                    console.warn(`用户 ${friendUsername} 的 WebSocket 连接已断开，跳过通知`);
                }
            } catch (wsError) {
                // 捕获 WebSocket 发送异常，不影响删除好友的主流程
                console.error(`通知用户 ${friendUsername} 失败：`, wsError);
            }
        } else {
            console.log(`用户 ${friendUsername} 未在线或无 WebSocket 连接，跳过通知`);
        }

        // 8. 返回成功结果（携带用户名，便于前端同步界面）
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `已成功删除好友 ${friendUsername}`,
                currentUsername: currentUsername,
                deletedFriendUsername: friendUsername
            })
        };

    } catch (error) {
        // 9. 捕获所有未处理异常（区分错误类型，返回精准提示）
        console.error('删除好友接口异常：', error);
        // JSON 解析错误（请求体格式错误）
        if (error.name === 'SyntaxError') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '请求体格式错误，需为合法 JSON' })
            };
        }
        // 其他服务器异常（如 dataStore 调用失败）
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: '服务器处理失败，请稍后重试',
                // 开发环境返回详细错误，生产环境隐藏细节
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    }
};