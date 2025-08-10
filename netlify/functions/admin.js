const express = require('express');
const serverless = require('serverless-http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const connectDB = require('./utils/db');
const User = require('./models/User');
const Title = require('./models/Title');
const { adminAuth } = require('./auth'); // 引入管理员验证中间件
const app = express();
app.use(express.json());

// 管理员登录
app.post('/login', async (req, res) => {
    try {
        await connectDB();
        
        const { username, password } = req.body;
        
        // 查找管理员用户（假设管理员账号在用户表中，且有isAdmin标记）
        const admin = await User.findOne({ username, isAdmin: true });
        if (!admin) {
            return res.status(401).json({ message: '管理员账号不存在' });
        }
        
        // 验证密码
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: '密码错误' });
        }
        
        // 生成JWT
        const token = jwt.sign(
            { adminId: admin._id, username: admin.username, isAdmin: true },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            id: admin._id,
            username: admin.username,
            token: token,
            isAdmin: true
        });
    } catch (error) {
        console.error('管理员登录错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 管理员认证中间件
const adminAuth = async (req, res, next) => {
    try {
        // 获取token
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: '未授权访问' });
        }
        
        // 验证token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: '没有管理员权限' });
        }
        
        req.admin = decoded;
        next();
    } catch (error) {
        console.error('管理员认证错误:', error);
        res.status(401).json({ message: '无效的token' });
    }
};

// 获取所有用户（管理员）
app.get('/users', adminAuth, async (req, res) => {
    try {
        await connectDB();
        
        // 查询所有用户，并获取他们的称号数量
        const users = await User.find().select('-password');
        
        // 处理用户数据，添加称号数量和当前称号信息
        const usersWithTitles = await Promise.all(users.map(async user => {
            // 查询用户的称号数量
            const titlesCount = await Title.countDocuments({ userId: user._id });
            
            // 查询当前佩戴的称号
            let currentTitle = null;
            if (user.profile?.currentTitleId) {
                currentTitle = await Title.findById(user.profile.currentTitleId);
                if (currentTitle) {
                    currentTitle = {
                        id: currentTitle._id,
                        name: currentTitle.name,
                        icon: currentTitle.icon
                    };
                }
            }
            
            return {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                titlesCount: titlesCount,
                currentTitle: currentTitle,
                createdAt: user.createdAt
            };
        }));
        
        res.json(usersWithTitles);
    } catch (error) {
        console.error('获取用户列表错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 获取所有称号（管理员）
app.get('/titles', adminAuth, async (req, res) => {
    try {
        await connectDB();
        
        // 查询所有称号
        const titles = await Title.find();
        
        // 为每个称号添加拥有用户数
        const titlesWithUserCount = await Promise.all(titles.map(async title => {
            const userCount = await Title.countDocuments({ _id: title._id });
            
            return {
                id: title._id,
                name: title.name,
                description: title.description,
                icon: title.icon,
                userCount: userCount,
                createdAt: title.createdAt
            };
        }));
        
        res.json(titlesWithUserCount);
    } catch (error) {
        console.error('获取称号列表错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 创建新称号（管理员）
app.post('/titles', adminAuth, async (req, res) => {
    try {
        await connectDB();
        
        const { name, description, icon } = req.body;
        
        if (!name || !description) {
            return res.status(400).json({ message: '请填写称号名称和描述' });
        }
        
        // 创建新称号（系统称号，没有关联用户）
        const newTitle = new Title({
            name,
            description,
            icon: icon || 'trophy',
            // 系统称号不设置userId，授予用户时会复制此称号给用户
            systemTitle: true
        });
        
        await newTitle.save();
        
        res.status(201).json({
            id: newTitle._id,
            name: newTitle.name,
            description: newTitle.description,
            icon: newTitle.icon,
            createdAt: newTitle.createdAt
        });
    } catch (error) {
        console.error('创建称号错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 授予称号给用户（管理员）
app.post('/users/:userId/titles', adminAuth, async (req, res) => {
    try {
        await connectDB();
        
        const { userId } = req.params;
        const { titleId, reason } = req.body;
        
        // 验证用户是否存在
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: '用户不存在' });
        }
        
        // 验证称号是否存在
        const systemTitle = await Title.findById(titleId);
        if (!systemTitle) {
            return res.status(404).json({ message: '称号不存在' });
        }
        
        // 检查用户是否已经拥有该称号
        const userAlreadyHasTitle = await Title.findOne({
            userId: userId,
            name: systemTitle.name,
            systemTitleId: systemTitle._id
        });
        
        if (userAlreadyHasTitle) {
            return res.status(400).json({ message: '该用户已经拥有此称号' });
        }
        
        // 为用户创建该称号的副本
        const userTitle = new Title({
            name: systemTitle.name,
            description: systemTitle.description,
            icon: systemTitle.icon,
            userId: userId,
            systemTitleId: systemTitle._id,
            grantedBy: req.admin.adminId,
            grantReason: reason || '管理员授予'
        });
        
        await userTitle.save();
        
        // 如果用户没有佩戴任何称号，自动佩戴这个新称号
        if (!user.profile?.currentTitleId) {
            user.profile = user.profile || {};
            user.profile.currentTitleId = userTitle._id;
            await user.save();
        }
        
        res.json({
            message: '称号授予成功',
            title: {
                id: userTitle._id,
                name: userTitle.name
            }
        });
    } catch (error) {
        console.error('授予称号错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 导出serverless函数
module.exports.handler = serverless(app);