// 游戏状态标志
let isGameOver = false;
let isGameWin = false;

// 每次生成敌人数量基础值
let enemiesPerSpawn = 0.1;

// 敌人鱼的等级划分及对应大小、图片、成长值
const enemyTiers = [
    { minSize: 5, maxSize: 15, image: 'images/Mackerel.png', growthValue: 1 },
    { minSize: 16, maxSize: 30, image: 'images/BlueTang.png', growthValue: 3 },
    { minSize: 31, maxSize: 80, image: 'images/Anchovy.png', growthValue: 6 },
    { minSize: 81, maxSize: 120, image: 'images/StoneFish.png', growthValue: 10 },
    { minSize: 121, maxSize: 150, image: 'images/pike fish.png', growthValue: 15 },
    { minSize: 151, maxSize: 180, image: 'images/BlueFish.png', growthValue: 10 },
    { minSize: 181, maxSize: 200, image: 'images/SunFish.png', growthValue: 10 },
    { minSize: 201, maxSize: 240, image: 'images/Shark.png', growthValue: 10 }
];

// 玩家图片对象
const playerImage = new Image();
playerImage.src = 'images/ClownFish.png';

// 画布和上下文
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// 键盘按键状态，初始化为未按下
const keys = { w: false, a: false, s: false, d: false };

// 每个等级对应需要达到的成长值
const growthNeeded = [0, 5, 20, 60, 110, 170, 240, 320, 410, 500, 600, 710, 830, 1000, 1200];

// --------- 像素级碰撞检测辅助函数 ---------
// 输入：一张图片，返回该图片透明部分的掩码，方便做像素碰撞
function getAlphaMask(image) {
    // 创建离屏画布，大小与图片相同
    const offCanvas = document.createElement('canvas');
    offCanvas.width = image.width;
    offCanvas.height = image.height;
    const offCtx = offCanvas.getContext('2d');
    
    // 将图片画到离屏画布
    offCtx.drawImage(image, 0, 0);

    // 获取画布像素数据（RGBA）
    const imageData = offCtx.getImageData(0, 0, image.width, image.height);

    const alphaMask = [];

    // 遍历每个像素的 alpha 通道，alpha>0 代表不透明，存 true，否则 false
    for (let i = 0; i < imageData.data.length; i += 4) {
        const alpha = imageData.data[i + 3]; // 每4字节最后一位是 alpha
        alphaMask.push(alpha > 0);
    }

    // 返回掩码和图片尺寸
    return { mask: alphaMask, width: image.width, height: image.height };
}

// --------- 玩家鱼类 ---------
class PlayerFish {
    constructor() {
        // 初始位置在画布中央
        this.x = 400;
        this.y = 300;
        this.radius = 15;  // 用来控制大小和碰撞范围
        this.speed = 2;    // 移动速度
        this.level = 1;    // 等级
        this.growth = 0;   // 当前成长值
        this.health = 2000;  // 生命值
        this.direction = 'right'; // 朝向（用于绘制翻转）
    }

    // 玩家尺寸（直径）
    get size() {
        return this.radius * 2;
    }

    // 每帧更新玩家状态，包括位置和朝向
    update() {
        let dx = 0, dy = 0;
        // 根据按键改变方向
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;

        // 加入虚拟摇杆的输入（joystick 对象应由其它代码提供）
        dx += joystick.x;
        dy += joystick.y;

        // 计算方向向量长度，做归一化，保证斜方向移动速度不变
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
            dx /= length;
            dy /= length;

            // 根据水平方向改变朝向，方便绘图时镜像
            if (dx < 0) {
                this.direction = 'left';
            } else if (dx > 0) {
                this.direction = 'right';
            }
        }

        // 更新位置
        this.x += dx * this.speed;
        this.y += dy * this.speed;

