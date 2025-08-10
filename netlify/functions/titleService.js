// 称号服务 - 处理与后端的交互
class TitleService {
  // 获取当前用户的所有称号
  static async getUserTitles() {
    try {
      const response = await fetch('/api/titles', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('获取称号失败');
      }
      
      return await response.json();
    } catch (err) {
      console.error('获取称号时出错:', err);
      throw err;
    }
  }
  
  // 获取当前佩戴的称号
  static async getCurrentTitle() {
    try {
      const response = await fetch('/api/titles/current', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('获取当前称号失败');
      }
      
      return await response.json();
    } catch (err) {
      console.error('获取当前称号时出错:', err);
      throw err;
    }
  }
  
  // 添加新称号
  static async addTitle(titleData) {
    try {
      const response = await fetch('/api/titles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(titleData)
      });
      
      if (!response.ok) {
        throw new Error('添加称号失败');
      }
      
      return await response.json();
    } catch (err) {
      console.error('添加称号时出错:', err);
      throw err;
    }
  }
  
  // 切换称号佩戴状态
  static async toggleTitleEquip(titleId) {
    try {
      const response = await fetch(`/api/titles/equip/${titleId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('切换称号状态失败');
      }
      
      return await response.json();
    } catch (err) {
      console.error('切换称号状态时出错:', err);
      throw err;
    }
  }
}

// 在导航页显示当前称号
async function displayCurrentTitleInNav() {
  try {
    const title = await TitleService.getCurrentTitle();
    const titleContainer = document.getElementById('current-title-display');
    
    if (title && titleContainer) {
      titleContainer.innerHTML = `
        <div class="title-badge bg-accent text-white flex items-center">
          <i class="fa fa-${title.icon} mr-1"></i> ${title.name}
        </div>
      `;
    }
  } catch (err) {
    console.error('在导航页显示称号失败:', err);
  }
}