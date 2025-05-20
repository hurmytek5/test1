class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        // Initialize properties that will be set in create
        this.player = null;
        this.cursors = null;
        this.spaceBar = null;
        this.bullets = null;
        this.enemies = null;
        this.enemyBullets = null;
        
        this.score = 0;
        this.scoreText = null;
        
        this.isGameOver = false;
        this.gameOverText = null;
        this.restartText = null;

        this.obstacles = null; // Initialize obstacles group
    }

    create() {
        // Add background first - using 'background' key from PreloaderScene
        this.add.tileSprite(400, 300, 800, 600, 'background');

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
            this.isGameOver = false; // Reset game over state
            this.scene.restart(); 
        });

        // Add player tank
        this.player = this.physics.add.sprite(400, 300, 'playerTank');
        this.player.setOrigin(0.5, 0.5);
        this.player.setCollideWorldBounds(true);
        this.player.setAngle(0);

        // Setup keyboard inputs
        this.cursors = this.input.keyboard.addKeys('W,A,S,D');
        this.spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Create player bullets group
        this.bullets = this.physics.add.group({
            defaultKey: 'bullet',
            maxSize: 10, 
            runChildUpdate: function(bullet) {
                 if (bullet.y < 0 || bullet.y > 600 || bullet.x < 0 || bullet.x > 800) {
                    bullet.setActive(false);
                    bullet.setVisible(false);
                    bullet.body.stop();
                }
            }
        });

        // Create obstacles static group
        this.obstacles = this.physics.add.staticGroup();

        // Example obstacle placements
        this.obstacles.create(200, 200, 'obstacle').refreshBody();
        this.obstacles.create(600, 400, 'obstacle').refreshBody();
        this.obstacles.create(300, 500, 'obstacle').refreshBody();
        this.obstacles.create(500, 150, 'obstacle').refreshBody();

        for (let i = 0; i < 5; i++) {
            this.obstacles.create(100 + i * 50, 300, 'obstacle').refreshBody();
        }

        // Create enemies group
        this.enemies = this.physics.add.group();
        for (let i = 0; i < NUM_ENEMIES; i++) {
            let x, y;
            let attempts = 0;
            const MIN_DIST_FROM_PLAYER = 100;
            do {
                x = Phaser.Math.Between(50, 750);
                y = Phaser.Math.Between(50, 550);
                attempts++;
            } while (this.player && this.player.body && Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < MIN_DIST_FROM_PLAYER && attempts < 10);
            
            let enemy = this.enemies.create(x, y, 'enemyTank');
            enemy.setOrigin(0.5, 0.5);
            enemy.setCollideWorldBounds(true);
            enemy.setImmovable(true);
            enemy.angle = Phaser.Math.Between(0, 360);
            enemy.setData('lastShotTime', this.time.now + Phaser.Math.Between(0, ENEMY_FIRE_RATE));
        }

        // Create enemy bullets group
        this.enemyBullets = this.physics.add.group({
            defaultKey: 'bullet',
            maxSize: NUM_ENEMIES * 3,
            runChildUpdate: function(bullet) {
                if (bullet.x < -50 || bullet.x > 850 || bullet.y < -50 || bullet.y > 650) {
                    bullet.setActive(false);
                    bullet.setVisible(false);
                    bullet.body.stop();
                }
            }
        });

        // Setup collision detection
        this.physics.add.collider(this.bullets, this.enemies, this.handlePlayerBulletEnemyCollision, null, this);
        this.physics.add.collider(this.enemyBullets, this.player, this.handleEnemyBulletPlayerCollision, null, this);

        // Obstacle collision detection
        this.physics.add.collider(this.player, this.obstacles); // Player vs obstacles
        this.physics.add.collider(this.enemies, this.obstacles); // Enemies vs obstacles
        this.physics.add.collider(this.bullets, this.obstacles, this.handleBulletObstacleCollision, null, this); // Player bullets vs obstacles
        this.physics.add.collider(this.enemyBullets, this.obstacles, this.handleBulletObstacleCollision, null, this); // Enemy bullets vs obstacles
    }

    update() {
        if (this.isGameOver) {
            return;
        }

        if (!this.player.active) { // If player is not active (e.g. hit), don't process input
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
            let bullet = this.bullets.get();
            if (bullet) {
                const offsetX = Math.cos(this.player.rotation) * BULLET_OFFSET;
                const offsetY = Math.sin(this.player.rotation) * BULLET_OFFSET;
                bullet.setPosition(this.player.x + offsetX, this.player.y + offsetY);
                bullet.rotation = this.player.rotation;
                bullet.setActive(true);
                bullet.setVisible(true);
                this.physics.velocityFromRotation(this.player.rotation, BULLET_SPEED, bullet.body.velocity);
                bullet.body.setCollideWorldBounds(false);
            }
        }

        // Enemy AI
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.active) {
                return;
            }

            // Movement AI
            if (enemy.body.velocity.lengthSq() === 0) {
                let initialVx = Phaser.Math.Between(-ENEMY_SPEED, ENEMY_SPEED);
                let initialVy = Phaser.Math.Between(-ENEMY_SPEED, ENEMY_SPEED);
                if (initialVx === 0 && initialVy === 0) {
                    initialVx = ENEMY_SPEED; 
                }
                enemy.body.setVelocity(initialVx, initialVy);
                enemy.rotation = Math.atan2(initialVy, initialVx); 
            } else if (Phaser.Math.Between(1, 100) > 98) {
                let newVx = Phaser.Math.Between(-ENEMY_SPEED, ENEMY_SPEED);
                let newVy = Phaser.Math.Between(-ENEMY_SPEED, ENEMY_SPEED);
                if (newVx === 0 && newVy === 0) {
                    newVx = ENEMY_SPEED; 
                }
                enemy.body.setVelocity(newVx, newVy);
                enemy.rotation = Math.atan2(newVy, newVx);
            }

            // Shooting AI
            if (this.player && this.player.active && this.time.now > enemy.getData('lastShotTime') + ENEMY_FIRE_RATE) {
                let bullet = this.enemyBullets.get();
                if (bullet) {
                    bullet.setActive(true);
                    bullet.setVisible(true);
                    bullet.body.setCollideWorldBounds(false);
                    let angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
                    enemy.rotation = angleToPlayer;
                    const offsetX = Math.cos(angleToPlayer) * ENEMY_BULLET_OFFSET;
                    const offsetY = Math.sin(angleToPlayer) * ENEMY_BULLET_OFFSET;
                    bullet.setPosition(enemy.x + offsetX, enemy.y + offsetY);
                    bullet.rotation = angleToPlayer;
                    this.physics.velocityFromRotation(angleToPlayer, ENEMY_BULLET_SPEED, bullet.body.velocity);
                    enemy.setData('lastShotTime', this.time.now);
                }
            }
        });
    }

    handlePlayerBulletEnemyCollision(bullet, enemy) {
        if (bullet.active && enemy.active) {
            bullet.setActive(false);
            bullet.setVisible(false);
            bullet.body.stop();

            enemy.setActive(false);
            enemy.setVisible(false);
            enemy.body.stop();

            this.score += 10;
            this.scoreText.setText('Score: ' + this.score);

            // Check if all enemies in GameScene are defeated
            if (this.enemies.countActive(true) === 0 && !this.isGameOver) {
                this.isGameOver = true; // Pause updates in GameScene
                
                // Transition to GameScene2
                this.scene.start('GameScene2', { score: this.score, level: 2 });
            }
        }
    }

    handleEnemyBulletPlayerCollision(player, bullet) {
        if (bullet.active && player.active) {
            bullet.setActive(false);
            bullet.setVisible(false);
            bullet.body.stop();

            player.setActive(false);
            player.setVisible(false);
            player.body.stop();
            
            this.isGameOver = true;
            this.gameOverText.setVisible(true);
            this.restartText.setVisible(true);
        }
    }

    handleBulletObstacleCollision(bullet, obstacle) {
        // Check if the bullet is active to prevent multiple deactivations or errors
        if (bullet.active) {
            bullet.setActive(false);
            bullet.setVisible(false);
            bullet.body.stop(); // Stop its physics body
        }
        // The obstacle remains unaffected (obstacle is a parameter but not used)
    }
}


