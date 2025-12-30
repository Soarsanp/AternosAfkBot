// index.js - Optimized Aternos AFK Bot

const mineflayer = require('mineflayer');
const pvp = require('mineflayer-pvp').plugin;
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const armorManager = require('mineflayer-armor-manager');
const cmd = require('mineflayer-cmd').plugin;
const fs = require('fs');
const express = require('express');

// Load config
let rawdata = fs.readFileSync('config.json');
let data = JSON.parse(rawdata);

const host = data.ip || data.server || "localhost";
const username = data.name || "Bot";
const nightskip = data["auto-night-skip"] === "true";
const loginEnabled = data["login-enabled"] === "true";

let death = 0;
let simp = 0;
let popularity = 0;
let pvpc = 0;

// Movement vars
let lasttime = -1;
let moving = 0;
let first = false;
let connected = 0;
let actions = ['forward', 'back', 'left', 'right'];
let lastaction;
const pi = 3.14159;
const moveinterval = 2; // seconds
const maxrandom = 5; // seconds

// Create bot
const bot = mineflayer.createBot({
    host: host,
    port: data.port,
    username: username,
    logErrors: false
});

// Load plugins
bot.loadPlugin(cmd);
bot.loadPlugin(pvp);
bot.loadPlugin(armorManager);
bot.loadPlugin(pathfinder);

// Login handler
bot.on('login', () => {
    console.log("Logged in as", username);

    if (loginEnabled) {
        bot.chat(data["login-cmd"]);
        setTimeout(() => {
            bot.chat(data["register-cmd"]);
        }, 2000);
    }

    // Scheduled task messages
    for (let i = 0; i < 10; i++) {
        task(i);
    }

    bot.chat("Hello!");
});

// Task function - repeating message
function task(i) {
    setTimeout(() => {
        if (first) {
            bot.chat("Support the Project https://github.com/healer-op/AternosAfkBot");
            first = false;
        } else {
            bot.chat("Support the Project https://github.com/healer-op/AternosAfkBot");
            first = true;
        }
    }, 3600000 * i); // every hour
}

// Time handler for auto-night skip & random movement
bot.on('time', () => {
    if (nightskip && bot.time.timeOfDay >= 13000) {
        bot.chat('/time set day');
    }

    if (connected < 1) return;

    if (lasttime < 0) {
        lasttime = bot.time.age;
    } else {
        const randomadd = Math.random() * maxrandom * 20;
        const interval = moveinterval * 20 + randomadd;

        if (bot.time.age - lasttime > interval) {
            if (moving === 1) {
                bot.setControlState(lastaction, false);
                moving = 0;
            } else {
                const yaw = Math.random() * pi - (0.5 * pi);
                const pitch = Math.random() * pi - (0.5 * pi);
                bot.look(yaw, pitch, false);
                lastaction = actions[Math.floor(Math.random() * actions.length)];
                bot.setControlState(lastaction, true);
                moving = 1;
                bot.activateItem();
            }
            lasttime = bot.time.age;
        }
    }
});

// Bot spawned
bot.on('spawn', () => {
    connected = 1;
});

// Death handler
bot.on('death', () => {
    death++;
    bot.emit("respawn");
});

// Auto-equip items
bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return;

    setTimeout(() => {
        const sword = bot.inventory.items().find(item => item.name.includes('sword'));
        if (sword) bot.equip(sword, 'hand');
    }, 150);

    setTimeout(() => {
        const shield = bot.inventory.items().find(item => item.name.includes('shield'));
        if (shield) bot.equip(shield, 'off-hand');
    }, 250);
});

// Guarding
let guardPos = null;

function guardArea(pos) {
    guardPos = pos.clone();
    if (!bot.pvp.target) moveToGuardPos();
}

function stopGuarding() {
    guardPos = null;
    bot.pvp.stop();
    bot.pathfinder.setGoal(null);
}

function moveToGuardPos() {
    const mcData = require('minecraft-data')(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z));
}

// PVP & guard handling
bot.on('stoppedAttacking', () => {
    if (guardPos) moveToGuardPos();
});

bot.on('physicTick', () => {
    if (bot.pvp.target || bot.pathfinder.isMoving()) return;

    const entity = bot.nearestEntity();
    if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0));
});

bot.on('physicTick', () => {
    if (!guardPos) return;

    const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 16 &&
        e.mobType !== 'Armor Stand';
    const entity = bot.nearestEntity(filter);
    if (entity) bot.pvp.attack(entity);
});

