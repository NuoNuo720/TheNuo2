// 金秋九月活动专用处理逻辑
const GOLDEN_AUTUMN_ACTIVITY_ID = "golden_autumn_2025";

// 初始化活动 - 在页面加载时调用
function initGoldenAutumnActivity() {
    // 检查活动是否在有效期内
    const now = new Date();
    const startDate = new Date("2025-09-01");
    const endDate = new Date("2025-09-30");
    
    // 如果活动已结束，显示结果
    if (now > endDate) {
        showActivityResults();
        return;
    }
    
    // 加载用户活动进度
    loadUserActivityProgress();
    
    // 绑定活动相关事件
    bindActivityEvents();
}

// 加载用户活动进度
function loadUserActivityProgress() {
    const userInfo = JSON.parse(localStorage.getItem('mainUserInfo') || '{}');
    const activityProgress = userInfo.goldenAutumnActivity || {
        joined: false,
        dailySigns: [],
        weeklyTasksCompleted: 0,
        invitedUsers: 0,
        rewardsClaimed: []
    };
    
    // 更新UI显示
    updateActivityUI(activityProgress);
}

// 更新活动UI显示
function updateActivityUI(progress) {
    const userInfo = JSON.parse(localStorage.getItem('mainUserInfo') || '{}');
    
    // 显示参与状态
    document.getElementById('activityJoinStatus').textContent = 
        progress.joined ? '已参与活动' : '未参与活动';
    
    // 显示签到进度
    document.getElementById('signInCount').textContent = 
        `${progress.dailySigns.length}天`;
    
    // 显示周任务完成情况
    document.getElementById('weeklyTasksCount').textContent = 
        `${progress.weeklyTasksCompleted}/3`;
    
    // 显示邀请人数
    document.getElementById('invitedCount').textContent = 
        `${progress.invitedUsers}人`;
    
    // 更新奖励领取按钮状态
    updateRewardButtons(progress);
}

// 更新奖励按钮状态
function updateRewardButtons(progress) {
    // 参与奖
    const participationBtn = document.getElementById('claimParticipation');
    if (progress.joined && !progress.rewardsClaimed.includes('participation')) {
        participationBtn.disabled = false;
    } else {
        participationBtn.disabled = true;
        if (progress.rewardsClaimed.includes('participation')) {
            participationBtn.textContent = '已领取';
        }
    }
    
    // 全任务奖
    const allTasksBtn = document.getElementById('claimAllTasks');
    if (progress.joined && progress.weeklyTasksCompleted >= 3 && 
        !progress.rewardsClaimed.includes('allTasks')) {
        allTasksBtn.disabled = false;
    } else {
        allTasksBtn.disabled = true;
        if (progress.rewardsClaimed.includes('allTasks')) {
            allTasksBtn.textContent = '已领取';
        }
    }
    
    // 邀请奖
    const inviteBtn = document.getElementById('claimInvite');
    if (progress.joined && progress.invitedUsers >= 3 && 
        !progress.rewardsClaimed.includes('invite')) {
        inviteBtn.disabled = false;
    } else {
        inviteBtn.disabled = true;
        if (progress.rewardsClaimed.includes('invite')) {
            inviteBtn.textContent = '已领取';
        }
    }
}

// 绑定活动相关事件
function bindActivityEvents() {
    // 参与活动按钮
    document.getElementById('joinGoldenAutumn').addEventListener('click', joinActivity);
    
    // 每日签到按钮
    document.getElementById('dailySignIn').addEventListener('click', dailySignIn);
    
    // 奖励领取按钮
    document.getElementById('claimParticipation').addEventListener('click', () => {
        claimReward('participation');
    });
    
    document.getElementById('claimAllTasks').addEventListener('click', () => {
        claimReward('allTasks');
    });
    
    document.getElementById('claimInvite').addEventListener('click', () => {
        claimReward('invite');
    });
    
    // 邀请好友按钮
    document.getElementById('inviteFriend').addEventListener('click', () => {
        // 模拟邀请好友
        const inviteCode = generateInviteCode();
        showNotification(`邀请码: ${inviteCode}，已复制到剪贴板`, 'info');
    });
}

// 参与活动
function joinActivity() {
    let userInfo = JSON.parse(localStorage.getItem('mainUserInfo') || '{}');
    
    if (!userInfo.username) {
        showNotification('请先登录', 'error');
        return;
    }
    
    // 初始化活动进度
    userInfo.goldenAutumnActivity = {
        joined: true,
        dailySigns: [],
        weeklyTasksCompleted: 0,
        invitedUsers: 0,
        rewardsClaimed: []
    };
    
    localStorage.setItem('mainUserInfo', JSON.stringify(userInfo));
    showNotification('成功参与金秋九月活动！', 'success');
    loadUserActivityProgress();
}

