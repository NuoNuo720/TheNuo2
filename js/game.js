// js/game.js
export class Game {
    constructor(canvas, playerId, role, opponentId, onGameOver) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.playerId = playerId
        this.role = role
        this.opponentId = opponentId
        this.onGameOver = onGameOver
        
        // 玩家位置
        this.players = {
            [playerId]: {
                x: role === 'proton' ? 200 : 600,
                y: 300,
                role: role,
                width: 20,
                height: 20,
                speed: role === 'proton' ? 2.5 : 3.5,
                skills: {
                    ultimate: {
                        cooldown: 0,
                        maxCooldown: role === 'proton' ? 30 : 60,
                        active: false,
                        duration: 0
                    }
                },
                ultUsed: false // 全局一次的无敌/脉冲
            },
            [opponentId]: {
                x: role === 'proton' ? 600 : 200,
                y: 300,
                role: role === 'proton' ? 'electron' : 'proton',
                width: 20,
                height: 20,
                speed: role === 'proton' ? 3.5 : 2.5,
                skills: {
                    ultimate: {
                        cooldown: 0,
                        maxCooldown: role === 'proton' ? 60 : 30,
                        active: false,
                        duration: 0
                    }
                },
                ultUsed: false
            }
        }
        
        // 子弹数组
        this.bullets = []
        this.maxBullets = 3
        
        // 生成迷宫
        this.walls = this.generateMaze()
        
        // 游戏计时
        this.gameTime = 120 // 2分钟
        this.gameLoop = null
        this.lastUpdate = Date.now()
        
