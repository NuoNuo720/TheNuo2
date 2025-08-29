const User = require('./models/User');
const mongoose = require('mongoose');

class TitleService {
  /**
   * 获取用户所有称号
   * @param {string} username 用户名
   * @returns {Promise<Object>} 包含用户信息和称号的对象
   */
  async getUserTitles(username) {
    try {
      // 查找用户
      const user = await User.findByUsernameWithTitles(username);
      
      // 处理用户不存在的情况（不直接跳转登录，而是返回明确错误）
      if (!user) {
        return { 
          success: false, 
          error: '用户不存在', 
          code: 'USER_NOT_FOUND' 
        };
      }
      
      return {
        success: true,
        data: {
          username: user.username,
          titles: user.titles || [],
          currentTitle: user.titles.find(title => title.isEquipped) || null
        }
      };
    } catch (error) {
      console.error('获取用户称号失败:', error);
      return { 
        success: false, 
        error: '获取称号时发生错误', 
        code: 'SERVER_ERROR' 
      };
    }
  }
  
  /**
   * 佩戴/切换称号
   * @param {string} username 用户名
   * @param {string} titleId 称号ID
   * @returns {Promise<Object>} 操作结果
   */
  async equipTitle(username, titleId) {
    try {
      // 查找用户（不使用lean，因为需要更新）
      const user = await User.findOne({ username });
      
      if (!user) {
        return { 
          success: false, 
          error: '用户不存在', 
          code: 'USER_NOT_FOUND' 
        };
      }
      
      // 验证称号是否属于该用户
      const titleIndex = user.titles.findIndex(
        title => title._id.toString() === titleId
      );
      
      if (titleIndex === -1) {
        return { 
          success: false, 
          error: '该称号不属于此用户', 
          code: 'TITLE_NOT_OWNED' 
        };
      }
      
      // 先取消所有称号的佩戴状态
      user.titles.forEach(title => {
        title.isEquipped = false;
      });
      
      // 佩戴指定称号
      user.titles[titleIndex].isEquipped = true;
      
      await user.save();
      
      return {
        success: true,
        data: {
          equippedTitle: user.titles[titleIndex]
        }
      };
    } catch (error) {
      console.error('佩戴称号失败:', error);
      return { 
        success: false, 
        error: '佩戴称号时发生错误', 
        code: 'SERVER_ERROR' 
      };
    }
  }
  
  /**
   * 管理员授予用户称号
   * @param {string} adminUsername 管理员用户名
   * @param {string} targetUsername 目标用户用户名
   * @param {Object} titleData 称号数据
   * @returns {Promise<Object>} 操作结果
   */
  async grantTitleByAdmin(adminUsername, targetUsername, titleData) {
    try {
      // 验证管理员身份
      const admin = await User.findOne({ username: adminUsername });
      
      if (!admin) {
        return { 
          success: false, 
          error: '管理员不存在', 
          code: 'ADMIN_NOT_FOUND' 
        };
      }
      
      if (!admin.isAdmin) {
        return { 
          success: false, 
          error: '没有授予称号的权限', 
          code: 'NO_PERMISSION' 
        };
      }
      
      // 查找目标用户
      const targetUser = await User.findOne({ username: targetUsername });
      
      if (!targetUser) {
        return { 
          success: false, 
          error: '目标用户不存在', 
          code: 'TARGET_USER_NOT_FOUND' 
        };
      }
      
      // 创建新称号
      const newTitle = {
        name: titleData.name,
        description: titleData.description || '',
        icon: titleData.icon || '',
        isAdminGranted: true,
        isEquipped: false // 新授予的称号默认不佩戴
      };
      
      // 添加到用户的称号列表
      targetUser.titles.push(newTitle);
      await targetUser.save();
      
      return {
        success: true,
        data: {
          newTitle: newTitle
        }
      };
    } catch (error) {
      console.error('管理员授予称号失败:', error);
      return { 
        success: false, 
        error: '授予称号时发生错误', 
        code: 'SERVER_ERROR' 
      };
    }
  }
  
  /**
   * 用户创建自定义称号（如果系统允许）
   * @param {string} username 用户名
   * @param {Object} titleData 称号数据
   * @returns {Promise<Object>} 操作结果
   */
  async createUserTitle(username, titleData) {
    try {
      const user = await User.findOne({ username });
      
      if (!user) {
        return { 
          success: false, 
          error: '用户不存在', 
          code: 'USER_NOT_FOUND' 
        };
      }
      
      // 创建用户自定义称号
      const newTitle = {
        name: titleData.name,
        description: titleData.description || '',
        icon: titleData.icon || '',
        isAdminGranted: false,
        isEquipped: false
      };
      
      user.titles.push(newTitle);
      await user.save();
      
      return {
        success: true,
        data: {
          newTitle: newTitle
        }
      };
    } catch (error) {
      console.error('用户创建称号失败:', error);
      return { 
        success: false, 
        error: '创建称号时发生错误', 
        code: 'SERVER_ERROR' 
      };
    }
  }
}

module.exports = new TitleService();