const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
app.use(express.json());

// MongoDB 连接配置（从Netlify环境变量获取，更安全）
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'userdb'; // 你的数据库名
const COLLECTION_TITLES = 'titles'; // 称号集合名
const COLLECTION_USERS = 'users'; // 用户集合名

// 管理员密钥（从环境变量获取，不在代码中明文存储）
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'default_admin_token'; // 建议在Netlify后台设置

// 连接MongoDB的工具函数
async function getDb() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client.db(DB_NAME);
}

// 1. 获取用户的所有称号（支持跨设备访问）
app.get('/titles/:userId', async (req, res) => {
  try {
    const db = await getDb();
    const titles = await db.collection(COLLECTION_TITLES)
      .find({ userId: req.params.userId })
      .toArray();
    res.json(titles);
  } catch (err) {
    console.error('获取称号失败:', err);
    res.status(500).json({ error: '获取称号失败' });
  }
});

// 2. 管理员给指定用户授予称号（核心跨设备功能）
app.post('/admin/grantTitle', async (req, res) => {
  try {
    const { adminToken, targetUserId, titleName, description, icon, isExclusive } = req.body;

    // 验证管理员权限
    if (adminToken !== ADMIN_TOKEN) {
      return res.status(403).json({ error: '无管理员权限' });
    }

    // 验证必要参数
    if (!targetUserId || !titleName) {
      return res.status(400).json({ error: '用户ID和称号名称为必填项' });
    }

    // 写入数据库（授予称号）
    const db = await getDb();
    const newTitle = {
      userId: targetUserId,
      titleName,
      description: description || '无描述',
      icon: icon || 'trophy',
      isExclusive: isExclusive || false,
      createdAt: new Date().toLocaleDateString()
    };

    await db.collection(COLLECTION_TITLES).insertOne(newTitle);
    res.json({ 
      success: true, 
      message: `已成功给用户 ${targetUserId} 授予称号: ${titleName}`,
      title: newTitle
    });
  } catch (err) {
    console.error('授予称号失败:', err);
    res.status(500).json({ error: '授予称号失败' });
  }
});

// 3. 验证码生成（大小号同步用）
let verifyCodes = {}; // 生产环境可改用数据库存储

app.post('/getVerifyCode', async (req, res) => {
  try {
    const { sourceUserId, targetUserId } = req.body;
    if (!sourceUserId || !targetUserId) {
      return res.status(400).json({ error: '请提供源用户和目标用户ID' });
    }

    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // 有效期5分钟
    verifyCodes[code] = {
      sourceUserId,
      targetUserId,
      expires: Date.now() + 300000
    };

    res.json({ code, message: '验证码已生成，5分钟内有效' });
  } catch (err) {
    console.error('生成验证码失败:', err);
    res.status(500).json({ error: '生成验证码失败' });
  }
});

// 4. 验证并同步称号（大小号同步）
app.post('/syncTitles', async (req, res) => {
  try {
    const { code } = req.body;
    const verifyInfo = verifyCodes[code];

    if (!verifyInfo || verifyInfo.expires < Date.now()) {
      return res.status(400).json({ error: '验证码无效或已过期' });
    }

    // 从源用户（大号）复制称号到目标用户（小号）
    const db = await getDb();
    const sourceTitles = await db.collection(COLLECTION_TITLES)
      .find({ userId: verifyInfo.sourceUserId })
      .toArray();

    // 给每个称号更换目标用户ID
    const targetTitles = sourceTitles.map(title => ({
      ...title,
      userId: verifyInfo.targetUserId,
      _id: undefined // 清除原有ID，让MongoDB自动生成新ID
    }));

    // 同步到目标用户
    if (targetTitles.length > 0) {
      await db.collection(COLLECTION_TITLES).insertMany(targetTitles);
    }

    // 同步后删除验证码（防止重复使用）
    delete verifyCodes[code];

    res.json({
      success: true,
      message: `成功同步 ${targetTitles.length} 个称号`,
      syncedCount: targetTitles.length
    });
  } catch (err) {
    console.error('同步称号失败:', err);
    res.status(500).json({ error: '同步称号失败' });
  }
});

// Netlify 函数入口
exports.handler = async (event, context) => {
  // 转换Netlify事件为Express可处理的请求
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const originalClose = server.close.bind(server);
      server.close = (...args) => {
        context.callbackWaitsForEmptyEventLoop = false;
        return originalClose(...args);
      };
      app.handle(event, {
        end: (body, statusCode) => {
          resolve({
            statusCode,
            body: typeof body === 'string' ? body : JSON.stringify(body)
          });
        }
      });
    });
  });
};