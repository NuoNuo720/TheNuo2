// titleRoutes.js（补充完整接口）
const express = require('express');
const serverless = require('serverless-http');
const { auth } = require('./auth');
const titleService = require('./titleService');

const app = express();
app.use(express.json());

// 1. 获取用户的所有称号（对应 TitleService.getUserTitles()）
app.get('/', auth, async (req, res) => {
  try {
    const titles = await titleService.getUserTitles(req.user.userId);
    res.json(titles);
  } catch (err) {
    res.status(500).json({ message: err.message || '获取称号失败' });
  }
});

// 2. 获取当前佩戴的称号（对应 TitleService.getCurrentTitle()）
app.get('/current', auth, async (req, res) => {
  try {
    const currentTitle = await titleService.getCurrentTitle(req.user.userId);
    res.json(currentTitle);
  } catch (err) {
    res.status(500).json({ message: err.message || '获取当前称号失败' });
  }
});

// 3. 添加新称号（对应 TitleService.addTitle()）
app.post('/', auth, async (req, res) => {
  try {
    const newTitle = await titleService.createUserTitle({
      ...req.body,
      userId: req.user.userId
    });
    res.status(201).json(newTitle);
  } catch (err) {
    res.status(400).json({ message: err.message || '添加称号失败' });
  }
});

// 4. 切换称号佩戴状态（对应 TitleService.toggleTitleEquip()）
app.put('/equip/:titleId', auth, async (req, res) => {
  try {
    const result = await titleService.equipTitle(req.user.userId, req.params.titleId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message || '切换称号状态失败' });
  }
});

module.exports.handler = serverless(app);