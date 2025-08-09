// dataStore.js
// 简易数据存储（实际项目中应使用真实数据库）
let users = [
  { id: '1', username: '张三', avatar: 'https://picsum.photos/seed/user1/200' },
  { id: '2', username: '李四', avatar: 'https://picsum.photos/seed/user2/200' },
  { id: '3', username: '王五', avatar: 'https://picsum.photos/seed/user3/200' },
  { id: '4', username: '赵六', avatar: 'https://picsum.photos/seed/user4/200' }
];

let friends = []; // 存储好友关系 { id: '1-2', userId: '1', friendId: '2', addedAt: '' }
let friendRequests = []; // 存储好友请求 { id: 'req1', senderId: '1', recipientId: '2', message: '', sentAt: '' }
let webSocketClients = {}; // 存储WebSocket连接 { userId: { connectionId, send } }

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

module.exports = {
  // 用户相关
  getUserById: (id) => users.find(user => user.id === id),
  searchUsers: (query, excludeUserId) => {
    return users
      .filter(user => user.id !== excludeUserId)
      .filter(user => user.username.toLowerCase().includes(query.toLowerCase()));
  },
  updateUserStatus: (userId, isOnline) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      user.isOnline = isOnline;
    }
  },
  
  // 好友相关
  getFriends: (userId) => {
    // 查找所有好友关系
    const userFriends = friends.filter(f => f.userId === userId);
    
    // 获取好友详细信息
    return userFriends.map(friendRel => {
      const friend = users.find(u => u.id === friendRel.friendId);
      return {
        ...friend,
        addedAt: friendRel.addedAt
      };
    });
  },
  
  isFriends: (userId1, userId2) => {
    return friends.some(f => 
      (f.userId === userId1 && f.friendId === userId2) || 
      (f.userId === userId2 && f.friendId === userId1)
    );
  },
  
  addFriend: (userId1, userId2) => {
    const id = `${userId1}-${userId2}`;
    
    // 添加双向好友关系
    friends.push({
      id,
      userId: userId1,
      friendId: userId2,
      addedAt: new Date().toISOString()
    });
    
    friends.push({
      id: `${userId2}-${userId1}`,
      userId: userId2,
      friendId: userId1,
      addedAt: new Date().toISOString()
    });
    
    return id;
  },
  
  deleteFriend: (userId, friendId) => {
    friends = friends.filter(f => 
      !(f.userId === userId && f.friendId === friendId) &&
      !(f.userId === friendId && f.friendId === userId)
    );
    return true;
  },
  
  // 好友请求相关
  createFriendRequest: (request) => {
    const newRequest = {
      id: generateId(),
      status: 'pending', // 状态字段，用于区分请求状态
      ...request,
      sentAt: new Date().toISOString() // 记录发送时间
    };
    friendRequests.push(newRequest);
    return newRequest;
  },
  
  // 用于接收方查询收到的请求
  getReceivedFriendRequests: (recipientId) => {
    return friendRequests
      .filter(req => req.recipientId === recipientId && req.status === 'pending')
      .map(req => {
        const sender = users.find(u => u.id === req.senderId);
        return {
          ...req,
          sender: sender ? {
            id: sender.id,
            username: sender.username,
            avatar: sender.avatar,
            isOnline: sender.isOnline
          } : null
        };
      });
  },
  
  // 保持兼容性，内部调用getReceivedFriendRequests
  getFriendRequests: (recipientId) => {
    return module.exports.getReceivedFriendRequests(recipientId);
  },
  
  // 获取发送方的待处理请求
  getPendingRequests: (senderId) => {
    return friendRequests
      .filter(req => req.senderId === senderId && req.status === 'pending')
      .map(req => {
        const recipient = users.find(u => u.id === req.recipientId);
        return {
          ...req,
          recipient: recipient ? {
            id: recipient.id,
            username: recipient.username,
            avatar: recipient.avatar,
            isOnline: recipient.isOnline
          } : null
        };
      });
  },
  
  // 检查是否有未处理的请求
  hasPendingRequest: (senderId, recipientId) => {
    return friendRequests.some(req => 
      req.status === 'pending' && (
        (req.senderId === senderId && req.recipientId === recipientId) ||
        (req.senderId === recipientId && req.recipientId === senderId)
      )
    );
  },
  
  // 处理好友请求（接受/拒绝）
  handleFriendRequest: (requestId, action, userId) => {
    const requestIndex = friendRequests.findIndex(req => req.id === requestId);
    
    if (requestIndex === -1) {
      return { success: false, error: '请求不存在' };
    }
    
    const request = friendRequests[requestIndex];
    
    // 验证请求接收者是否匹配
    if (request.recipientId !== userId) {
      return { success: false, error: '无权处理此请求' };
    }
    
    // 更新请求状态
    request.status = action === 'accept' ? 'accepted' : 'rejected';
    
    // 如果是接受请求，创建好友关系
    if (action === 'accept') {
      module.exports.addFriend(request.senderId, request.recipientId);
      
      // 返回好友信息
      const friend = users.find(u => u.id === request.senderId);
      return {
        success: true,
        action,
        friend
      };
    }
    
    return { success: true, action };
  },
  
  // 取消好友请求
  cancelFriendRequest: (requestId, userId) => {
    const requestIndex = friendRequests.findIndex(req => req.id === requestId);
    
    if (requestIndex === -1) {
      return false;
    }
    
    const request = friendRequests[requestIndex];
    
    // 验证请求发送者是否匹配
    if (request.senderId !== userId) {
      return false;
    }
    
    // 移除请求
    friendRequests.splice(requestIndex, 1);
    return true;
  },
  
  // WebSocket相关
  webSocketClients
};