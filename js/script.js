const SUPABASE_URL = 'https://tsweufcmgrcjtgiqlcji.supabase.co';
// Your actual key is locked and loaded
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzd2V1ZmNtZ3JjanRnaXFsY2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODA5MDQsImV4cCI6MjA5MjM1NjkwNH0.dMDqj_n0_w3sURSRo-_EOtrvLc5p8fu6WsAT7bs8qLI'; 

let supabaseClient;
let currentUser = null;
let currentUserRole = 'student'; // Used to calculate the progress bar percentage
let currentBalance = 0;

try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
    console.error("Supabase failed to load.", err);
}

const formatMoney = (amount) => `₩${parseInt(amount).toLocaleString()}`;

// ==========================================
// 1. AUTHENTICATION, PROFILE & ANIMATION UTILS
// ==========================================
let prevData = {
    balance: 0,
    globalInvested: 0,
    globalInvestors: 0,
    ventures: {},      // Stores { invested, investors } by venture ID
    leaderboard: {}    // Stores scores by venture title
};

// The Magic Number Roller Function
function animateNumber(element, start, end, duration, formatType = 'money') {
    // FIX: If the numbers are the same, don't animate, but FORCE the text to update 
    // so it doesn't get stuck on the HTML default of "₩0"
    if (start === end) {
        element.innerText = formatType === 'money' ? formatMoney(end) : end;
        return; 
    }
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing function for that buttery smooth slow-down at the end
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(easeProgress * (end - start) + start);

        element.innerText = formatType === 'money' ? formatMoney(current) : current;

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            // Guarantee it ends on the exact correct number
            element.innerText = formatType === 'money' ? formatMoney(end) : end;
        }
    };
    window.requestAnimationFrame(step);
}

window.handleGoogleLogin = async function() {
    if (!supabaseClient) return;
    const cleanRedirectUrl = window.location.origin + window.location.pathname;
    await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: cleanRedirectUrl } });
};

async function initializeUser(user) {
    currentUser = user;
    
    // 1. Try to fetch the user's profile and money
    let { data: dbUser, error } = await supabaseClient.from('users').select('*').eq('id', user.id).single();
    
    // 2. THE AUTO-HEALER: If they exist in Google Auth but got deleted from our public table
    if (error && error.code === 'PGRST116') { // PGRST116 is the Supabase error for "Row not found"
        console.warn("User missing from public database. Auto-healing...");
        
        const isJudge = ['ahn.david@faystonsongdo.org', 'song.stephanie@faystonsongdo.org', 'lim.isaac@faystonsongdo.org', 'chiok.taylor@faystonsongdo.org'].includes(user.email);
        
        const newProfile = {
            id: user.id,
            email: user.email,
            balance: isJudge ? 10000000 : 500000,
            role: isJudge ? 'judge' : 'student'
        };
        
        // Quietly insert them back into the public table
        await supabaseClient.from('users').insert([newProfile]);
        
        // Assign the new profile so the script can keep running
        dbUser = newProfile; 
        
    } else if (error) {
        // If it's some other random network error, stop and log it
        return console.error("Error fetching user data:", error);
    }

    // 3. Continue the boot-up sequence normally
    currentUserRole = dbUser.role; 
    updateBalanceUI(dbUser.balance, true);
    fetchDashboardData();
    setupRealtime(); 
}

function updateBalanceUI(newBalance, isInitialLoad = false) {
    const mainBalanceEl = document.querySelector('.balance-info h3');
    const heroBalanceEl = document.querySelector('.hero-text .highlight-text');
    
    // Animate the text
    if (mainBalanceEl) animateNumber(mainBalanceEl, prevData.balance, newBalance, 1000, 'money');
    if (heroBalanceEl) animateNumber(heroBalanceEl, prevData.balance, newBalance, 1000, 'money');

    // Update Progress Bar
    const startingBalance = currentUserRole === 'judge' ? 10000000 : 500000;
    const percent = Math.max(0, (newBalance / startingBalance) * 100).toFixed(0);
    
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        // If initial load, start bar at 0 and grow it. Otherwise just update smoothly.
        if (isInitialLoad) {
            progressBar.style.width = '0%';
            setTimeout(() => progressBar.style.width = `${percent}%`, 100);
        } else {
            progressBar.style.width = `${percent}%`;
        }
    }
    
    const progressLabel = document.querySelector('.progress-label');
    if (progressLabel) progressLabel.innerText = `${percent}% remaining`;

    currentBalance = newBalance;
    prevData.balance = newBalance; // Save for next time
}

