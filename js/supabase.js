// js/supabase.js
const SUPABASE_URL = 'https://abxpmdbxlhqnrazteutl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFieHBtZGJ4bGhxbnJhenRldXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTczMzMsImV4cCI6MjA4ODQ5MzMzM30.jHBxNfscuD1uJvQ4W-LkJ204PIOHMn2MhUA42bIIrRE'

const { createClient } = supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 玩家相关函数
export async function getOrCreatePlayer(username) {
    const { data, error } = await supabase
        .from('players')
        .upsert({ username }, { onConflict: 'username' })
        .select()
        .single()
    
    if (error) throw error
    return data
}

// 获取排行榜
export async function getRanking() {
    const { data, error } = await supabase
        .from('ranking')
        .select('*')
        .limit(10)
    
    if (error) throw error
    return data
}

// 更新玩家积分
export async function updatePlayerStats(playerId, result) {
    const { data: player, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single()
    
    if (fetchError) throw fetchError
    
    let updates = {}
    if (result === 'win') {
        updates = {
            wins: player.wins + 1,
            total_points: player.total_points + 10
        }
    } else if (result === 'loss') {
        updates = {
            losses: player.losses + 1,
            total_points: player.total_points - 5
        }
    } else if (result === 'draw') {
        updates = {
            draws: player.draws + 1,
            total_points: player.total_points - 2
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