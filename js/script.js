// Initialize Supabase using your actual project URL and Anon Key
const SUPABASE_URL = 'https://tsweufcmgrcjtgiqlcji.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzd2V1ZmNtZ3JjanRnaXFsY2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODA5MDQsImV4cCI6MjA5MjM1NjkwNH0.dMDqj_n0_w3sURSRo-_EOtrvLc5p8fu6WsAT7bs8qLI'; 
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. UI LOGIC (Buttons & Navigation)
    // ==========================================
    
    // Select all the 'Invest Now' buttons
    const investButtons = document.querySelectorAll('.invest-btn');
    investButtons.forEach(button => {
        // Exclude the login button from this logic
        if (button.id !== 'google-login-btn') {
            button.addEventListener('click', (e) => {
                const ventureCard = e.target.closest('.venture-card');
                const ventureTitle = ventureCard.querySelector('h4').innerText;
                alert(`Opening investment modal for: ${ventureTitle}\n\nAvailable balance: ₩1,000,000`);
            });
        }
    });

    // Handle Nav link active states (excluding the logout button)
    const navLinks = document.querySelectorAll('.nav-links a:not(#logout-btn)');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); 
            navLinks.forEach(nav => nav.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    // ==========================================
    // 2. AUTHENTICATION LOGIC (Supabase)
    // ==========================================

    const loginScreen = document.getElementById('login-screen');
    const dashboardWrapper = document.getElementById('dashboard-wrapper');
    const authMsg = document.getElementById('auth-msg');

    // Check if they are already logged in when the page loads
    async function checkUser() {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            const userEmail = session.user.email;
            
            // Final frontend check
            if (userEmail.endsWith('@faystonsongdo.org')) {
                // Let them in: Hide login, show dashboard
                loginScreen.style.display = 'none';
                dashboardWrapper.style.display = 'block';
                console.log("Logged in securely as:", userEmail);
            } else {
                // Kick them out if it's not a school email
                await supabase.auth.signOut();
                authMsg.innerText = "Access denied: Must use a @faystonsongdo.org account.";
                authMsg.style.color = "#ef4444"; 
            }
        } else {
            // Explicitly ensure login screen is shown if no session
            loginScreen.style.display = 'flex';
            dashboardWrapper.style.display = 'none';
        }
    }

    checkUser();

    // Handle the Google Login button
    document.getElementById('google-login-btn').addEventListener('click', async () => {
        authMsg.innerText = "Redirecting to Google...";
        authMsg.style.color = "var(--accent-green)";
        
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin // Sends them back to your site
            }
        });

        if (error) {
            authMsg.innerText = "Error: " + error.message;
            authMsg.style.color = "#ef4444";
            console.error("Login error:", error);
        }
    });

    // Handle the Logout button
    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.reload(); // Refresh the page to show the login screen
    });

});