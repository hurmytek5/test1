var config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    }
};

var game = new Phaser.Game(config);

// Scene variables (using 'this' in scene functions)
// var player; // Will be this.player
// var cursors; // Will be this.cursors
// var spaceBar; // Will be this.spaceBar
// var bullets; // Will be this.bullets

const PLAYER_SPEED = 200; // pixels per second
const ROTATION_SPEED = 5; // degrees per frame (corrected from previous thought - it's per update)
const BULLET_SPEED = 600; // pixels per second
const BULLET_OFFSET = 30; // pixels from tank center
const NUM_ENEMIES = 5;
const ENEMY_SPEED = 50; // pixels per second
const ENEMY_FIRE_RATE = 3000; // milliseconds
const ENEMY_BULLET_SPEED = 250; // pixels per second
const ENEMY_BULLET_OFFSET = 30; // pixels from enemy center

function preload() {
    this.load.image('playerTank', 'assets/player_tank.svg');
    this.load.image('bullet', 'assets/bullet.svg');
    this.load.image('enemyTank', 'assets/enemy_tank.svg');
    this.load.image('battlefield', 'assets/background.svg'); // Load the SVG background
}

function create() {
    // Add background first
    this.add.tileSprite(400, 300, 800, 600, 'battlefield');

    // Initialize score
    this.score = 0;
    this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#FFF' });

    // Game Over state and UI
    this.isGameOver = false;
    this.gameOverText = this.add.text(400, 250, 'Game Over', { fontSize: '64px', fill: '#F00', fontStyle: 'bold' });
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setVisible(false);

    this.restartText = this.add.text(400, 350, 'Click to Restart', { fontSize: '32px', fill: '#FFF' });
    this.restartText.setOrigin(0.5);
    this.restartText.setVisible(false);
    this.restartText.setInteractive();
    this.restartText.on('pointerdown', () => { 
        this.scene.restart(); 
    });

    // Add player tank (ensure player is created first for spawn check)
    this.player = this.physics.add.sprite(400, 300, 'playerTank');
    this.player.setOrigin(0.5, 0.5);
    this.player.setCollideWorldBounds(true);
    this.player.setAngle(0); // Default angle, tank's front is to its right

    // Setup keyboard inputs
    this.cursors = this.input.keyboard.addKeys('W,A,S,D');
    this.spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Create bullets group
    this.bullets = this.physics.add.group({
        defaultKey: 'bullet',
        maxSize: 10, // Max 10 bullets on screen at once
        runChildUpdate: function(bullet) { // Auto-deactivate if out of bounds
             if (bullet.y < 0 || bullet.y > 600 || bullet.x < 0 || bullet.x > 800) {
                bullet.setActive(false);
                bullet.setVisible(false);
                bullet.body.stop();
            }
        }
    });

    // Create enemies group
    this.enemies = this.physics.add.group();
    for (let i = 0; i < NUM_ENEMIES; i++) {
        let x, y;
        let attempts = 0;
        const MIN_DIST_FROM_PLAYER = 100; // Minimum distance from player spawn
        do {
            x = Phaser.Math.Between(50, 750); // Random x within bounds (with some margin)
            y = Phaser.Math.Between(50, 550); // Random y within bounds (with some margin)
            attempts++;
        } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < MIN_DIST_FROM_PLAYER && attempts < 10);
        // If after 10 attempts we can't find a spot, spawn anyway (edge case)

        let enemy = this.enemies.create(x, y, 'enemyTank');
        enemy.setOrigin(0.5, 0.5);
        enemy.setCollideWorldBounds(true);
        enemy.setImmovable(true); // Player cannot push them
        
        // Give each enemy a random initial rotation (visual) as per subtask
        enemy.angle = Phaser.Math.Between(0, 360);
        // No initial velocity here; it will be set in the first update pass by the AI logic.
        
        // Initialize lastShotTime for staggered shooting
        enemy.setData('lastShotTime', this.time.now + Phaser.Math.Between(0, ENEMY_FIRE_RATE));
    }

    // Create enemy bullets group
    this.enemyBullets = this.physics.add.group({
        defaultKey: 'bullet', // Using the same bullet sprite for now
        maxSize: NUM_ENEMIES * 3, // Allow e.g. 3 bullets per enemy on screen
        runChildUpdate: function(bullet) {
            if (bullet.x < -50 || bullet.x > 850 || bullet.y < -50 || bullet.y > 650) { // Added some margin
                bullet.setActive(false);
                bullet.setVisible(false);
                bullet.body.stop();
            }
        }
    });

    // Setup collision detection
    this.physics.add.collider(this.bullets, this.enemies, handlePlayerBulletEnemyCollision, null, this);
    this.physics.add.collider(this.enemyBullets, this.player, handleEnemyBulletPlayerCollision, null, this);
}

