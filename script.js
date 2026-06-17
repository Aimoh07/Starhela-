// Game Constants & Configuration
const MIN_MULTIPLIER = 1.00;
const MAX_MULTIPLIER = 1000.00;
let userBalance = 15000;
let gameHistory = [];
let highestMultiplierToday = 1.00;
let roundIdCounter = 1;

// Audio Context (Synthesized Sounds)
let audioCtx;
let soundEnabled = true;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, type, duration, vol=0.1) {
    if (!soundEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// UI Elements
const balanceEl = document.getElementById('user-balance');
const multDisplay = document.getElementById('multiplier-display');
const crashMsg = document.getElementById('crash-message');
const crashVal = document.getElementById('crash-val');
const countdownDisplay = document.getElementById('countdown-display');
const countdownVal = document.getElementById('countdown-val');
const historyTape = document.getElementById('history-tape');

// Betting State
const bets = {
    1: { active: false, amount: 0, cashedOut: false, win: 0 },
    2: { active: false, amount: 0, cashedOut: false, win: 0 }
};

// Game State Engine
const STATE = { WAITING: 0, FLYING: 1, CRASHED: 2 };
let currentState = STATE.WAITING;
let currentMultiplier = 1.00;
let targetCrash = 1.00;
let flightStartTime = 0;

// Canvas Setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let width, height;
let pathPoints = [];
let particles = [];
let stars = [];
let clouds = [];

function resizeCanvas() {
    width = canvas.width = canvas.parentElement.clientWidth;
    height = canvas.height = canvas.parentElement.clientHeight;
    initBackground();
}
window.addEventListener('resize', resizeCanvas);

// Background Elements
function initBackground() {
    stars = []; clouds = [];
    for(let i=0; i<50; i++) stars.push({x: Math.random()*width, y: Math.random()*height, size: Math.random()*2});
    for(let i=0; i<5; i++) clouds.push({x: Math.random()*width, y: Math.random()*height*0.5, speed: 0.2+Math.random()*0.5});
}

// Math logic to generate crash heavily favoring low numbers
function generateCrashPoint() {
    // Inverse transform sampling mapped for exponential curve
    const e = 0.99; 
    const r = Math.random();
    let raw = 1.00 / (1 - e * r);
    // 1% chance for a wildcard massive multiplier
    if (Math.random() > 0.99) raw += Math.random() * 500;
    return Math.min(Math.max(MIN_MULTIPLIER, raw), MAX_MULTIPLIER);
}

function updateBalanceDisplay() {
    balanceEl.innerText = `KSH ${Math.floor(userBalance).toLocaleString()}`;
}

// Betting Interface Logic
function adjustBet(panel, amount) {
    if (currentState === STATE.FLYING && bets[panel].active) return;
    const input = document.getElementById(`bet-input-${panel}`);
    let val = parseInt(input.value) + amount;
    if (val < 10) val = 10;
    if (val > 20000) val = 20000;
    input.value = val;
}

function quickBet(panel, type) {
    if (currentState === STATE.FLYING && bets[panel].active) return;
    const input = document.getElementById(`bet-input-${panel}`);
    let val = parseInt(input.value);
    if (type === 'half') val = Math.floor(val / 2);
    if (type === 'double') val = val * 2;
    if (type === 'max') val = 20000;
    if (val < 10) val = 10;
    if (val > 20000) val = 20000;
    input.value = val;
}

function toggleBet(panel) {
    initAudio();
    const btn = document.getElementById(`action-btn-${panel}`);
    const input = document.getElementById(`bet-input-${panel}`);
    const amount = parseInt(input.value);

    // If currently flying and user has an active bet, this acts as CASHOUT
    if (currentState === STATE.FLYING && bets[panel].active && !bets[panel].cashedOut) {
        const winAmount = amount * currentMultiplier;
        userBalance += winAmount;
        updateBalanceDisplay();
        bets[panel].cashedOut = true;
        bets[panel].win = winAmount;
        btn.innerText = `CASHED OUT KSH ${Math.floor(winAmount).toLocaleString()}`;
        btn.className = 'action-btn waiting';
        playTone(800, 'sine', 0.3, 0.2); // Cashout chime
        return;
    }

    // Placing or canceling a bet while waiting
    if (currentState === STATE.WAITING || currentState === STATE.CRASHED) {
        if (bets[panel].active) {
            // Cancel bet
            userBalance += bets[panel].amount;
            bets[panel].active = false;
            btn.innerText = 'BET';
            btn.className = 'action-btn bet';
        } else {
            // Place bet
            if (userBalance >= amount) {
                userBalance -= amount;
                bets[panel].active = true;
                bets[panel].amount = amount;
                bets[panel].cashedOut = false;
                btn.innerText = 'WAITING...';
                btn.className = 'action-btn waiting';
                playTone(400, 'square', 0.1, 0.05);
            } else {
                alert("Insufficient balance!");
            }
        }
        updateBalanceDisplay();
    }
}

function resetBettingPanels() {
    [1, 2].forEach(panel => {
        const btn = document.getElementById(`action-btn-${panel}`);
        if (bets[panel].active && !bets[panel].cashedOut) {
            // Lost bet
            bets[panel].active = false;
            btn.innerText = 'BET';
            btn.className = 'action-btn bet';
        } else if (bets[panel].active && bets[panel].cashedOut) {
            // Won bet, reset for next round
            bets[panel].active = false;
            btn.innerText = 'BET';
            btn.className = 'action-btn bet';
        }
    });
}

function updateBettingPanelsInFlight() {
    [1, 2].forEach(panel => {
        const btn = document.getElementById(`action-btn-${panel}`);
        if (bets[panel].active && !bets[panel].cashedOut) {
            const currentWin = bets[panel].amount * currentMultiplier;
            btn.innerText = `CASH OUT KSH ${Math.floor(currentWin).toLocaleString()}`;
            btn.className = 'action-btn cashout';
        }
    });
}

// Mock Live Feed Generator
const firstNames = ['John', 'Sarah', 'Mike', 'Emma', 'David', 'Chris', 'Kevin', 'Alice', 'Tom', 'Jane'];
const lastInitials = ['M.', 'K.', 'T.', 'R.', 'S.', 'W.', 'L.', 'B.', 'J.', 'P.'];
let livePlayers = [];

function generateFakePlayers() {
    livePlayers = [];
    const numPlayers = 5 + Math.floor(Math.random() * 10);
    for(let i=0; i<numPlayers; i++) {
        livePlayers.push({
            id: Math.random(),
            name: `${firstNames[Math.floor(Math.random()*firstNames.length)]} ${lastInitials[Math.floor(Math.random()*lastInitials.length)]}`,
            bet: 10 + Math.floor(Math.random()*5000),
            targetOut: 1.1 + Math.random()*10,
            status: 'active', // active, cashed, crashed
            outAmount: 0,
            outMult: 0
        });
    }
    document.getElementById('active-players-count').innerText = livePlayers.length;
}

function updateLiveFeed() {
    const feed = document.getElementById('live-feed');
    feed.innerHTML = '';
    
    // Process fake players
    if(currentState === STATE.FLYING) {
        livePlayers.forEach(p => {
            if(p.status === 'active' && currentMultiplier >= p.targetOut) {
                p.status = 'cashed';
                p.outMult = currentMultiplier;
                p.outAmount = p.bet * currentMultiplier;
            }
        });
    } else if (currentState === STATE.CRASHED) {
        livePlayers.forEach(p => {
            if(p.status === 'active') p.status = 'crashed';
        });
    }

    // Sort: Cashed highest amount first, then active highest bet
    let sorted = [...livePlayers].sort((a,b) => b.outAmount - a.outAmount || b.bet - a.bet);
    let topCashed = 0;

    sorted.forEach(p => {
        if(p.outAmount > topCashed) topCashed = p.outAmount;
        const div = document.createElement('div');
        div.className = `feed-item ${p.status}`;
        div.innerHTML = `
            <span class="feed-name">${p.name}</span>
            <span class="feed-bet">KSH ${p.bet.toLocaleString()}</span>
            <span class="feed-out">${p.status === 'cashed' ? `KSH ${Math.floor(p.outAmount).toLocaleString()} (${p.outMult.toFixed(2)}x)` : (p.status === 'crashed' ? '-' : 'Flying...')}</span>
        `;
        feed.appendChild(div);
    });

    document.getElementById('largest-cashout').innerText = `KSH ${Math.floor(topCashed).toLocaleString()}`;
}

// Game Loop & Rendering
function startGameLoop() {
    resizeCanvas();
    generateFakePlayers();
    startCountdown(5); // 5 seconds wait
    requestAnimationFrame(render);
}

function startCountdown(seconds) {
    currentState = STATE.WAITING;
    resetBettingPanels();
    pathPoints = [];
    particles = [];
    currentMultiplier = 1.00;
    multDisplay.innerText = "1.00x";
    multDisplay.className = "multiplier";
    crashMsg.classList.add('hidden');
    countdownDisplay.classList.remove('hidden');
    
    let timeLeft = seconds;
    countdownVal.innerText = `${timeLeft.toFixed(1)}s`;
    
    const interval = setInterval(() => {
        timeLeft -= 0.1;
        countdownVal.innerText = `${Math.max(0, timeLeft).toFixed(1)}s`;
        if (timeLeft <= 0) {
            clearInterval(interval);
            startFlight();
        }
    }, 100);
}

function startFlight() {
    currentState = STATE.FLYING;
    countdownDisplay.classList.add('hidden');
    targetCrash = generateCrashPoint();
    flightStartTime = performance.now();
    document.getElementById('round-id').innerText = `#DF-${String(roundIdCounter++).padStart(3, '0')}`;
    
    // Change Waiting buttons to Active bets
    [1, 2].forEach(panel => {
        const btn = document.getElementById(`action-btn-${panel}`);
        if(bets[panel].active) {
            btn.className = 'action-btn cashout';
            btn.innerText = 'CASH OUT';
        }
    });
}

function triggerCrash() {
    currentState = STATE.CRASHED;
    multDisplay.classList.add('crashed');
    crashMsg.classList.remove('hidden');
    crashVal.innerText = currentMultiplier.toFixed(2) + "x";
    playTone(150, 'sawtooth', 0.5, 0.5); // Explosion sound

    // Handle user lost bets
    resetBettingPanels();

    // Create explosion particles at last jet position
    const lastP = pathPoints[pathPoints.length-1] || {x: width/2, y: height/2};
    for(let i=0; i<30; i++) {
        particles.push({
            x: lastP.x, y: lastP.y,
            vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
            life: 1.0, color: Math.random()>0.5 ? '#ff2a2a' : '#ff7300'
        });
    }

    updateHistory(currentMultiplier);
    updateLiveFeed();

    setTimeout(() => {
        startCountdown(4);
    }, 3000);
}

function updateHistory(mult) {
    if (mult > highestMultiplierToday) {
        highestMultiplierToday = mult;
        document.getElementById('highest-today').innerText = highestMultiplierToday.toFixed(2) + "x";
    }
    gameHistory.unshift(mult);
    if(gameHistory.length > 20) gameHistory.pop();
    
    historyTape.innerHTML = '';
    gameHistory.forEach(m => {
        const span = document.createElement('span');
        let colorClass = m < 2 ? 'color-red' : (m < 10 ? 'color-orange' : 'color-green');
        span.className = `hist-pill ${colorClass}`;
        span.innerText = m.toFixed(2) + "x";
        historyTape.appendChild(span);
    });
}

function drawJet(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Draw futuristic jet shape (triangle/dart)
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-15, 10);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-15, -10);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#39ff14';
    ctx.fill();
    // Engine glow
    ctx.beginPath();
    ctx.arc(-12, 0, 4, 0, Math.PI*2);
    ctx.fillStyle = '#ff7300';
    ctx.fill();
    ctx.restore();
}