// ==========================================
// 2. FETCHING & RENDERING DATA (WITH ANIMATIONS)
// ==========================================
async function fetchDashboardData() {
    const { data: ventures } = await supabaseClient.from('ventures').select('*').order('total_invested', { ascending: false });
    const { data: investments } = await supabaseClient.from('investments').select('*');

    const { data: myInvestments } = await supabaseClient
        .from('investments')
        .select(`amount, ventures ( title )`)
        .eq('user_id', currentUser.id);

    // Calculate Global Stats
    let totalInvestedGlobal = 0;
    const uniqueInvestors = new Set();
    
    investments.forEach(inv => {
        totalInvestedGlobal += Number(inv.amount);
        uniqueInvestors.add(inv.user_id);
    });

    const activeVenturesCount = ventures.length;

    // Animate Top Stats
    const elTotalInvested = document.getElementById('stat-total-invested');
    const elTotalInvestors = document.getElementById('stat-total-investors');
    const elActiveVentures = document.getElementById('stat-active-ventures');

    if (elTotalInvested) animateNumber(elTotalInvested, prevData.globalInvested, totalInvestedGlobal, 1200, 'money');
    if (elTotalInvestors) animateNumber(elTotalInvestors, prevData.globalInvestors, uniqueInvestors.size, 1200, 'number');
    // Active ventures rarely change live, but we'll animate it on load
    if (elActiveVentures) animateNumber(elActiveVentures, 0, activeVenturesCount, 1200, 'number'); 

    // Update memory
    prevData.globalInvested = totalInvestedGlobal;
    prevData.globalInvestors = uniqueInvestors.size;

    renderVentures(ventures);
    renderLeaderboard(ventures);
    renderMyInvestments(myInvestments); 
}

function renderVentures(ventures) {
    const container = document.getElementById('dynamic-ventures');
    if (!container) return;
    container.innerHTML = ''; 

    ventures.forEach((v, index) => {
        const card = document.createElement('div');
        // Add staggered fade-in to the cards
        card.className = `venture-card glass-panel animate-up delay-${(index % 4) + 1}`;
        
        // Grab old values to animate from, default to 0 if new
        const oldInvested = prevData.ventures[v.id]?.invested || 0;
        const oldInvestors = prevData.ventures[v.id]?.investors || 0;

        card.innerHTML = `
            <div class="venture-header">
                <div class="v-icon"><i class="ph-duotone ph-laptop"></i></div>
                <div class="v-info">
                    <h4>${v.title}</h4>
                    <p>${v.description}</p>
                    <span class="tag"><i class="ph ph-tag"></i> ${v.category}</span>
                </div>
            </div>
            <div class="venture-stats">
                <div class="v-stat">
                    <span class="v-stat-label"><i class="ph ph-trend-up"></i> MONEY INVESTED</span>
                    <span class="v-stat-val highlight-text" id="v-invested-${v.id}">₩0</span>
                </div>
                <div class="v-stat">
                    <span class="v-stat-label"><i class="ph ph-users"></i> INVESTORS</span>
                    <span class="v-stat-val" id="v-investors-${v.id}">0</span>
                </div>
            </div>
            <button class="invest-btn epic-btn" onclick="investInVenture('${v.id}', '${v.title}')">
                <i class="ph-bold ph-currency-dollar"></i> Invest Now
            </button>
        `;
        container.appendChild(card);

        // Trigger animations immediately after appending to DOM
        animateNumber(document.getElementById(`v-invested-${v.id}`), oldInvested, v.total_invested, 1000, 'money');
        animateNumber(document.getElementById(`v-investors-${v.id}`), oldInvestors, v.investor_count, 1000, 'number');

        // Update memory
        prevData.ventures[v.id] = { invested: v.total_invested, investors: v.investor_count };
    });
}

function renderLeaderboard(ventures) {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = ''; 
    const medalColors = ['#fbbf24', '#9ca3af', '#b45309']; 

    ventures.forEach((v, index) => {
        const oldScore = prevData.leaderboard[v.title] || 0;

        const rankDisplay = index < 3 
            ? `<i class="ph-fill ph-medal" style="color: ${medalColors[index]}; font-size: 18px; margin-right: 8px;"></i>` 
            : `<span class="medal-text" style="margin-right: 8px;">#${index + 1}</span>`;
            
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="rank" style="display:flex; align-items:center;">${rankDisplay} ${v.title}</div>
            <div class="score highlight-text" id="lb-score-${index}">₩0</div>
        `;
        list.appendChild(li);

        // Animate Leaderboard numbers
        animateNumber(document.getElementById(`lb-score-${index}`), oldScore, v.total_invested, 1000, 'money');

        // Update memory
        prevData.leaderboard[v.title] = v.total_invested;
    });
}

function renderMyInvestments(myInvestments) {
    const list = document.getElementById('my-investments-list');
    if (!list) return;

    if (!myInvestments || myInvestments.length === 0) {
        list.innerHTML = `<li class="empty-state"><i class="ph-duotone ph-leaf"></i> No investments yet.</li>`;
        return;
    }

    const groupedInvestments = {};
    myInvestments.forEach(inv => {
        const title = inv.ventures.title;
        groupedInvestments[title] = (groupedInvestments[title] || 0) + Number(inv.amount);
    });

    list.innerHTML = ''; 

    Object.entries(groupedInvestments).forEach(([title, totalAmount], index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="rank"><i class="ph-fill ph-plant" style="color: var(--accent-green); margin-right: 8px;"></i> ${title}</div>
            <div class="score highlight-text" id="my-inv-${index}">₩0</div>
        `;
        list.appendChild(li);

        // Assuming you want these animated on load too (starting from 0)
        animateNumber(document.getElementById(`my-inv-${index}`), 0, totalAmount, 1000, 'money');
    });
}