// 每日签到
function dailySignIn() {
    let userInfo = JSON.parse(localStorage.getItem('mainUserInfo') || '{}');
    
    if (!userInfo.username) {
        showNotification('请先登录', 'error');
        return;
    }
    
    if (!userInfo.goldenAutumnActivity || !userInfo.goldenAutumnActivity.joined) {
        showNotification('请先参与活动', 'error');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const activityProgress = userInfo.goldenAutumnActivity;
    
    // 检查今天是否已签到
    if (activityProgress.dailySigns.includes(today)) {
        showNotification('今天已经签到过了', 'info');
        return;
    }
    
    // 记录签到
    activityProgress.dailySigns.push(today);
    userInfo.goldenAutumnActivity = activityProgress;
    
    // 签到奖励
    userInfo.points = (userInfo.points || 0) + 50; // 每日签到50积分
    localStorage.setItem('mainUserInfo', JSON.stringify(userInfo));
    
    showNotification('签到成功，获得50积分！', 'success');
    loadUserActivityProgress();
    loadUserPoints(); // 更新用户积分显示
}

// 领取奖励
function claimReward(rewardType) {
    let userInfo = JSON.parse(localStorage.getItem('mainUserInfo') || '{}');
    const activityProgress = userInfo.goldenAutumnActivity;
    
    if (!activityProgress || !activityProgress.joined) {
        showNotification('请先参与活动', 'error');
        return;
    }
    
    if (activityProgress.rewardsClaimed.includes(rewardType)) {
        showNotification('该奖励已领取', 'info');
        return;
    }
    
    // 根据奖励类型发放奖励
    switch(rewardType) {
        case 'participation':
            // 参与奖：100积分 + 秋日徽章
            userInfo.points = (userInfo.points || 0) + 100;
            addUserBadge(userInfo, '秋日徽章');
            showNotification('领取参与奖成功：100积分 + 秋日徽章', 'success');
            break;
            
        case 'allTasks':
            // 全任务奖：500积分 + "秋收达人"称号
            userInfo.points = (userInfo.points || 0) + 500;
            userInfo.title = '秋收达人'; // 设置称号
            showNotification('领取全任务奖成功：500积分 + "秋收达人"称号', 'success');
            break;
            
        case 'invite':
            // 邀请奖：1000积分 + 限定头像框
            userInfo.points = (userInfo.points || 0) + 1000;
            userInfo.avatarFrame = 'autumn_frame'; // 设置限定头像框
            showNotification('领取邀请奖成功：1000积分 + 限定头像框', 'success');
            break;
    }
    
    // 记录奖励已领取
    activityProgress.rewardsClaimed.push(rewardType);
    userInfo.goldenAutumnActivity = activityProgress;
    
    localStorage.setItem('mainUserInfo', JSON.stringify(userInfo));
    loadUserPoints(); // 更新用户积分
    updateUserTitle(); // 更新用户称号
    updateActivityUI(activityProgress);
}

// 显示活动结果（活动结束后）
function showActivityResults() {
    // 隐藏参与按钮，显示结果区域
    document.getElementById('activityJoinSection').style.display = 'none';
    document.getElementById('activityResultsSection').style.display = 'block';
    
    // 模拟随机抽取幸运奖
    const luckyWinners = JSON.parse(localStorage.getItem('goldenAutumnLuckyWinners') || '[]');
    const userInfo = JSON.parse(localStorage.getItem('mainUserInfo') || '{}');
    
    // 检查当前用户是否是幸运获奖者
    const isWinner = userInfo.username && luckyWinners.includes(userInfo.username);
    
    if (isWinner) {
        document.getElementById('winnerNotice').textContent = 
            '恭喜您！您获得了秋季限定礼包一份！奖励已发放至您的账户。';
    } else {
        document.getElementById('winnerNotice').textContent = 
            '活动已结束，感谢您的参与！幸运奖已抽取，敬请关注后续活动。';
    }
}

// 辅助函数：添加用户徽章
function addUserBadge(userInfo, badgeName) {
    userInfo.badges = userInfo.badges || [];
    if (!userInfo.badges.includes(badgeName)) {
        userInfo.badges.push(badgeName);
    }
}

// 辅助函数：生成邀请码
function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'AUT';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// 监听周任务完成情况（在完成周任务时调用）
function trackWeeklyTaskCompletion() {
    const userInfo = JSON.parse(localStorage.getItem('mainUserInfo') || '{}');
    if (!userInfo.goldenAutumnActivity || !userInfo.goldenAutumnActivity.joined) {
        return;
    }
    
    // 增加周任务完成计数（最多3个）
    if (userInfo.goldenAutumnActivity.weeklyTasksCompleted < 3) {
        userInfo.goldenAutumnActivity.weeklyTasksCompleted++;
        localStorage.setItem('mainUserInfo', JSON.stringify(userInfo));
        loadUserActivityProgress();
    }
}

// 监听邀请用户情况（在新用户注册时调用）
function trackInvitedUser(inviteCode) {
    // 简单验证邀请码是否有效（以AUT开头）
    if (inviteCode && inviteCode.startsWith('AUT')) {
        // 在实际应用中，这里需要验证邀请码对应的用户
        // 这里简化处理，直接增加当前用户的邀请计数
        const userInfo = JSON.parse(localStorage.getItem('mainUserInfo') || '{}');
        if (userInfo.goldenAutumnActivity && userInfo.goldenAutumnActivity.joined) {
            userInfo.goldenAutumnActivity.invitedUsers++;
            localStorage.setItem('mainUserInfo', JSON.stringify(userInfo));
            loadUserActivityProgress();
        }
    }
}