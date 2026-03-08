// js/match.js
import { supabase, removeFromQueue, getWaitingPlayers } from './supabase.js'

export class MatchSystem {
    constructor(playerId, onMatched) {
        this.playerId = playerId
        this.onMatched = onMatched
        this.subscription = null
        this.checkInterval = null
        this.isMatching = false
    }

    async joinQueue() {
        if (this.isMatching) return
        this.isMatching = true
        
        try {
            // 清理旧记录
            await removeFromQueue(this.playerId)

            // 加入队列
            const { error } = await supabase
                .from('match_queue')
                .insert({ player_id: this.playerId, status: 'waiting' })
            
            if (error) throw error

            // 监听匹配
            this.setupRealtimeSubscription()

            // 立即检查一次
            await this.checkForMatch()
            
            // 每3秒检查一次
            this.checkInterval = setInterval(() => this.checkForMatch(), 3000)
            
        } catch (error) {
            console.error('加入队列失败:', error)
            this.isMatching = false
            throw error
        }
    }

    setupRealtimeSubscription() {
        // 使用更稳定的轮询方式，避免realtime问题
        console.log('使用轮询方式匹配')
    }

    async checkForMatch() {
        try {
            const waiting = await getWaitingPlayers(this.playerId)

            if (waiting && waiting.length > 0) {
                await this.createMatch(waiting[0].player_id)
            }
        } catch (error) {
            console.error('检查匹配失败:', error)
        }
    }

    async createMatch(opponentId) {
        try {
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
            
        } catch (error) {
            console.error('创建匹配失败:', error)
        }
    }

    leaveQueue() {
        this.isMatching = false
        if (this.checkInterval) {
            clearInterval(this.checkInterval)
            this.checkInterval = null
        }
        removeFromQueue(this.playerId).catch(console.error)
    }
}