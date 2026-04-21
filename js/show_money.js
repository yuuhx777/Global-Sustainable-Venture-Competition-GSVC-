const SUPABASE_URL = 'https://tsweufcmgrcjtgiqlcji.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzd2V1ZmNtZ3JjanRnaXFsY2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODA5MDQsImV4cCI6MjA5MjM1NjkwNH0.dMDqj_n0_w3sURSRo-_EOtrvLc5p8fu6WsAT7bs8qLI'; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const formatMoney = (amount) => `₩${parseInt(amount).toLocaleString()}`;

let prevData = {
    globalInvested: 0,
    globalInvestors: 0,
    venturesCount: 0,
    fundedCount: 0,
    ventures: {} 
};

// -------------------------------------
// Number Roller Animation
// -------------------------------------
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

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.innerText = formatType === 'money' ? formatMoney(end) : end;
        }
    };
    window.requestAnimationFrame(step);
}

// -------------------------------------
// Fetch and Render Data
// -------------------------------------
async function fetchBoardData() {
    // 1. Fetch data
    const { data: ventures } = await supabaseClient.from('ventures').select('*').order('total_invested', { ascending: false });
    const { data: investments } = await supabaseClient.from('investments').select('*');

    // 2. Calculate Stats
    let totalInvestedGlobal = 0;
    const uniqueInvestors = new Set();
    
    investments.forEach(inv => {
        totalInvestedGlobal += Number(inv.amount);
        uniqueInvestors.add(inv.user_id);
    });

    const totalInvestors = uniqueInvestors.size;
    const activeVentures = ventures.length;
    // Count ventures that have received at least some investment
    const fundedVentures = ventures.filter(v => v.total_invested > 0).length;

    // 3. Animate Main Top Stats
    animateNumber(document.getElementById('mega-money-display'), prevData.globalInvested, totalInvestedGlobal, 1500, 'money');
    animateNumber(document.getElementById('mega-investors'), prevData.globalInvestors, totalInvestors, 1500, 'number');
    animateNumber(document.getElementById('mega-ventures'), prevData.venturesCount, activeVentures, 1500, 'number');
    animateNumber(document.getElementById('mega-funded'), prevData.fundedCount, fundedVentures, 1500, 'number');

    // Save state
    prevData.globalInvested = totalInvestedGlobal;
    prevData.globalInvestors = totalInvestors;
    prevData.venturesCount = activeVentures;
    prevData.fundedCount = fundedVentures;

    // 4. Render Bottom Breakdown Cards
    const grid = document.getElementById('breakdown-grid');
    grid.innerHTML = ''; // Clear old

    ventures.forEach(v => {
        const oldInvested = prevData.ventures[v.id] || 0;
        
        const card = document.createElement('div');
        card.className = 'breakdown-card';
        card.innerHTML = `
            <div class="b-money" id="b-money-${v.id}">₩0</div>
            <div class="b-details">
                <div class="b-title">${v.title}</div>
                <div class="b-investors">${v.investor_count} investors</div>
            </div>
        `;
        grid.appendChild(card);

        // Animate individual card money
        animateNumber(document.getElementById(`b-money-${v.id}`), oldInvested, v.total_invested, 1500, 'money');
        
        prevData.ventures[v.id] = v.total_invested;
    });
}

// -------------------------------------
// Fullscreen Toggle
// -------------------------------------
document.getElementById('fullscreen-btn').addEventListener('click', () => {
    const elem = document.documentElement;
    const icon = document.querySelector('#fullscreen-btn i');
    
    if (!document.fullscreenElement) {
        elem.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
        icon.classList.replace('ph-corners-out', 'ph-corners-in');
    } else {
        document.exitFullscreen();
        icon.classList.replace('ph-corners-in', 'ph-corners-out');
    }
});

// -------------------------------------
// Init & Realtime
// -------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    fetchBoardData();

    // Listen for live updates
    supabaseClient.channel('live-board-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ventures' }, () => {
            fetchBoardData();
        })
        .subscribe();
});