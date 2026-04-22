const SUPABASE_URL = 'https://tsweufcmgrcjtgiqlcji.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzd2V1ZmNtZ3JjanRnaXFsY2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODA5MDQsImV4cCI6MjA5MjM1NjkwNH0.dMDqj_n0_w3sURSRo-_EOtrvLc5p8fu6WsAT7bs8qLI'; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const formatMoney = (amount) => `₩${parseInt(amount).toLocaleString()}`;
const FUNDING_GOAL = 10000000; // ₩10,000,000 target to fix the NaN bug

let prevData = {
    ventures: {},
    investors: {}
};

function animateNumber(element, start, end, duration, formatType = 'money') {
    if (start === end) {
        element.innerText = formatType === 'money' ? formatMoney(end) : end;
        return;
    }
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(easeProgress * (end - start) + start);
        element.innerText = formatType === 'money' ? formatMoney(current) : current;
        if (progress < 1) window.requestAnimationFrame(step);
        else element.innerText = formatType === 'money' ? formatMoney(end) : end;
    };
    window.requestAnimationFrame(step);
}

async function fetchLeaderboardData() {
    // 1. Fetch Companies
    const { data: ventures } = await supabaseClient.from('ventures').select('*').order('total_invested', { ascending: false });
    
    // 2. Fetch all investments joined with user emails
    const { data: investments } = await supabaseClient.from('investments').select('amount, users(email)');

    // Render Companies
    renderCompanyRankings(ventures);

    // Render Top Investors
}

function renderCompanyRankings(ventures) {
    const list = document.getElementById('company-rankings-list');
    if (!list) return;
    list.innerHTML = '';

    ventures.forEach((v, index) => {
        const oldInvested = prevData.ventures[v.id] || 0;
        const rankClass = index < 3 ? `rank-${index + 1}` : '';
        
        // Fix the NaN Bug
        let percentFunded = 0;
        if (v.total_invested > 0) {
            percentFunded = Math.min((v.total_invested / FUNDING_GOAL) * 100, 100).toFixed(1);
        }

        const card = document.createElement('div');
        card.className = `rank-card glass-panel ${rankClass}`;
        card.innerHTML = `
            <div class="rank-circle">${index < 3 ? ['🥇','🥈','🥉'][index] : `#${index + 1}`}</div>
            <div class="rank-content">
                <div class="rank-header">
                    <div class="rank-title">${v.title}</div>
                    <div class="rank-amount" id="lb-ven-${v.id}">₩0</div>
                </div>
                <div class="rank-meta">
                    <span><i class="ph-duotone ph-users"></i> ${v.investor_count} investors</span>
                    <span><i class="ph-duotone ph-trend-up"></i> ${percentFunded}% funded</span>
                </div>
                <div class="lb-progress-track">
                    <div class="lb-progress-fill" style="width: 0%"></div>
                </div>
            </div>
        `;
        list.appendChild(card);

        // Animate money and progress bar
        animateNumber(document.getElementById(`lb-ven-${v.id}`), oldInvested, v.total_invested, 1200, 'money');
        setTimeout(() => {
            card.querySelector('.lb-progress-fill').style.width = `${percentFunded}%`;
        }, 100);

        prevData.ventures[v.id] = v.total_invested;
    });
}

function calculateAndRenderTopInvestors(investments) {
    const list = document.getElementById('top-investors-list');
    if (!list || !investments) return;

    // Group money by user email
    const grouped = {};
    investments.forEach(inv => {
        const email = inv.users?.email || 'Unknown Investor';
        grouped[email] = (grouped[email] || 0) + Number(inv.amount);
    });

    // Convert to array and sort highest to lowest
    const sortedInvestors = Object.entries(grouped)
        .map(([email, total]) => ({ email, total }))
        .sort((a, b) => b.total - a.total);

    list.innerHTML = '';

    sortedInvestors.forEach((investor, index) => {
        const oldTotal = prevData.investors[investor.email] || 0;
        
        // Extract a display name from the email (e.g., "ahn.david" -> "David Ahn")
        let displayName = "Unknown";
        const localPart = investor.email.split('@')[0];
        
        if (localPart.includes('.')) {
            const parts = localPart.split('.');
            let lastNamePart = parts[0];
            let firstNamePart = parts[1];

            // Regex to strip any graduation year digits from the start of the last name
            let cleanLastName = lastNamePart.replace(/^\d+/, '');

            // Capitalize both names
            const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";
            
            displayName = `${capitalize(firstNamePart)} ${capitalize(cleanLastName)}`;
        } else {
            displayName = localPart; // Fallback just in case
        }
        
        const initial = displayName.charAt(0).toUpperCase();

        const card = document.createElement('div');
        card.className = 'rank-card glass-panel';
        card.innerHTML = `
            <div class="investor-avatar">${initial}</div>
            <div class="rank-content">
                <div class="rank-header" style="margin-bottom: 0;">
                    <div class="rank-title">${displayName}</div>
                    <div class="rank-amount" id="lb-inv-${index}">₩0</div>
                </div>
            </div>
        `;
        list.appendChild(card);

        animateNumber(document.getElementById(`lb-inv-${index}`), oldTotal, investor.total, 1200, 'money');
        prevData.investors[investor.email] = investor.total;
    });
}

// -------------------------------------
// Init & Realtime
// -------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    fetchLeaderboardData();

    // Listen to investments table so both lists update instantly when money changes hands
    supabaseClient.channel('leaderboard-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'investments' }, () => {
            fetchLeaderboardData();
        })
        .subscribe();
});