        // 技能效果
        this.effects = []
    }

    generateMaze() {
        const walls = []
        const cellSize = 60
        const cols = Math.floor(800 / cellSize)
        const rows = Math.floor(600 / cellSize)
        
        // 外围墙壁
        walls.push({ x: 0, y: 0, width: 800, height: 5 })
        walls.push({ x: 0, y: 595, width: 800, height: 5 })
        walls.push({ x: 0, y: 0, width: 5, height: 600 })
        walls.push({ x: 795, y: 0, width: 5, height: 600 })
        
        // 内部障碍
        const obstacles = [
            { x: 200, y: 150, w: 20, h: 100 },
            { x: 400, y: 250, w: 100, h: 20 },
            { x: 600, y: 400, w: 20, h: 100 },
            { x: 300, y: 450, w: 100, h: 20 },
            { x: 100, y: 350, w: 20, h: 80 },
            { x: 500, y: 100, w: 80, h: 20 },
            { x: 650, y: 200, w: 20, h: 80 }
        ]
        
        obstacles.forEach(obs => {
            walls.push({
                x: obs.x,
                y: obs.y,
                width: obs.w,
                height: obs.h
            })
        })
        
        return walls
    }

    start() {
        this.gameLoop = setInterval(() => this.update(), 16)
    }

    update() {
        const now = Date.now()
        const deltaTime = (now - this.lastUpdate) / 16 // 标准化到60fps
        this.lastUpdate = now
        
        // 更新时间
        this.gameTime -= 0.016 * deltaTime
        if (this.gameTime <= 0) {
            this.gameOver('draw')
            return
        }
        
        // 更新冷却
        const player = this.players[this.playerId]
        if (player.skills.ultimate.cooldown > 0) {
            player.skills.ultimate.cooldown -= 0.016 * deltaTime
        }
        
        // 更新技能效果
        if (player.skills.ultimate.active) {
            player.skills.ultimate.duration -= 0.016 * deltaTime
            if (player.skills.ultimate.duration <= 0) {
                player.skills.ultimate.active = false
                if (this.role === 'electron') {
                    // 电子大招效果结束：质子恢复原大小
                    const proton = this.players[this.opponentId]
                    if (proton) {
                        proton.width = 20
                        proton.height = 20
                    }
                }
            }
        }
        
        // 更新子弹
        this.bullets = this.bullets.filter(bullet => {
            bullet.time -= 0.016 * deltaTime
            if (bullet.time <= 0) return false
            
            // 移动子弹
            let newX = bullet.x + bullet.vx * deltaTime
            let newY = bullet.y + bullet.vy * deltaTime
            
            // 墙壁碰撞
            let collided = false
            this.walls.forEach(wall => {
                if (this.checkCollision(
                    {x: newX, y: newY, width: 5, height: 5},
                    wall
                )) {
                    if (Math.abs(bullet.vx) > Math.abs(bullet.vy)) {
                        bullet.vx *= -1
                    } else {
                        bullet.vy *= -1
                    }
                    collided = true
                }
            })
            
            if (!collided) {
                bullet.x = newX
                bullet.y = newY
            }
            
            // 检查击中对方
            const opponent = this.players[this.opponentId]
            if (opponent && this.checkCollision(
                {x: bullet.x, y: bullet.y, width: 5, height: 5},
                {x: opponent.x, y: opponent.y, width: opponent.width, height: opponent.height}
            )) {
                // 检查质子无敌状态
                if (this.role === 'electron' && opponent.skills.ultimate.active) {
                    return true // 无敌，子弹消失但不造成伤害
                }
                this.gameOver('win')
                return false
            }
            
            return true
        })
        
        this.draw()
    }

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y
    }

    movePlayer(dx, dy) {
        const player = this.players[this.playerId]
        if (!player) return
        
        // 尝试移动
        const newX = player.x + dx * player.speed
        const newY = player.y + dy * player.speed
        
        // 边界检查
        if (newX < 0 || newX + player.width > 800) return
        if (newY < 0 || newY + player.height > 600) return
        
        // 墙壁碰撞
        let canMove = true
        this.walls.forEach(wall => {
            if (this.checkCollision(
                {x: newX, y: newY, width: player.width, height: player.height},
                wall
            )) {
                canMove = false
            }
        })
        
        if (canMove) {
            player.x = newX
            player.y = newY
        }
    }

    shoot(direction) {
        const player = this.players[this.playerId]
        if (!player) return
        
        if (this.bullets.length >= this.maxBullets) return
        
        const speed = 6
        this.bullets.push({
            x: player.x + player.width/2 - 2.5,
            y: player.y + player.height/2 - 2.5,
            vx: direction.x * speed,
            vy: direction.y * speed,
            time: 10,
            color: this.role === 'proton' ? '#ff4444' : '#4444ff'
        })
    }

    useUltimate() {
        const player = this.players[this.playerId]
        if (!player) return
        
        const skill = player.skills.ultimate
        
        // 检查冷却
        if (skill.cooldown > 0) return
        
        if (this.role === 'proton') {
            if (!player.ultUsed) {
                // 全局无敌
                player.ultUsed = true
                skill.active = true
                skill.duration = 3 // 3秒无敌
            } else {
                // 周围生成子弹
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2
                    this.bullets.push({
                        x: player.x + player.width/2 - 2.5,
                        y: player.y + player.height/2 - 2.5,
                        vx: Math.cos(angle) * 4,
                        vy: Math.sin(angle) * 4,
                        time: 10,
                        color: '#ff8888'
                    })
                }
                skill.cooldown = skill.maxCooldown
            }
        } else {
            // 电子大招
            if (!player.ultUsed) {
                // 脉冲：禁用质子技能
                player.ultUsed = true
                const proton = this.players[this.opponentId]
                if (proton) {
                    proton.skills.ultimate.cooldown = 5 // 禁用5秒
                }
            } else {
                // 使质子变大
                const proton = this.players[this.opponentId]
                if (proton) {
                    proton.width = 40
                    proton.height = 40
                    skill.active = true
                    skill.duration = 8
                }
                skill.cooldown = skill.maxCooldown
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, 800, 600)
        
        // 绘制迷宫背景
        this.ctx.fillStyle = '#2a2a2a'
        this.ctx.fillRect(0, 0, 800, 600)
        
        // 绘制墙壁
        this.ctx.fillStyle = '#666'
        this.walls.forEach(wall => {
            this.ctx.fillRect(wall.x, wall.y, wall.width, wall.height)
            // 添加3D效果
            this.ctx.fillStyle = '#888'
            this.ctx.fillRect(wall.x + 2, wall.y + 2, wall.width - 4, wall.height - 4)
            this.ctx.fillStyle = '#666'
        })
        
        // 绘制网格线（装饰）
        this.ctx.strokeStyle = '#333'
        this.ctx.lineWidth = 1
        for (let i = 0; i < 800; i += 40) {
            this.ctx.beginPath()
            this.ctx.moveTo(i, 0)
            this.ctx.lineTo(i, 600)
            this.ctx.strokeStyle = '#333'
            this.ctx.stroke()
        }
        for (let i = 0; i < 600; i += 40) {
            this.ctx.beginPath()
            this.ctx.moveTo(0, i)
            this.ctx.lineTo(800, i)
            this.ctx.stroke()
        }
        
        // 绘制玩家
        Object.entries(this.players).forEach(([id, player]) => {
            // 角色外框
            this.ctx.fillStyle = player.role === 'proton' ? '#ff4444' : '#4444ff'
            this.ctx.fillRect(player.x, player.y, player.width, player.height)
            
            // 高光
            this.ctx.fillStyle = 'rgba(255,255,255,0.3)'
            this.ctx.fillRect(player.x + 2, player.y + 2, player.width - 4, 4)
            
            // 如果是自己，添加光圈
            if (id === this.playerId) {
                this.ctx.strokeStyle = '#ffff00'
                this.ctx.lineWidth = 2
                this.ctx.strokeRect(player.x - 2, player.y - 2, player.width + 4, player.height + 4)
            }
            
            // 无敌状态显示
            if (player.skills.ultimate.active) {
                this.ctx.strokeStyle = '#ffff00'
                this.ctx.lineWidth = 3
                this.ctx.strokeRect(player.x - 3, player.y - 3, player.width + 6, player.height + 6)
            }
        })
        
        // 绘制子弹
        this.bullets.forEach(bullet => {
            this.ctx.fillStyle = bullet.color
            this.ctx.beginPath()
            this.ctx.arc(bullet.x + 2.5, bullet.y + 2.5, 4, 0, Math.PI * 2)
            this.ctx.fill()
            
            // 拖尾效果
            this.ctx.fillStyle = bullet.color + '66'
            this.ctx.beginPath()
            this.ctx.arc(bullet.x + 2.5 - bullet.vx * 0.5, bullet.y + 2.5 - bullet.vy * 0.5, 3, 0, Math.PI * 2)
            this.ctx.fill()
        })
        
        // 绘制UI
        this.drawUI()
    }

    drawUI() {
        const player = this.players[this.playerId]
        
        // 时间
        const minutes = Math.floor(Math.max(0, this.gameTime) / 60)
        const seconds = Math.floor(Math.max(0, this.gameTime) % 60)
        document.getElementById('gameTime').textContent = 
            `时间: ${minutes}:${seconds.toString().padStart(2, '0')}`
        
        // 冷却
        if (player.skills.ultimate.cooldown > 0) {
            document.getElementById('cooldown').textContent = 
                `大招冷却: ${player.skills.ultimate.cooldown.toFixed(1)}s`
        } else {
            document.getElementById('cooldown').textContent = '大招就绪!'
        }
        
        // 角色信息
        document.getElementById('matchInfo').innerHTML = 
            `你扮演: <span style="color: ${this.role === 'proton' ? '#ff4444' : '#4444ff'}">${this.role === 'proton' ? '⚡质子' : '✨电子'}</span><br>` +
            `子弹: ${this.bullets.length}/${this.maxBullets}`
    }

    gameOver(result) {
        clearInterval(this.gameLoop)
        this.onGameOver(result)
    }
}