// Chat commands
bot.on('chat', (username, message) => {
    if (username === bot.username) return;

    const msg = message.toLowerCase();

    if (msg.includes(`hi ${bot.username}`) || msg.includes(`${bot.username} hi`) || msg.includes(`hello ${bot.username}`)) {
        popularity++;
        bot.chat(`Hi ${username}`);
    }

    if (msg === `hi ${bot.username} i am a girl`) {
        simp++;
        bot.chat(`Hi ${username} my girl :smirk:`);
        bot.chat(`hru qt`);
    }

    if (msg === `${bot.username} help` || msg === `help ${bot.username}`) {
        bot.chat(`Hi ${username}, here are my commands:`);
        bot.chat(`fight me ${bot.username}`);
        bot.chat(`guard ${bot.username}`);
        bot.chat(`stop`);
        bot.chat(`Made by https://github.com/healer-op/AternosAfkBot`);
    }

    if (msg === `guard ${bot.username}`) {
        const player = bot.players[username];
        if (!player) return bot.chat(`I can't see you, ${username} Master!`);
        bot.chat(`I will guard that location, ${username}`);
        guardArea(player.entity.position);
    }

    if (msg === `fight me ${bot.username}`) {
        const player = bot.players[username];
        if (!player) return bot.chat(`I can't see you, ${username} Loser!`);
        bot.chat(`Prepare to fight! ${username}`);
        pvpc++;
        bot.pvp.attack(player.entity);
    }

    if (msg === 'stop') {
        bot.chat('I will no longer guard this area.');
        stopGuarding();
    }
});

// KeepAlive Webserver
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send(`
        <b>${username}</b> is Online At <b>${host}</b><br>
        <br>Death Counter: <b>${death}</b>
        <br>Simp Counter: <b>${simp}</b>
        <br>Popularity Counter: <b>${popularity}</b>
        <br>PVP Counter: <b>${pvpc}</b>
        <br>Made By <b>https://github.com/healer-op/AternosAfkBot</b>
    `);
});

app.listen(port, () => {
    console.log(`KeepAlive server running at http://localhost:${port}`);
});// index.js - Optimized Aternos AFK Bot

const mineflayer = require('mineflayer');
const pvp = require('mineflayer-pvp').plugin;
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const armorManager = require('mineflayer-armor-manager');
const cmd = require('mineflayer-cmd').plugin;
const fs = require('fs');
const express = require('express');

// Load config
let rawdata = fs.readFileSync('config.json');
let data = JSON.parse(rawdata);

const host = data.ip || data.server || "localhost";
const username = data.name || "Bot";
const nightskip = data["auto-night-skip"] === "true";
const loginEnabled = data["login-enabled"] === "true";

let death = 0;
let simp = 0;
let popularity = 0;
let pvpc = 0;

// Movement vars
let lasttime = -1;
let moving = 0;
let first = false;
let connected = 0;
let actions = ['forward', 'back', 'left', 'right'];
let lastaction;
const pi = 3.14159;
const moveinterval = 2; // seconds
const maxrandom = 5; // seconds

// Create bot
const bot = mineflayer.createBot({
    host: host,
    port: data.port,
    username: username,
    logErrors: false
});

// Load plugins
bot.loadPlugin(cmd);
bot.loadPlugin(pvp);
bot.loadPlugin(armorManager);
bot.loadPlugin(pathfinder);

// Login handler
bot.on('login', () => {
    console.log("Logged in as", username);

    if (loginEnabled) {
        bot.chat(data["login-cmd"]);
        setTimeout(() => {
            bot.chat(data["register-cmd"]);
        }, 2000);
    }

    // Scheduled task messages
    for (let i = 0; i < 10; i++) {
        task(i);
    }

    bot.chat("Hello!");
});

// Task function - repeating message
function task(i) {
    setTimeout(() => {
        if (first) {
            bot.chat("Support the Project https://github.com/healer-op/AternosAfkBot");
            first = false;
        } else {
            bot.chat("Support the Project https://github.com/healer-op/AternosAfkBot");
            first = true;
        }
    }, 3600000 * i); // every hour
}

