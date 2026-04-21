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
// 1. AUTHENTICATION & PROFILE INITIALIZATION
// ==========================================
window.handleGoogleLogin = async function() {
    if (!supabaseClient) return;
    const cleanRedirectUrl = window.location.origin + window.location.pathname;
    await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: cleanRedirectUrl } });
};

async function initializeUser(user) {
    currentUser = user;
    
    const { data: dbUser, error } = await supabaseClient.from('users').select('*').eq('id', user.id).single();
    
    if (error) {
        console.error("Error fetching user data:", error);
        return;
    }

    currentUserRole = dbUser.role; // Save role so we know if they started with 10M or 500k
    updateBalanceUI(dbUser.balance);
    fetchDashboardData();
    setupRealtime(); 
}

function updateBalanceUI(balance) {
    currentBalance = balance;
    
    // 1. Update the Text Numbers
    const mainBalanceEl = document.querySelector('.balance-info h3');
    if (mainBalanceEl) mainBalanceEl.innerText = formatMoney(balance);
    
    const heroBalance = document.querySelector('.hero-text .highlight-text');
    if (heroBalance) heroBalance.innerText = formatMoney(balance);

    // 2. Update the Progress Bar
    const startingBalance = currentUserRole === 'judge' ? 10000000 : 500000;
    const percent = Math.max(0, (balance / startingBalance) * 100).toFixed(0);
    
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) progressBar.style.width = `${percent}%`;
    
    const progressLabel = document.querySelector('.progress-label');
    if (progressLabel) progressLabel.innerText = `${percent}% remaining`;
}

// ==========================================
// 2. FETCHING & RENDERING DATA
// ==========================================
async function fetchDashboardData() {
    // The database natively sorts them by total invested, highest to lowest!
    const { data: ventures } = await supabaseClient.from('ventures').select('*').order('total_invested', { ascending: false });
    const { data: investments } = await supabaseClient.from('investments').select('*');

    // Calculate Global Stats
    let totalInvestedGlobal = 0;
    const uniqueInvestors = new Set();
    
    investments.forEach(inv => {
        totalInvestedGlobal += Number(inv.amount);
        uniqueInvestors.add(inv.user_id);
    });

    // Update Top Stats UI
    document.querySelectorAll('.stat-card h3')[0].innerText = formatMoney(totalInvestedGlobal); 
    document.querySelectorAll('.stat-card h3')[1].innerText = uniqueInvestors.size; 
    document.querySelectorAll('.stat-card h3')[2].innerText = ventures.length; 

    // Render the UI with the newly sorted data
    renderVentures(ventures);
    renderLeaderboard(ventures);
}

function renderLeaderboard(ventures) {
    const list = document.querySelector('.leaderboard-list');
    if (!list) return;
    
    list.innerHTML = ''; // Clear out the hardcoded HTML

    const medals = ['🥇', '🥈', '🥉'];

    ventures.forEach((v, index) => {
        // Assign a medal to the top 3, and a number to the rest
        const rankDisplay = index < 3 ? `<span class="medal">${medals[index]}</span>` : `<span class="medal-text">#${index + 1}</span>`;
        
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="rank">${rankDisplay} ${v.title}</div>
            <div class="score highlight-text">${formatMoney(v.total_invested)}</div>
        `;
        list.appendChild(li);
    });
}

function renderVentures(ventures) {
    const container = document.getElementById('dynamic-ventures');
    if (!container) return;
    
    container.innerHTML = ''; 

    ventures.forEach(v => {
        const card = document.createElement('div');
        card.className = 'venture-card';
        card.innerHTML = `
            <div class="venture-header">
                <div class="v-icon">💻</div>
                <div class="v-info">
                    <h4>${v.title}</h4>
                    <p>${v.description}</p>
                    <span class="tag">${v.category}</span>
                </div>
            </div>
            <div class="venture-stats">
                <div class="v-stat">
                    <span class="v-stat-label">📈 MONEY INVESTED</span>
                    <span class="v-stat-val highlight-text">${formatMoney(v.total_invested)}</span>
                </div>
                <div class="v-stat">
                    <span class="v-stat-label">👥 INVESTORS</span>
                    <span class="v-stat-val">${v.investor_count}</span>
                </div>
            </div>
            <button class="invest-btn" onclick="investInVenture('${v.id}', '${v.title}')">💰 Invest Now</button>
        `;
        container.appendChild(card);
    });
}

// ==========================================
// 3. INVESTMENT LOGIC
// ==========================================
window.investInVenture = async function(ventureId, ventureTitle) {
    const amountStr = prompt(`Investing in ${ventureTitle}\nYour Balance: ${formatMoney(currentBalance)}\n\nEnter amount to invest (numbers only):`);
    
    if (!amountStr) return; 
    
    const amount = parseInt(amountStr.replace(/,/g, ''));
    
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid number.");
    if (amount > currentBalance) return alert("Insufficient funds!");

    // 1. Deduct from User 
    const newBalance = currentBalance - amount;
    await supabaseClient.from('users').update({ balance: newBalance }).eq('id', currentUser.id);

    // 2. Add to Venture
    const { data: venture } = await supabaseClient.from('ventures').select('*').eq('id', ventureId).single();
    await supabaseClient.from('ventures').update({ 
        total_invested: Number(venture.total_invested) + amount,
        investor_count: venture.investor_count + 1 
    }).eq('id', ventureId);

    // 3. Log Investment
    await supabaseClient.from('investments').insert({
        user_id: currentUser.id,
        venture_id: ventureId,
        amount: amount
    });

    alert(`Successfully invested ${formatMoney(amount)} into ${ventureTitle}!`);
};

// ==========================================
// 4. REAL-TIME LIVE SYNC
// ==========================================
function setupRealtime() {
    supabaseClient.channel('custom-all-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ventures' }, () => {
            // If ANY venture gets new money, instantly fetch the new sorted data to update the Leaderboard!
            fetchDashboardData(); 
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
            if (payload.new.id === currentUser.id) {
                updateBalanceUI(payload.new.balance);
            }
        })
        .subscribe();
}

// ==========================================
// 5. STARTUP LISTENER
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const loginScreen = document.getElementById('login-screen');
    const dashboardWrapper = document.getElementById('dashboard-wrapper');

    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (session && session.user.email.endsWith('@faystonsongdo.org')) {
                loginScreen.style.display = 'none';
                dashboardWrapper.style.display = 'block';
                initializeUser(session.user);
            } else {
                loginScreen.style.display = 'flex';
                dashboardWrapper.style.display = 'none';
            }
        });
    }

    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (supabaseClient) await supabaseClient.auth.signOut();
        window.location.reload(); 
    });
});