function render(time) {
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#1a2436';
    ctx.lineWidth = 1;
    for(let i=0; i<width; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,height); ctx.stroke(); }
    for(let i=0; i<height; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(width,i); ctx.stroke(); }

    // Draw background elements
    ctx.fillStyle = '#fff';
    stars.forEach(s => {
        ctx.globalAlpha = Math.random()*0.5 + 0.5;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a3441';
    clouds.forEach(c => {
        c.x -= c.speed;
        if(c.x < -100) c.x = width + 100;
        ctx.beginPath(); ctx.arc(c.x, c.y, 20, 0, Math.PI*2); ctx.arc(c.x+20, c.y-10, 25, 0, Math.PI*2); ctx.arc(c.x+40, c.y, 20, 0, Math.PI*2); ctx.fill();
    });

    if (currentState === STATE.FLYING) {
        // Calculate exponential growth based on time
        const elapsed = (time - flightStartTime) / 1000;
        // Function: multiplier grows exponentially
        currentMultiplier = Math.pow(Math.E, 0.08 * elapsed);

        if (currentMultiplier >= targetCrash) {
            currentMultiplier = targetCrash;
            triggerCrash();
        } else {
            multDisplay.innerText = currentMultiplier.toFixed(2) + "x";
            updateBettingPanelsInFlight();
            if(Math.floor(elapsed*10)%2===0) updateLiveFeed(); // Throttle live feed updates
            
            // Engine hum increasing in pitch
            if (soundEnabled && Math.floor(time)%10 === 0) {
                // We use small beeps to simulate engine since continuous osc requires careful state management
                playTone(100 + currentMultiplier*5, 'sine', 0.1, 0.02);
            }

            // Path calculation
            const progressX = Math.min(1, elapsed / 10); // reaches far right near 10s
            const jetX = 50 + progressX * (width - 100);
            // Graph curve mapping
            const logMax = Math.log(MAX_MULTIPLIER);
            const logCur = Math.log(currentMultiplier);
            const relativeY = logCur / (logCur + 1); // Curve smoothing
            const jetY = height - 50 - (relativeY * (height - 100));

            pathPoints.push({x: jetX, y: jetY});
            
            // Draw Trail
            if (pathPoints.length > 1) {
                ctx.beginPath();
                ctx.moveTo(pathPoints[0].x, height);
                pathPoints.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.lineTo(jetX, height);
                ctx.fillStyle = 'rgba(57, 255, 20, 0.1)';
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
                pathPoints.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.strokeStyle = '#39ff14';
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            // Calculate angle for jet
            let angle = 0;
            if(pathPoints.length > 2) {
                const p1 = pathPoints[pathPoints.length-2];
                const p2 = pathPoints[pathPoints.length-1];
                angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            }
            drawJet(jetX, jetY, angle);
        }
    } else if (currentState === STATE.CRASHED) {
        // Draw path but no jet
        if (pathPoints.length > 1) {
            ctx.beginPath();
            ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
            pathPoints.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.strokeStyle = '#ff2a2a';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        // Animate particles
        particles.forEach((p, index) => {
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.02;
            if(p.life <= 0) { particles.splice(index, 1); return; }
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    requestAnimationFrame(render);
}

// Event Listeners & Initialization
document.getElementById('sound-btn').addEventListener('click', function() {
    soundEnabled = !soundEnabled;
    this.innerText = soundEnabled ? '🔊' : '🔇';
    initAudio();
});

// Modal Logic
const modal = document.getElementById('history-modal');
document.getElementById('history-btn').addEventListener('click', () => {
    modal.classList.remove('hidden');
    const histList = document.getElementById('modal-history-list');
    histList.innerHTML = historyTape.innerHTML; // Copy HTML from tape
    if(gameHistory.length > 0) {
        document.getElementById('stat-high').innerText = Math.max(...gameHistory).toFixed(2) + "x";
        document.getElementById('stat-low').innerText = Math.min(...gameHistory).toFixed(2) + "x";
        document.getElementById('stat-avg').innerText = (gameHistory.reduce((a,b)=>a+b,0)/gameHistory.length).toFixed(2) + "x";
    }
});
document.getElementById('close-modal').addEventListener('click', () => modal.classList.add('hidden'));

// Boot sequence
window.onload = () => {
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
            startGameLoop();
        }, 500);
    }, 2000); // 2 second loading screen
};
