

// 等待Supabase加载完成
const SUPABASE_URL = 'https://abxpmdbxlhqnrazteutl.supabase.co'  // 替换为你的URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFieHBtZGJ4bGhxbnJhenRldXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTczMzMsImV4cCI6MjA4ODQ5MzMzM30.jHBxNfscuD1uJvQ4W-LkJ204PIOHMn2MhUA42bIIrRE'  // 替换为你的key

// 创建客户端
let supabase = null

// 初始化函数
function initSupabase() {
    if (typeof supabaseJs === 'undefined' && typeof window.supabase === 'undefined') {
        console.error('Supabase库未加载')
        return false
    }
    
    try {
        const { createClient } = window.supabase || supabaseJs
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        console.log('Supabase连接成功')
        return true
    } catch (error) {
        console.error('Supabase初始化失败:', error)
        return false
    }
}

// 等待库加载
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase)
} else {
    initSupabase()
}

// 玩家相关函数
export async function getOrCreatePlayer(username) {
    if (!supabase) {
        if (!initSupabase()) {
            throw new Error('Supabase未初始化')
        }
    }
    
    // 先查找是否存在
    const { data: existing, error: searchError } = await supabase
        .from('players')
        .select('*')
        .eq('username', username)
        .maybeSingle()
    
    if (searchError) throw searchError
    
    if (existing) {
        return existing
    }
    
    // 不存在则创建
    const { data, error } = await supabase
        .from('players')
        .insert({ username })
        .select()
        .single()
    
    if (error) throw error
    return data
}

// 获取排行榜
export async function getRanking() {
    if (!supabase) {
        if (!initSupabase()) {
            throw new Error('Supabase未初始化')
        }
    }
    
    const { data, error } = await supabase
        .from('ranking')
        .select('*')
        .limit(10)
    
    if (error) throw error
    return data || []
}

// 更新玩家积分
export async function updatePlayerStats(playerId, result) {
    if (!supabase) {
        if (!initSupabase()) {
            throw new Error('Supabase未初始化')
        }
    }
    
    const { data: player, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single()
    
    if (fetchError) throw fetchError
    
    let updates = {}
    if (result === 'win') {
        updates = {
            wins: (player.wins || 0) + 1,
            total_points: (player.total_points || 0) + 10
        }
    } else if (result === 'loss') {
        updates = {
            losses: (player.losses || 0) + 1,
            total_points: (player.total_points || 0) - 5
        }
    } else if (result === 'draw') {
        updates = {
            draws: (player.draws || 0) + 1,
            total_points: (player.total_points || 0) - 2
        }
    }
    
    const { error: updateError } = await supabase
        .from('players')
        .update(updates)
        .eq('id', playerId)
    
    if (updateError) throw updateError
}

// 保存游戏记录
export async function saveGameRecord(protonId, electronId, winnerId, duration) {
    if (!supabase) {
        if (!initSupabase()) {
            throw new Error('Supabase未初始化')
        }
    }
    
    const { error } = await supabase
        .from('game_records')
        .insert({
            proton_player: protonId,
            electron_player: electronId,
            winner: winnerId,
            duration: duration
        })
    
    if (error) throw error
}

// 从匹配队列中移除玩家
export async function removeFromQueue(playerId) {
    if (!supabase) {
        if (!initSupabase()) {
            throw new Error('Supabase未初始化')
        }
    }
    
    const { error } = await supabase
        .from('match_queue')
        .delete()
        .eq('player_id', playerId)
    
    if (error) throw error
}

// 检查队列中是否有等待的玩家
export async function getWaitingPlayers(excludePlayerId) {
    if (!supabase) {
        if (!initSupabase()) {
            throw new Error('Supabase未初始化')
        }
    }
    
    const { data, error } = await supabase
        .from('match_queue')
        .select('*')
        .eq('status', 'waiting')
        .neq('player_id', excludePlayerId)
        .limit(1)
    
    if (error) throw error
    return data || []
}