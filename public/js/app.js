/* Controls the Tabs/Docs switching via Anime.js */
const tabs = document.querySelectorAll('.sidebar li');
const sections = document.querySelectorAll('.section');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Reset Active
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Target Section
        const targetId = tab.getAttribute('data-tab');
        
        // Hide All
        sections.forEach(sec => {
            sec.style.opacity = 0;
            sec.style.pointerEvents = 'none';
        });

        // Show Target with Anime.js Fade
        const activeSec = document.getElementById(targetId);
        activeSec.classList.remove('hidden'); // Ensure logic vis
        
        anime({
            targets: activeSec,
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 600,
            easing: 'easeOutExpo',
            begin: () => { activeSec.style.pointerEvents = 'all'; }
        });
    });
});
