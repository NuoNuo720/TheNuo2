const { MongoClient } = require('mongodb');

// MongoDB连接URL
const url = 'mongodb+srv://3668417644:nuonuo001@cluster0.u1nuqn9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'; // 请替换为你的实际连接地址

// 数据库名称
const dbName = 'Cluster0'; 

// 连接到MongoDB并创建所需集合
async function createCollections() {
    const client = new MongoClient(url);
    
    try {
        // 连接到MongoDB
        await client.connect();
        console.log('已成功连接到MongoDB服务器 (Cluster0)');
        
        // 获取数据库（Cluster0）
        const db = client.db(dbName);
        
        // 检查并使用已存在的users集合（位于userDB数据库中）
        const userDb = client.db('userDB'); // 切换到userDB数据库
        let usersCollection;
        
        try {
            // 检查users集合是否存在
            const collections = await userDb.listCollections({ name: 'users' }).toArray();
            if (collections.length > 0) {
                usersCollection = userDb.collection('users');
                console.log('已找到userDB中的users集合并使用它');
                
                // 确保users集合有username唯一索引
                await usersCollection.createIndex({ username: 1 }, { unique: true });
                console.log('users集合的唯一索引已确保');
            } else {
                // 如果不存在则创建（移除了default关键字）
                usersCollection = await userDb.createCollection('users', {
                    validator: {
                        $jsonSchema: {
                            bsonType: 'object',
                            required: ['username', 'password', 'loginTime'],
                            properties: {
                                username: { bsonType: 'string', description: '用户名，必须唯一' },
                                password: { bsonType: 'string', description: '密码，应加密存储' },
                                loginTime: { bsonType: 'date', description: '登录时间' },
                                avatar: { bsonType: 'string', description: '用户头像URL' },
                                token: { bsonType: 'string', description: '认证令牌' }
                            }
                        }
                    }
                });
                console.log('已在userDB中创建users集合');
            }
        } catch (err) {
            console.error('处理users集合时出错:', err);
            return;
        }
        
        // 在Cluster0数据库中创建其他所需集合
        // 创建friends集合
        await db.createCollection('friends', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['userId', 'friendId', 'status'],
                    properties: {
                        userId: { bsonType: 'string', description: '用户ID（关联users集合的username）' },
                        friendId: { bsonType: 'string', description: '好友ID（关联users集合的username）' },
                        status: { 
                            bsonType: 'string', 
                            enum: ['active', 'pending', 'blocked'], 
                            description: '好友关系状态' 
                        },
                        createdAt: { bsonType: 'date', description: '关系创建时间' }
                    }
                }
            }
        });
        console.log('Cluster0中的friends集合创建成功');
        
        // 创建friendRequests集合
        await db.createCollection('friendRequests', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['sender', 'recipient', 'status'],
                    properties: {
                        sender: { bsonType: 'string', description: '请求发送者用户名（关联users集合）' },
                        recipient: { bsonType: 'string', description: '请求接收者用户名（关联users集合）' },
                        message: { bsonType: 'string', description: '请求消息' },
                        status: { 
                            bsonType: 'string', 
                            enum: ['pending', 'accepted', 'rejected'], 
                            description: '请求状态' 
                        },
                        createdAt: { bsonType: 'date', description: '请求创建时间' }
                    }
                }
            }
        });
        console.log('Cluster0中的friendRequests集合创建成功');
        
        // 创建messages集合（移除了default关键字）
        await db.createCollection('messages', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['sender', 'recipient', 'content', 'timestamp'],
                    properties: {
                        sender: { bsonType: 'string', description: '发送者用户名（关联users集合）' },
                        recipient: { bsonType: 'string', description: '接收者用户名（关联users集合）' },
                        content: { bsonType: 'string', description: '消息内容' },
                        timestamp: { bsonType: 'date', description: '消息发送时间' },
                        read: { bsonType: 'bool', description: '消息是否已读' } // 移除了default属性
                    }
                }
            }
        });
        console.log('Cluster0中的messages集合创建成功');
        
        // 创建必要的索引以提高查询性能
        await db.collection('friends').createIndex({ userId: 1, friendId: 1 }, { unique: true });
        await db.collection('friendRequests').createIndex({ sender: 1, recipient: 1 }, { unique: true });
        await db.collection('messages').createIndex({ sender: 1, recipient: 1, timestamp: 1 });
        console.log('所有必要的索引创建成功');
        
    } catch (err) {
        console.error('创建集合时出错:', err);
    } finally {
        // 关闭连接
        await client.close();
        console.log('已关闭MongoDB连接');
    }
}

// 执行创建函数
createCollections();