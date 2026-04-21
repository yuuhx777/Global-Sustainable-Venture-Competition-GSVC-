document.addEventListener("DOMContentLoaded", () => {
    // Select all the 'Invest Now' buttons
    const investButtons = document.querySelectorAll('.invest-btn');

    investButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Get the title of the venture being invested in
            const ventureCard = e.target.closest('.venture-card');
            const ventureTitle = ventureCard.querySelector('h4').innerText;

            // Optional: Simple browser alert for interaction (can be replaced with modal logic later)
            alert(`Opening investment modal for: ${ventureTitle}\n\nAvailable balance: ₩1,000,000`);
            
            // You can add your logic here to deduct from balance, 
            // open a transaction form, or update the database.
        });
    });

    // Handle Nav link active states
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent jump to top for empty links
            
            // Remove active class from all
            navLinks.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked link
            e.currentTarget.classList.add('active');
        });
    });
});

// Initialize Supabase using your actual project URL!
const SUPABASE_URL = 'https://tsweufcmgrcjtgiqlcji.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzd2V1ZmNtZ3JjanRnaXFsY2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODA5MDQsImV4cCI6MjA5MjM1NjkwNH0.dMDqj_n0_w3sURSRo-_EOtrvLc5p8fu6WsAT7bs8qLI'; // Replace this!
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authModal = document.getElementById('auth-modal');
const authMsg = document.getElementById('auth-msg');

// 1. Check if they are already logged in when the page loads
async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        const userEmail = session.user.email;
        
        // Final frontend check
        if (userEmail.endsWith('@faystonsongdo.org')) {
            authModal.style.display = 'none'; // Let them in!
            console.log("Logged in securely as:", userEmail);
            
            // Optional: Update the UI with their email
            // document.querySelector('.logo-area h1 span').innerText = userEmail;
        } else {
            // Kick them out if it's not a school email
            await supabase.auth.signOut();
            authMsg.innerText = "Access denied: Must use a @faystonsongdo.org account.";
            authMsg.style.color = "#ff4444"; // Make it red for an error
        }
    }
}

checkUser();

// 2. Handle the Google Login button
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
        authMsg.style.color = "#ff4444";
        console.error("Login error:", error);
    }
});