// ==========================================
// 3. INVESTMENT LOGIC (MODAL)
// ==========================================
let activeVentureId = null;
let activeVentureTitle = null;

// This triggers when the user clicks "Invest Now" on a card
window.investInVenture = function(ventureId, ventureTitle) {
    activeVentureId = ventureId;
    activeVentureTitle = ventureTitle;
    
    // Populate modal data
    document.getElementById('modal-venture-title').innerText = `Invest in ${ventureTitle}`;
    document.getElementById('modal-current-balance').innerText = formatMoney(currentBalance);
    document.getElementById('invest-amount-input').value = ''; // Clear old input
    
    // Show modal
    document.getElementById('invest-modal-overlay').style.display = 'flex';
};

// Modal Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    const modalOverlay = document.getElementById('invest-modal-overlay');
    const cancelBtn = document.getElementById('cancel-invest-btn');
    const confirmBtn = document.getElementById('confirm-invest-btn');
    const amountInput = document.getElementById('invest-amount-input');

    // Close Modal
    cancelBtn.addEventListener('click', () => {
        modalOverlay.style.display = 'none';
        activeVentureId = null;
    });

    // Execute Investment
    confirmBtn.addEventListener('click', async () => {
        const amount = parseInt(amountInput.value.replace(/,/g, ''));
        
        // Frontend Validation using Toasts
        if (isNaN(amount) || amount <= 0) {
            return showToast("Please enter a valid number.", "error");
        }
        if (amount > currentBalance) {
            return showToast("Insufficient funds! Check your balance.", "error");
        }
        
        // Disable button to prevent double-clicking
        confirmBtn.innerText = "Processing...";
        confirmBtn.disabled = true;

        try {
            // FIRE THE SECURE DATABASE FUNCTION
            const { error } = await supabaseClient.rpc('process_investment', {
                p_venture_id: activeVentureId,
                p_amount: amount
            });

            // If the database rejects it, throw the error
            if (error) throw error;

            // Success! Close modal and show success toast
            modalOverlay.style.display = 'none';
            showToast(`Successfully invested ${formatMoney(amount)} into ${activeVentureTitle}!`, "success");
            
        } catch (error) {
            console.error("Investment failed:", error);
            showToast("Transaction failed! The bank rejected the transfer.", "error");
        } finally {
            // Re-enable button
            confirmBtn.innerText = "Confirm Investment";
            confirmBtn.disabled = false;
        }
    });
});

// ==========================================
// 4. REAL-TIME LIVE SYNC & KILL SWITCH
// ==========================================
function setupRealtime() {
    supabaseClient.channel('custom-all-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ventures' }, () => {
            fetchDashboardData(); 
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
            if (payload.new.id === currentUser.id) {
                updateBalanceUI(payload.new.balance);
            }
        })
        // THE GLOBAL KILL SWITCH: Listens for Admin Account Wipes
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'users' }, async (payload) => {
            if (currentUser && payload.old.id === currentUser.id) {
                console.warn("Account wiped by Admin. Forcing logout...");
                await supabaseClient.auth.signOut();
                window.location.reload(); // Instantly kicks them to the login screen
            }
        })
        .subscribe();
}

// ==========================================
// 5. STARTUP LISTENER
// ==========================================
let isAppInitialized = false; // THE FIX: Our security lock

document.addEventListener("DOMContentLoaded", () => {
    const loginScreen = document.getElementById('login-screen');
    const dashboardWrapper = document.getElementById('dashboard-wrapper');

    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (session && session.user.email.endsWith('@faystonsongdo.org')) {
                // 1. Show the dashboard
                loginScreen.style.display = 'none';
                dashboardWrapper.style.display = 'block';
                
                // 2. ONLY run the boot-up sequence if it hasn't run yet!
                if (!isAppInitialized) {
                    initializeUser(session.user);
                    isAppInitialized = true; // Lock the door behind us
                }
            } else {
                // If they log out or session expires, kick them back to login
                loginScreen.style.display = 'flex';
                dashboardWrapper.style.display = 'none';
                isAppInitialized = false; // Reset the lock
            }
        });
    }

    // Logout Button
    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (supabaseClient) await supabaseClient.auth.signOut();
        window.location.reload(); 
    });
});

// ==========================================
// TOAST NOTIFICATION HELPER
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' 
        ? '<i class="ph-fill ph-check-circle" style="color: var(--accent-green); font-size: 20px;"></i>' 
        : '<i class="ph-fill ph-warning-circle" style="color: #ef4444; font-size: 20px;"></i>';
        
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}