        // 限制玩家在画布范围内
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));
    }

    // 绘制玩家
    draw(ctx) {
        if (playerImage.complete) { // 图片加载完成
            const drawSize = this.radius * 2;
            ctx.save();

            if (this.direction === 'left') {
                // 朝左时镜像绘制
                ctx.translate(this.x + this.radius, this.y - this.radius);
                ctx.scale(-1, 1);
            } else {
                ctx.translate(this.x - this.radius, this.y - this.radius);
            }

            ctx.drawImage(playerImage, 0, 0, drawSize, drawSize);
            ctx.restore();
        } else {
            // 图片没加载好，画一个橙色圆形替代
            ctx.beginPath();
            ctx.fillStyle = 'orange';
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// --------- 敌人鱼类 ---------
class Enemy {
    constructor() {
        // 随机选一个敌人等级
        const tier = enemyTiers[Math.floor(Math.random() * enemyTiers.length)];
        this.tier = tier;
        // 生成敌人大小范围内的随机尺寸
        this.size = Math.random() * (tier.maxSize - tier.minSize) + tier.minSize;
        this.radius = this.size / 2;
        // 速度随机
        this.speed = Math.random() * 1.5 + 0.3;
        // Y轴随机位置
        this.y = Math.random() * canvas.height;
        // 随机从左边或右边出现
        this.fromLeft = Math.random() < 0.5;
        this.x = this.fromLeft ? -this.size : canvas.width + this.size;

        // 创建敌人图片对象
        this.image = new Image();
        this.image.src = tier.image;

        // 图片加载完成后生成像素透明掩码，方便碰撞检测
        this.image.onload = () => {
            this.alphaMask = getAlphaMask(this.image);
        };
    }

    // 敌人每帧位置更新，向左或向右移动
    update() {
        this.x += this.fromLeft ? this.speed : -this.speed;
    }

    // 绘制敌人，朝向根据移动方向决定是否镜像
    draw(ctx) {
        ctx.save();

        const drawSize = this.size;
        if (!this.fromLeft) {
            // 从右边出来时镜像绘制
            ctx.translate(this.x + this.radius, this.y - this.radius);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(this.x - this.radius, this.y - this.radius);
        }

        ctx.drawImage(this.image, 0, 0, drawSize, drawSize);
        ctx.restore();
    }

    // 获取敌人对应的成长值
    getGrowthValue() {
        return this.tier.growthValue;
    }
}

// 创建玩家对象
const player = new PlayerFish();

// 玩家图片加载完成后，生成透明掩码
playerImage.onload = () => {
    player.alphaMask = getAlphaMask(playerImage);
};

let enemies = [];           // 敌人数组
let enemySpawnTimer = 0;    // 敌人生成计时器
let animationId = null;     // requestAnimationFrame的ID

// --------- 像素级碰撞检测 ---------
// 传入两个鱼对象，判断是否发生碰撞
function isPixelColliding(fish1, fish2) {
    // 先做粗略的矩形碰撞检测（减少计算量）
    const left = Math.max(fish1.x - fish1.radius, fish2.x - fish2.radius);
    const right = Math.min(fish1.x + fish1.radius, fish2.x + fish2.radius);
    const top = Math.max(fish1.y - fish1.radius, fish2.y - fish2.radius);
    const bottom = Math.min(fish1.y + fish1.radius, fish2.y + fish2.radius);

    if (right <= left || bottom <= top) return false; // 无重叠，没碰撞

    // 确认两个鱼都加载了透明掩码，没有则跳过检测
    if (!fish1.alphaMask || !fish2.alphaMask) return false;

    // 每隔 step 像素采样，减少计算压力
    const step = 2;

    // 遍历重叠区域的像素点，判断两个图片该点是否都不透明
    for (let y = top; y < bottom; y += step) {
        for (let x = left; x < right; x += step) {
            // 计算当前点在两个图片透明掩码里的对应索引
            const f1x = Math.floor((x - (fish1.x - fish1.radius)) * fish1.alphaMask.width / (fish1.radius * 2));
            const f1y = Math.floor((y - (fish1.y - fish1.radius)) * fish1.alphaMask.height / (fish1.radius * 2));
            const f2x = Math.floor((x - (fish2.x - fish2.radius)) * fish2.alphaMask.width / (fish2.radius * 2));
            const f2y = Math.floor((y - (fish2.y - fish2.radius)) * fish2.alphaMask.height / (fish2.radius * 2));

            const f1Index = f1y * fish1.alphaMask.width + f1x;
            const f2Index = f2y * fish2.alphaMask.width + f2x;

            // 如果两个图像该位置都不透明，则判定碰撞
            if (fish1.alphaMask.mask[f1Index] && fish2.alphaMask.mask[f2Index]) {
                return true;
            }
        }
    }

    return false; // 没检测到像素级碰撞
}

// --------- 更新敌人状态 ---------
function updateEnemies() {
    // 游戏结束时不更新敌人
    if (isGameOver || isGameWin) return;

    enemySpawnTimer++;

    // 随着玩家等级提升，敌人生成频率加快，最低间隔30帧
    let dynamicInterval = Math.max(30, 100 - player.level * 10);

    if (enemySpawnTimer >= dynamicInterval) {
        // 生成数量=基础数量 + 0或1的随机数
        const randomOffset = Math.floor(Math.random() * 2);
        const count = enemiesPerSpawn + randomOffset;

        // 新增多个敌人
        for (let i = 0; i < count; i++) {
            enemies.push(new Enemy());
        }

        enemySpawnTimer = 0;
    }

    // 更新所有敌人位置
    enemies.forEach((enemy) => enemy.update());

    // 过滤掉移出画布的敌人，防止数组过大
    enemies = enemies.filter((e) => e.x > -e.size && e.x < canvas.width + e.size);

    // 检测玩家与敌人碰撞，反向遍历方便删除敌人
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        if (isPixelColliding(player, enemy)) {
            if (player.radius >= enemy.radius) {
                // 玩家比敌人大，吃掉敌人，增加成长值
                player.growth += enemy.getGrowthValue();

                enemies.splice(i, 1); // 删除敌人

                // 判断是否升级，升级则增大半径
                if (player.level < growthNeeded.length - 1 &&
                    player.growth >= growthNeeded[player.level]) {
                    player.level++;
                    player.radius += 18;
                }

                // 达到最大等级，游戏胜利
                if (player.level >= growthNeeded.length - 1) {
                    endGame(true);
                    return;
                }

            } else {
                // 玩家比敌人小，扣血，删除敌人
                player.health -= 10;
               // enemies.splice(i, 1);

                // 血量归零，游戏失败
                if (player.health <= 0) {
                    endGame(false);
                    return;
                }
            }
        }
    }
}

// --------- 绘制所有敌人 ---------
function drawEnemies(ctx) {
    enemies.forEach((enemy) => enemy.draw(ctx));
}

// --------- 更新界面血量等级成长值 ---------
function updateHUD() {
    document.getElementById("health").innerText = `血量: ${player.health}`;
    document.getElementById("level").innerText = `等级: ${player.level}`;
    document.getElementById("growth").innerText = `成长值: ${player.growth}`;
}

// --------- 游戏主循环 ---------
function gameLoop() {
    // 游戏结束时停止循环
    if (isGameOver || isGameWin) return;

    animationId = requestAnimationFrame(gameLoop); // 循环调用自身

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 更新和绘制玩家
    player.update();
    player.draw(ctx);

    // 更新敌人并绘制
    updateEnemies();
    drawEnemies(ctx);

    // 更新血量等级等信息显示
    updateHUD();
}

// --------- 结束游戏 ---------
function endGame(success) {
    cancelAnimationFrame(animationId); // 停止游戏循环

    isGameOver = !success;
    isGameWin = success;

    // 隐藏游戏界面，显示结束界面
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.remove('hidden');

    // 显示输赢信息
    document.getElementById('end-message').innerText = success ? "你赢了！" : "你S了！";
}

// --------- 事件监听 ---------

// 点击开始按钮，隐藏开始界面，显示游戏界面，启动游戏循环
document.getElementById('start-button').addEventListener('click', () => {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    gameLoop();
});

// 监听键盘按下，更新按键状态
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
});

// 监听键盘松开，更新按键状态
window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

// --------- 重置游戏状态 ---------
function resetGame() {
    isGameOver = false;
    isGameWin = false;

    // 重置玩家状态
    player.x = 400;
    player.y = 300;
    player.radius = 15;
    player.level = 1;
    player.growth = 0;
    player.health = 2000;

    // 清空敌人列表和计时器
    enemies = [];
    enemySpawnTimer = 0;
}

// 监听重置按钮，重置游戏并重新开始循环
document.getElementById('restart-button').addEventListener('click', () => {
    resetGame();
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    gameLoop();
});

// 监听返回首页按钮，重置游戏状态，显示开始界面
document.getElementById('home-button').addEventListener('click', () => {
    resetGame(); // 可选：回首页时清空游戏数据
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
});