class PreloaderScene extends Phaser.Scene {
    constructor() {
        super('PreloaderScene');
    }

    preload() {
        // Assets to load (ensure these paths are correct)
        this.load.svg('playerTank', 'assets/player_tank.svg'); // Ensure this key matches
        this.load.svg('enemyTank', 'assets/enemy_tank.svg');  // Ensure this key matches
        this.load.svg('bullet', 'assets/bullet.svg');        // Ensure this key matches
        this.load.svg('background', 'assets/background.svg'); // Key for background image
        this.load.svg('obstacle', 'assets/obstacle.svg');    // Ensure this key matches

        // Create loading bar graphics
        let progressBar = this.add.graphics();
        let progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(240, 270, 320, 50); // x, y, width, height

        let width = this.cameras.main.width;
        let height = this.cameras.main.height;
        let loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading...',
            style: {
                font: '20px monospace',
                fill: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);

        let percentText = this.make.text({
            x: width / 2,
            y: height / 2 - 5, // Adjusted y to be closer to progress bar
            text: '0%',
            style: {
                font: '18px monospace',
                fill: '#ffffff'
            }
        });
        percentText.setOrigin(0.5, 0.5);

        // Listen for progress event
        this.load.on('progress', function (value) {
            percentText.setText(parseInt(value * 100) + '%');
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(250, 280, 300 * value, 30);
        });

        // Listen for complete event
        this.load.on('complete', function () {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
            this.scene.start('GameScene'); 
        }.bind(this)); // Bind 'this' to access scene context
    }
}