function update() {
    // If game is over, skip game logic updates
    if (this.isGameOver) {
        return;
    }

    // Reset player velocity
    this.player.setVelocity(0);

    // Player Movement
    if (this.cursors.W.isDown) {
        this.physics.velocityFromRotation(this.player.rotation, PLAYER_SPEED, this.player.body.velocity);
    } else if (this.cursors.S.isDown) {
        this.physics.velocityFromRotation(this.player.rotation, -PLAYER_SPEED, this.player.body.velocity);
    }

    // Player Rotation
    if (this.cursors.A.isDown) {
        this.player.angle -= ROTATION_SPEED;
    } else if (this.cursors.D.isDown) {
        this.player.angle += ROTATION_SPEED;
    }

    // Shooting
    if (Phaser.Input.Keyboard.JustDown(this.spaceBar)) {
        let bullet = this.bullets.get(); // Get a bullet from the pool

        if (bullet) {
            // Calculate offset position for the bullet
            const offsetX = Math.cos(this.player.rotation) * BULLET_OFFSET;
            const offsetY = Math.sin(this.player.rotation) * BULLET_OFFSET;
            
            bullet.setPosition(this.player.x + offsetX, this.player.y + offsetY);
            bullet.rotation = this.player.rotation;
            bullet.setActive(true);
            bullet.setVisible(true);
            
            this.physics.velocityFromRotation(this.player.rotation, BULLET_SPEED, bullet.body.velocity);
            bullet.body.setCollideWorldBounds(false); // Bullets should go off screen
        }
    }

    // Note: Bullet deactivation is handled by `runChildUpdate` in the group config.
    // If that wasn't used, this is where you'd iterate `this.bullets.getChildren()`
    // and check bounds.

    // Enemy AI
    this.enemies.getChildren().forEach(enemy => {
        if (!enemy.active) {
            return;
        }

        // Movement AI (from previous step)
        if (enemy.body.velocity.lengthSq() === 0) { // Initial movement
            let initialVx = Phaser.Math.Between(-ENEMY_SPEED, ENEMY_SPEED);
            let initialVy = Phaser.Math.Between(-ENEMY_SPEED, ENEMY_SPEED);
            if (initialVx === 0 && initialVy === 0) {
                initialVx = ENEMY_SPEED; 
            }
            enemy.body.setVelocity(initialVx, initialVy);
            // Set rotation based on movement, but shooting will override this
            enemy.rotation = Math.atan2(initialVy, initialVx); 
        } else if (Phaser.Math.Between(1, 100) > 98) { // Random direction change
            let newVx = Phaser.Math.Between(-ENEMY_SPEED, ENEMY_SPEED);
            let newVy = Phaser.Math.Between(-ENEMY_SPEED, ENEMY_SPEED);
            if (newVx === 0 && newVy === 0) {
                newVx = ENEMY_SPEED; 
            }
            enemy.body.setVelocity(newVx, newVy);
            // Set rotation based on movement, but shooting will override this
            enemy.rotation = Math.atan2(newVy, newVx);
        }

        // Shooting AI
        if (this.player && this.player.active && this.time.now > enemy.getData('lastShotTime') + ENEMY_FIRE_RATE) {
            let bullet = this.enemyBullets.get();
            if (bullet) {
                bullet.setActive(true);
                bullet.setVisible(true);
                bullet.body.setCollideWorldBounds(false);

                // Calculate angle towards player (radians)
                let angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
                
                // Enemy faces player when shooting
                enemy.rotation = angleToPlayer; // .rotation is in radians

                // Set bullet position with offset
                const offsetX = Math.cos(angleToPlayer) * ENEMY_BULLET_OFFSET;
                const offsetY = Math.sin(angleToPlayer) * ENEMY_BULLET_OFFSET;
                bullet.setPosition(enemy.x + offsetX, enemy.y + offsetY);
                bullet.rotation = angleToPlayer; // Bullet rotation matches shooting angle

                // Propel bullet towards player
                this.physics.velocityFromRotation(angleToPlayer, ENEMY_BULLET_SPEED, bullet.body.velocity);
                
                enemy.setData('lastShotTime', this.time.now);
            }
        }
    });
}

// Collision handler for player bullets hitting enemy tanks
function handlePlayerBulletEnemyCollision(bullet, enemy) {
    // 'this' refers to the scene context because it's passed in the collider setup
    if (bullet.active && enemy.active) {
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.stop();

        enemy.setActive(false);
        enemy.setVisible(false);
        enemy.body.stop();

        // Update score
        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);
        // console.log('Enemy hit! Score: ' + this.score);
    }
}

// Collision handler for enemy bullets hitting the player tank
function handleEnemyBulletPlayerCollision(player, bullet) {
    // 'this' refers to the scene context
    if (bullet.active && player.active) {
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.stop();

        player.setActive(false);
        player.setVisible(false);
        player.body.stop();
        
        // Set game over state and show messages
        this.isGameOver = true;
        this.gameOverText.setVisible(true);
        this.restartText.setVisible(true);
        
        // console.log('Player hit! Game Over.');
    }
}
