const SUPABASE_URL = 'https://tsweufcmgrcjtgiqlcji.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzd2V1ZmNtZ3JjanRnaXFsY2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODA5MDQsImV4cCI6MjA5MjM1NjkwNH0.dMDqj_n0_w3sURSRo-_EOtrvLc5p8fu6WsAT7bs8qLI'; // Keep your key here!

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const formatMoney = (amount) => `₩${parseInt(amount).toLocaleString()}`;

// STRICT ADMIN ACCESS ONLY
const ALLOWED_ADMINS = [
    '29kim.sunjoong@faystonsongdo.org',
    '27kim.yuha@faystonsongdo.org',
    '28an.jiwoo@faystonsongdo.org'
];

let currentEditId = null;

document.addEventListener("DOMContentLoaded", () => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (!session || !ALLOWED_ADMINS.includes(session.user.email)) {
            // Intruder alert! Kick them out immediately
            window.location.href = 'index.html';
        } else {
            // Authorized. Load the data.
            fetchAdminData();
        }
    });
});

async function fetchAdminData() {
    // FIX: Ordered by 'title' instead of the missing 'created_at' column
    const { data: ventures, error } = await supabaseClient.from('ventures').select('*').order('title', { ascending: true });
    
    // Safety check: if Supabase gets mad, tell us why in the console!
    if (error) {
        console.error("Failed to load admin data:", error);
        return;
    }

    renderAdminList(ventures);
}

function renderAdminList(ventures) {
    const list = document.getElementById('admin-company-list');
    list.innerHTML = '';

    ventures.forEach(v => {
        const isActive = v.is_active !== false; // Defaults to true
        const statusBadge = isActive 
            ? `<span class="status-badge status-active">Active</span>` 
            : `<span class="status-badge status-inactive">Inactive</span>`;

        const card = document.createElement('div');
        card.className = 'admin-card glass-panel';
        card.innerHTML = `
            <div class="admin-card-left">
                <div class="v-icon" style="width: 40px; height: 40px; font-size: 20px;"><i class="ph-duotone ph-rocket"></i></div>
                <div>
                    <h4 style="font-size: 15px; margin-bottom: 2px;">${v.title} ${statusBadge}</h4>
                    <p style="font-size: 12px; color: var(--text-muted);">${v.tagline || 'No tagline'}</p>
                    <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Invested: ${formatMoney(v.total_invested)} &nbsp;&nbsp; ${v.investor_count} investors</p>
                </div>
            </div>
            <div class="admin-card-actions">
                <button class="action-btn" onclick="openModal('${v.id}')"><i class="ph-bold ph-pencil-simple"></i></button>
                <button class="action-btn delete" onclick="deleteCompany('${v.id}', '${v.title}')"><i class="ph-bold ph-trash"></i></button>
            </div>
        `;
        list.appendChild(card);
    });
}

// ---------------------------
// Add / Edit Modal Logic
// ---------------------------
const modal = document.getElementById('admin-modal-overlay');

document.getElementById('add-company-btn').addEventListener('click', () => {
    currentEditId = null;
    document.getElementById('admin-modal-title').innerText = "Add New Company";
    document.getElementById('comp-name').value = '';
    document.getElementById('comp-tagline').value = '';
    document.getElementById('comp-desc').value = '';
    document.getElementById('comp-logo').value = '';
    document.getElementById('comp-active').checked = true;
    document.getElementById('save-company-btn').innerText = "Create Company";
    modal.style.display = 'flex';
});

window.openModal = async function(id) {
    currentEditId = id;
    document.getElementById('admin-modal-title').innerText = "Edit Company";
    document.getElementById('save-company-btn').innerText = "Update Company";
    
    // Fetch current data
    const { data: v } = await supabaseClient.from('ventures').select('*').eq('id', id).single();
    
    document.getElementById('comp-name').value = v.title;
    document.getElementById('comp-tagline').value = v.tagline || '';
    document.getElementById('comp-desc').value = v.description || '';
    document.getElementById('comp-category').value = v.category || 'Tech';
    document.getElementById('comp-logo').value = v.logo_url || '';
    document.getElementById('comp-active').checked = v.is_active !== false;
    
    modal.style.display = 'flex';
};

document.getElementById('close-modal-btn').addEventListener('click', () => modal.style.display = 'none');

document.getElementById('save-company-btn').addEventListener('click', async () => {
    const payload = {
        title: document.getElementById('comp-name').value,
        tagline: document.getElementById('comp-tagline').value,
        description: document.getElementById('comp-desc').value,
        category: document.getElementById('comp-category').value,
        logo_url: document.getElementById('comp-logo').value,
        is_active: document.getElementById('comp-active').checked
    };

    if (!payload.title || !payload.tagline) return showToast("Name and Tagline are required!", "error");

    if (currentEditId) {
        await supabaseClient.from('ventures').update(payload).eq('id', currentEditId);
        showToast("Company updated successfully!");
    } else {
        await supabaseClient.from('ventures').insert([payload]);
        showToast("Company created successfully!");
    }
    
    modal.style.display = 'none';
    fetchAdminData();
});

// ---------------------------
// Delete & Reset Logic
// ---------------------------
window.deleteCompany = async function(id, title) {
    if (confirm(`Are you sure you want to completely delete "${title}"? This cannot be undone.`)) {
        await supabaseClient.from('ventures').delete().eq('id', id);
        showToast("Company deleted.");
        fetchAdminData();
    }
};

document.getElementById('reset-db-btn').addEventListener('click', async () => {
    const promptCheck = prompt("DANGER: This will wipe ALL investments and companies.\nType 'RESET' to confirm:");
    if (promptCheck === "RESET") {
        const { error } = await supabaseClient.rpc('reset_database');
        if (error) {
            showToast("Error resetting database.", "error");
            console.error(error);
        } else {
            showToast("Database has been wiped clean.", "success");
            fetchAdminData();
        }
    }
});

// Toast Helper
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '<i class="ph-fill ph-check-circle" style="color: var(--accent-green); font-size: 20px;"></i>' : '<i class="ph-fill ph-warning-circle" style="color: #ef4444; font-size: 20px;"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}