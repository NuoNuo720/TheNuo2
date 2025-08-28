// dataStore.js
// 作为MongoDB的缓存层，同步数据库中的用户数据
let users = []; // 缓存用户数据（从数据库同步）
let friendRequests = []; // 缓存好友请求
let friends = []; // 缓存好友关系
let webSocketClients = {};

// 生成唯一ID（兼容MongoDB的ObjectId格式）
function generateId() {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).substr(2, 10);
  return `${timestamp}${random}`;
}

module.exports = {
  // 核心：从数据库同步用户到缓存（注册/登录时调用）
  syncUserFromDB: (dbUser) => {
    if (!dbUser || !dbUser._id) return;
    
    // 转换MongoDB文档格式（_id -> id，移除敏感字段）
    const user = {
      id: dbUser._id.toString(), // MongoDB的ObjectId转为字符串
      username: dbUser.username,
      email: dbUser.email,
      avatar: dbUser.avatar || `https://picsum.photos/seed/${dbUser._id}/200`,
      isOnline: false,
      createdAt: dbUser.createdAt
    };
    
    // 同步到缓存（更新或新增）
    const index = users.findIndex(u => u.id === user.id);
    if (index > -1) {
      users[index] = user; // 更新已有用户
    } else {
      users.push(user); // 新增用户
    }
    console.log(`已同步用户到缓存：${user.username}（ID: ${user.id}）`);
    return user;
  },

  // 从缓存获取用户（优先），不存在则返回基础信息
  getUserByUsername: (username) => {
    const user = users.find(u => u.username === username);
    if (user) return user;
    
    // 缓存未命中时的兜底（避免前端报错）
    console.warn(`缓存未找到用户：${username}，返回基础信息`);
    return {
      username,
      avatar: `https://picsum.photos/seed/${username}/200`,
      isOnline: false
    };
  },

  // 从缓存搜索用户（用于前端搜索功能）
  searchUsers: (query, excludeUsername) => {
    return users
      .filter(user => user.username !== excludeUsername)
      .filter(user => user.username.toLowerCase().includes(query.toLowerCase()));
  },

  // 更新用户在线状态
  updateUserStatus: (userId, isOnline) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      user.isOnline = isOnline;
    }
  },

  // 同步数据库中的好友关系到缓存
  syncFriendsFromDB: (userId, dbFriends) => {
    // dbFriends格式：[{ friendId: ObjectId, addedAt: Date }, ...]
    friends = friends.filter(f => f.userId !== userId); // 先清除旧数据
    
    dbFriends.forEach(friend => {
      const friendId = friend.friendId.toString();
      friends.push({
        id: `${userId}-${friendId}`,
        userId,
        friendId,
        addedAt: friend.addedAt.toISOString()
      });
    });
    console.log(`已同步用户${userId}的好友关系（${dbFriends.length}条）`);
  },

  // 获取缓存中的好友列表
  getFriends: (userId) => {
    return friends
      .filter(f => f.userId === userId)
      .map(friendRel => {
        const friend = module.exports.getUserById(friendRel.friendId);
        return {
          ...friend,
          addedAt: friendRel.addedAt
        };
      });
  },

  // 同步数据库中的好友请求到缓存
  syncFriendRequestsFromDB: (userId, dbRequests, isSender) => {
    // 清除该用户的旧请求
    friendRequests = friendRequests.filter(req => 
      !(isSender ? req.senderId === userId : req.recipientId === userId)
    );
    
    // 同步新请求（dbRequests为数据库查询结果）
    dbRequests.forEach(req => {
      const request = {
        id: req._id.toString(),
        senderId: req.senderId.toString(),
        recipientId: req.recipientId.toString(),
        message: req.message || '',
        status: req.status || 'pending',
        sentAt: req.sentAt.toISOString()
      };
      friendRequests.push(request);
    });
    
    console.log(`已同步用户${userId}的${isSender ? '发送' : '收到'}请求（${dbRequests.length}条）`);
  },

  // 获取收到的请求（从缓存）
  getReceivedFriendRequests: (recipientId) => {
    return friendRequests
      .filter(req => req.recipientId === recipientId && req.status === 'pending')
      .map(req => {
        const sender = module.exports.getUserById(req.senderId);
        return {
          ...req,
          sender: {
            id: sender.id,
            username: sender.username,
            avatar: sender.avatar,
            isOnline: sender.isOnline
          }
        };
      });
  },

  // 获取发送的请求（从缓存）
  getPendingRequests: (senderId) => {
    return friendRequests
      .filter(req => req.senderId === senderId && req.status === 'pending')
      .map(req => {
        const recipient = module.exports.getUserById(req.recipientId);
        return {
          ...req,
          recipient: {
            id: recipient.id,
            username: recipient.username,
            avatar: recipient.avatar,
            isOnline: recipient.isOnline
          }
        };
      });
  },

  // 检查是否有未处理的请求
  hasPendingRequest: (senderId, recipientId) => {
    return friendRequests.some(req => 
      req.status === 'pending' && 
      ((req.senderId === senderId && req.recipientId === recipientId) ||
       (req.senderId === recipientId && req.recipientId === senderId))
    );
  },

  // WebSocket连接管理
  webSocketClients
};