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