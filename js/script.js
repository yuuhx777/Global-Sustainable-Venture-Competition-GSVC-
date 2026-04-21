const SUPABASE_URL = 'https://tsweufcmgrcjtgiqlcji.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzd2V1ZmNtZ3JjanRnaXFsY2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODA5MDQsImV4cCI6MjA5MjM1NjkwNH0.dMDqj_n0_w3sURSRo-_EOtrvLc5p8fu6WsAT7bs8qLI'; // Keep your long key here!

let supabaseClient;
let currentUser = null;
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
    
    // Just fetch the user from your existing table. 
    // The Postgres trigger already guaranteed they exist and have the right balance!
    const { data: dbUser, error } = await supabaseClient.from('users').select('*').eq('id', user.id).single();
    
    if (error) {
        console.error("Error fetching user data:", error);
        return;
    }

    updateBalanceUI(dbUser.balance);
    fetchDashboardData();
    setupRealtime(); 
}

function updateBalanceUI(balance) {
    currentBalance = balance;
    const balanceElements = document.querySelectorAll('.balance-info h3, .side-card .score');
    balanceElements.forEach(el => el.innerText = formatMoney(balance));
}

// ==========================================
// 2. FETCHING & RENDERING DATA
// ==========================================
async function fetchDashboardData() {
    // Fetch Ventures
    const { data: ventures } = await supabaseClient.from('ventures').select('*').order('total_invested', { ascending: false });
    
    // Fetch Investments for global stats
    const { data: investments } = await supabaseClient.from('investments').select('*');

    // Calculate Global Stats
    let totalInvestedGlobal = 0;
    const uniqueInvestors = new Set();
    
    investments.forEach(inv => {
        totalInvestedGlobal += Number(inv.amount);
        uniqueInvestors.add(inv.user_id);
    });

    // Update Top Stats UI
    document.querySelectorAll('.stat-card h3')[0].innerText = formatMoney(totalInvestedGlobal); // Total Invested
    document.querySelectorAll('.stat-card h3')[1].innerText = uniqueInvestors.size; // Total Investors
    document.querySelectorAll('.stat-card h3')[2].innerText = ventures.length; // Active Ventures

    renderVentures(ventures);
}

function renderVentures(ventures) {
    const container = document.getElementById('dynamic-ventures');
    if (!container) return;
    
    container.innerHTML = ''; // Clear loading state

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

    // 1. Deduct from User (Now updating 'users' table)
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
            fetchDashboardData(); 
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
            // Watch the 'users' table now instead of profiles
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

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (supabaseClient) await supabaseClient.auth.signOut();
        window.location.reload(); 
    });
});