var config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: [PreloaderScene, GameScene] // Use the new scene array
};

var game = new Phaser.Game(config);

// Global constants remain at the top
const PLAYER_SPEED = 200; // pixels per second
const ROTATION_SPEED = 5; // degrees per frame (corrected from previous thought - it's per update)
const BULLET_SPEED = 600; // pixels per second
const BULLET_OFFSET = 30; // pixels from tank center
const NUM_ENEMIES = 5;
const NUM_ENEMIES_LEVEL2 = 8; // More enemies for level 2
const ENEMY_SPEED = 50; // pixels per second
const ENEMY_FIRE_RATE = 3000; // milliseconds
const ENEMY_BULLET_SPEED = 250; // pixels per second
const ENEMY_BULLET_OFFSET = 30; // pixels from enemy center

// Global preload function is now empty, PreloaderScene handles loading
function preload() {
    // All asset loading moved to PreloaderScene.preload()
}

function create() {
    // This global create function will be moved into GameScene.create()
    // For now, GameScene.create() has a placeholder.
    // The actual game setup logic is still here temporarily.
    // It will not be called automatically anymore due to config change.

    // Add background first
    // this.add.tileSprite(400, 300, 800, 600, 'battlefield'); // Moved to GameScene potentially

    // Initialize score
    this.score = 0;
    this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#FFF' });

    // Game Over state and UI
    // this.isGameOver = false; // Moved
    // ... and other UI elements ...

    // Add player tank (ensure player is created first for spawn check)
    // this.player = this.physics.add.sprite(400, 300, 'playerTank'); // Moved
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
    // this.enemyBullets = ... // Moved

    // Setup collision detection
    // this.physics.add.collider(...) // Moved
}

function update() {
    // This global update function will be moved into GameScene.update()
    // For now, GameScene.update() is empty.
    // The actual game update logic is still here temporarily.
    // It will not be called automatically anymore.
}

// Collision handler for player bullets hitting enemy tanks
function handlePlayerBulletEnemyCollision(bullet, enemy) {
    // This will be moved into GameScene and called with the scene context
    // 'this' refers to the scene context because it's passed in the collider setup
    if (bullet.active && enemy.active) {
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.stop();

        enemy.setActive(false);
        enemy.setVisible(false);
        enemy.body.stop();

        // Update score
        // Accessing 'this.score' and 'this.scoreText' will only work if these are properties of GameScene
        // and this function is correctly bound or is a method of GameScene.
        // For now, this might cause issues if called globally without proper context.
        if (this && this.score !== undefined) { // Temporary check
            this.score += 10;
            this.scoreText.setText('Score: ' + this.score);
        } else {
            console.warn("handlePlayerBulletEnemyCollision called without scene context for score update");
        }
    }
}

// Collision handler for enemy bullets hitting the player tank
function handleEnemyBulletPlayerCollision(player, bullet) {
    // Similar to above, this needs to be part of GameScene.
    if (bullet.active && player.active) {
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.stop();

        player.setActive(false);
        player.setVisible(false);
        player.body.stop();
        
        // Set game over state and show messages
        // Accessing 'this.isGameOver', etc., requires scene context.
        if (this && this.isGameOver !== undefined) { // Temporary check
            this.isGameOver = true;
            this.gameOverText.setVisible(true);
            this.restartText.setVisible(true);
        } else {
            console.warn("handleEnemyBulletPlayerCollision called without scene context for game over");
        }
    }
}
