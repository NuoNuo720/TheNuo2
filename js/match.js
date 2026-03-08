// js/match.js
import { supabase } from './supabase.js'

export class MatchSystem {
    constructor(playerId, onMatched) {
        this.playerId = playerId
        this.onMatched = onMatched
        this.subscription = null
        this.checkInterval = null
    }

    async joinQueue() {
        // 清理旧记录
        await supabase
            .from('match_queue')
            .delete()
            .eq('player_id', this.playerId)

        // 加入队列
        await supabase
            .from('match_queue')
            .insert({ player_id: this.playerId, status: 'waiting' })

        // 监听匹配
        this.subscription = supabase
            .channel('match_queue_changes')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'match_queue' },
                () => this.checkForMatch()
            )
            .subscribe()

        // 立即检查一次
        await this.checkForMatch()
        
        // 每3秒检查一次
        this.checkInterval = setInterval(() => this.checkForMatch(), 3000)
    }

    async checkForMatch() {
        const { data: waiting, error } = await supabase
            .from('match_queue')
            .select('*')
            .eq('status', 'waiting')
            .neq('player_id', this.playerId)
            .limit(1)

        if (error) {
            console.error('检查匹配失败:', error)
            return
        }

        if (waiting && waiting.length > 0) {
            await this.createMatch(waiting[0].player_id)
        }
    }

    async createMatch(opponentId) {
        // 随机分配角色
        const isProton = Math.random() < 0.5
        const match = {
            protonId: isProton ? this.playerId : opponentId,
            electronId: isProton ? opponentId : this.playerId,
            confirmed: {}
        }

        // 标记为已匹配
        await supabase
            .from('match_queue')
            .update({ status: 'matched' })
            .eq('player_id', this.playerId)
        
        await supabase
            .from('match_queue')
            .update({ status: 'matched' })
            .eq('player_id', opponentId)

        this.leaveQueue()
        this.onMatched(match)
    }

    leaveQueue() {
        if (this.subscription) {
            this.subscription.unsubscribe()
        }
        if (this.checkInterval) {
            clearInterval(this.checkInterval)
        }
        supabase
            .from('match_queue')
            .delete()
            .eq('player_id', this.playerId)
    }
}