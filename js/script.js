const SUPABASE_URL = 'https://tsweufcmgrcjtgiqlcji.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzd2V1ZmNtZ3JjanRnaXFsY2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODA5MDQsImV4cCI6MjA5MjM1NjkwNH0.dMDqj_n0_w3sURSRo-_EOtrvLc5p8fu6WsAT7bs8qLI'; 

// Renamed from 'supabase' to 'supabaseClient' to avoid conflicting with the CDN's global object
let supabaseClient;

// 1. SAFE INITIALIZATION
try {
    // Use the global 'supabase' object from the CDN to create your client
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase initialized successfully!");
} catch (err) {
    console.error("Supabase failed to load. Is an adblocker blocking the CDN?", err);
}

// 2. THE GLOBAL LOGIN FUNCTION (Triggered directly by HTML)
window.handleGoogleLogin = async function() {
    console.log("Google Login button was clicked!");
    const authMsg = document.getElementById('auth-msg');
    
    // Check if Supabase even loaded
    if (!supabaseClient) {
        authMsg.innerText = "Error: Database blocked. Try disabling your adblocker and refreshing.";
        authMsg.style.color = "#ef4444";
        return;
    }

    authMsg.innerText = "Redirecting to Google...";
    authMsg.style.color = "var(--accent-green)";
    
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.href
        }
    });

    if (error) {
        authMsg.innerText = "Error: " + error.message;
        authMsg.style.color = "#ef4444";
        console.error("Login error:", error);
    }
};

// 3. UI LOGIC & SESSION CHECKING (Runs when page loads)
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM is loaded, running UI scripts...");

    // Dashboard Buttons
    const investButtons = document.querySelectorAll('.invest-btn:not(#google-login-btn)');
    investButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const ventureCard = e.target.closest('.venture-card');
            const ventureTitle = ventureCard.querySelector('h4').innerText;
            alert(`Opening investment modal for: ${ventureTitle}\n\nAvailable balance: ₩1,000,000`);
        });
    });

    // Nav Links
    const navLinks = document.querySelectorAll('.nav-links a:not(#logout-btn)');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); 
            navLinks.forEach(nav => nav.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    // Logout Button
    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (supabaseClient) await supabaseClient.auth.signOut();
        window.location.reload(); 
    });

    // Session Check
    const loginScreen = document.getElementById('login-screen');
    const dashboardWrapper = document.getElementById('dashboard-wrapper');
    const authMsg = document.getElementById('auth-msg');

    async function checkUser() {
        if (!supabaseClient) return; // Skip check if Supabase didn't load
        
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            const userEmail = session.user.email;
            if (userEmail.endsWith('@faystonsongdo.org')) {
                loginScreen.style.display = 'none';
                dashboardWrapper.style.display = 'block';
                console.log("Logged in securely as:", userEmail);
            } else {
                await supabaseClient.auth.signOut();
                authMsg.innerText = "Access denied: Must use a @faystonsongdo.org account.";
                authMsg.style.color = "#ef4444"; 
            }
        } else {
            loginScreen.style.display = 'flex';
            dashboardWrapper.style.display = 'none';
        }
    }

    checkUser();
});