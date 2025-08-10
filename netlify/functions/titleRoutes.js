// 称号相关API路由
const express = require('express');
const router = express.Router();
const Title = require('../models/Title');
const User = require('../models/User');
const auth = require('../middleware/auth'); // 认证中间件

// 获取当前用户的所有称号
router.get('/', auth, async (req, res) => {
  try {
    const titles = await Title.find({ userId: req.user.id });
    res.json(titles);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 获取当前佩戴的称号
router.get('/current', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.profile.currentTitleId) {
      return res.json(null);
    }
    
    const title = await Title.findById(user.profile.currentTitleId);
    res.json(title);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 添加新称号
router.post('/', auth, async (req, res) => {
  const { name, description, icon } = req.body;
  
  try {
    const newTitle = new Title({
      name,
      description,
      icon,
      userId: req.user.id,
      createdAt: new Date()
    });
    
    const title = await newTitle.save();
    
    // 如果是用户的第一个称号，自动设置为当前佩戴
    const userTitlesCount = await Title.countDocuments({ userId: req.user.id });
    if (userTitlesCount === 1) {
      await User.findByIdAndUpdate(req.user.id, {
        'profile.currentTitleId': title._id
      });
    }
    
    res.json(title);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 切换称号佩戴状态
router.put('/equip/:id', auth, async (req, res) => {
  try {
    // 验证称号是否属于当前用户
    const title = await Title.findOne({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!title) {
      return res.status(404).json({ msg: '称号不存在' });
    }
    
    // 更新用户当前佩戴的称号
    await User.findByIdAndUpdate(req.user.id, {
      'profile.currentTitleId': req.params.id
    });
    
    res.json({ msg: '称号佩戴状态已更新' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

module.exports = router;