// Time handler for auto-night skip & random movement
bot.on('time', () => {
    if (nightskip && bot.time.timeOfDay >= 13000) {
        bot.chat('/time set day');
    }

    if (connected < 1) return;

    if (lasttime < 0) {
        lasttime = bot.time.age;
    } else {
        const randomadd = Math.random() * maxrandom * 20;
        const interval = moveinterval * 20 + randomadd;

        if (bot.time.age - lasttime > interval) {
            if (moving === 1) {
                bot.setControlState(lastaction, false);
                moving = 0;
            } else {
                const yaw = Math.random() * pi - (0.5 * pi);
                const pitch = Math.random() * pi - (0.5 * pi);
                bot.look(yaw, pitch, false);
                lastaction = actions[Math.floor(Math.random() * actions.length)];
                bot.setControlState(lastaction, true);
                moving = 1;
                bot.activateItem();
            }
            lasttime = bot.time.age;
        }
    }
});

// Bot spawned
bot.on('spawn', () => {
    connected = 1;
});

// Death handler
bot.on('death', () => {
    death++;
    bot.emit("respawn");
});

// Auto-equip items
bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return;

    setTimeout(() => {
        const sword = bot.inventory.items().find(item => item.name.includes('sword'));
        if (sword) bot.equip(sword, 'hand');
    }, 150);

    setTimeout(() => {
        const shield = bot.inventory.items().find(item => item.name.includes('shield'));
        if (shield) bot.equip(shield, 'off-hand');
    }, 250);
});

// Guarding
let guardPos = null;

function guardArea(pos) {
    guardPos = pos.clone();
    if (!bot.pvp.target) moveToGuardPos();
}

function stopGuarding() {
    guardPos = null;
    bot.pvp.stop();
    bot.pathfinder.setGoal(null);
}

function moveToGuardPos() {
    const mcData = require('minecraft-data')(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z));
}

// PVP & guard handling
bot.on('stoppedAttacking', () => {
    if (guardPos) moveToGuardPos();
});

bot.on('physicTick', () => {
    if (bot.pvp.target || bot.pathfinder.isMoving()) return;

    const entity = bot.nearestEntity();
    if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0));
});

bot.on('physicTick', () => {
    if (!guardPos) return;

    const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 16 &&
        e.mobType !== 'Armor Stand';
    const entity = bot.nearestEntity(filter);
    if (entity) bot.pvp.attack(entity);
});

// Chat commands
bot.on('chat', (username, message) => {
    if (username === bot.username) return;

    const msg = message.toLowerCase();

    if (msg.includes(`hi ${bot.username}`) || msg.includes(`${bot.username} hi`) || msg.includes(`hello ${bot.username}`)) {
        popularity++;
        bot.chat(`Hi ${username}`);
    }

    if (msg === `hi ${bot.username} i am a girl`) {
        simp++;
        bot.chat(`Hi ${username} my girl :smirk:`);
        bot.chat(`hru qt`);
    }

    if (msg === `${bot.username} help` || msg === `help ${bot.username}`) {
        bot.chat(`Hi ${username}, here are my commands:`);
        bot.chat(`fight me ${bot.username}`);
        bot.chat(`guard ${bot.username}`);
        bot.chat(`stop`);
        bot.chat(`Made by https://github.com/healer-op/AternosAfkBot`);
    }

    if (msg === `guard ${bot.username}`) {
        const player = bot.players[username];
        if (!player) return bot.chat(`I can't see you, ${username} Master!`);
        bot.chat(`I will guard that location, ${username}`);
        guardArea(player.entity.position);
    }

    if (msg === `fight me ${bot.username}`) {
        const player = bot.players[username];
        if (!player) return bot.chat(`I can't see you, ${username} Loser!`);
        bot.chat(`Prepare to fight! ${username}`);
        pvpc++;
        bot.pvp.attack(player.entity);
    }

    if (msg === 'stop') {
        bot.chat('I will no longer guard this area.');
        stopGuarding();
    }
});

// KeepAlive Webserver
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send(`
        <b>${username}</b> is Online At <b>${host}</b><br>
        <br>Death Counter: <b>${death}</b>
        <br>Simp Counter: <b>${simp}</b>
        <br>Popularity Counter: <b>${popularity}</b>
        <br>PVP Counter: <b>${pvpc}</b>
        <br>Made By <b>https://github.com/healer-op/AternosAfkBot</b>
    `);
});

app.listen(port, () => {
    console.log(`KeepAlive server running at http://localhost:${port}`);
});
