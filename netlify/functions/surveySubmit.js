<const nodemailer = require('nodemailer');

// 邮件配置（使用环境变量存储敏感信息）
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,  // 在Netlify后台设置的环境变量
    pass: process.env.EMAIL_PASS   // 在Netlify后台设置的环境变量
  }
});

// Netlify函数入口
exports.handler = async (event, context) => {
  // 只允许POST请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: '只允许POST请求' })
    };
  }

  try {
    // 解析前端发送的数据
    const formData = JSON.parse(event.body);
    
    // 验证必要字段
    if (!formData.name || !formData.email || !formData.suggestions) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: '请填写必填字段' })
      };
    }

    // 构建邮件内容
    const mailOptions = {
      from: formData.email,
      to: process.env.YOUR_EMAIL,  // 接收反馈的邮箱（在Netlify设置）
      subject: `新的玩家反馈 - ${formData.name}`,
      text: `
        昵称: ${formData.name}
        邮箱: ${formData.email}
        游戏时长: ${formData.playTime || '未填写'}
        满意度: ${formData.satisfaction}
        喜欢的方面: ${formData.likes ? formData.likes.join(', ') : '未填写'}
        建议: ${formData.suggestions}
        希望联系: ${formData.contact || '未选择'}
      `
    };

    // 发送邮件
    await transporter.sendMail(mailOptions);

    // 返回成功响应
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: '反馈已收到，感谢您的建议！' })
    };
  } catch (error) {
    console.error('处理失败:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: '提交失败，请稍后再试' })
    };
  }
};