const express = require('express');
const router = express.Router();
const titleService = require('../services/titleService');
const authMiddleware = require('../middleware/auth');

// 获取当前用户的所有称号
router.get('/', authMiddleware.authenticate, async (req, res) => {
  const result = await titleService.getUserTitles(req.user.username);
  
  if (result.success) {
    return res.status(200).json(result.data);
  }
  
  // 根据错误类型返回不同状态码，而不是直接跳转登录
  switch (result.code) {
    case 'USER_NOT_FOUND':
      return res.status(404).json({ error: result.error });
    default:
      return res.status(500).json({ error: result.error });
  }
});

// 获取当前佩戴的称号
router.get('/current', authMiddleware.authenticate, async (req, res) => {
  const result = await titleService.getUserTitles(req.user.username);
  
  if (result.success) {
    return res.status(200).json({
      currentTitle: result.data.currentTitle
    });
  }
  
  switch (result.code) {
    case 'USER_NOT_FOUND':
      return res.status(404).json({ error: result.error });
    default:
      return res.status(500).json({ error: result.error });
  }
});

// 佩戴称号
router.put('/equip/:titleId', authMiddleware.authenticate, async (req, res) => {
  const result = await titleService.equipTitle(
    req.user.username,
    req.params.titleId
  );
  
  if (result.success) {
    return res.status(200).json(result.data);
  }
  
  switch (result.code) {
    case 'USER_NOT_FOUND':
      return res.status(404).json({ error: result.error });
    case 'TITLE_NOT_OWNED':
      return res.status(403).json({ error: result.error });
    default:
      return res.status(500).json({ error: result.error });
  }
});

// 管理员授予称号
router.post('/grant', authMiddleware.authenticate, async (req, res) => {
  // 验证请求参数
  if (!req.body.targetUsername || !req.body.titleName) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  const result = await titleService.grantTitleByAdmin(
    req.user.username,
    req.body.targetUsername,
    {
      name: req.body.titleName,
      description: req.body.description,
      icon: req.body.icon
    }
  );
  
  if (result.success) {
    return res.status(201).json(result.data);
  }
  
  switch (result.code) {
    case 'ADMIN_NOT_FOUND':
    case 'TARGET_USER_NOT_FOUND':
      return res.status(404).json({ error: result.error });
    case 'NO_PERMISSION':
      return res.status(403).json({ error: result.error });
    default:
      return res.status(500).json({ error: result.error });
  }
});

// 用户创建自定义称号
router.post('/create', authMiddleware.authenticate, async (req, res) => {
  if (!req.body.titleName) {
    return res.status(400).json({ error: '称号名称不能为空' });
  }
  
  const result = await titleService.createUserTitle(
    req.user.username,
    {
      name: req.body.titleName,
      description: req.body.description,
      icon: req.body.icon
    }
  );
  
  if (result.success) {
    return res.status(201).json(result.data);
  }
  
  switch (result.code) {
    case 'USER_NOT_FOUND':
      return res.status(404).json({ error: result.error });
    default:
      return res.status(500).json({ error: result.error });
  }
});

module.exports = router;