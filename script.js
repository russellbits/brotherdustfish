// Configuration
const cols = 3;
const rows = 3;
let curX = 0;
let curY = 0;

const container = document.getElementById('grid-container');
const sections = document.querySelectorAll('section');

// 1. Initialize Random Colors
sections.forEach(section => {
    const randomColor = `hsl(${Math.random() * 360}, 60%, 50%)`;
    section.style.backgroundColor = randomColor;
});

// 2. Navigation Function
function navigate() {
    // Keep coordinates within bounds
    curX = Math.max(0, Math.min(curX, cols - 1));
    curY = Math.max(0, Math.min(curY, rows - 1));

    // Move the container using percentages of the viewport
    const moveX = curX * -100;
    const moveY = curY * -100;
    container.style.transform = `translate(${moveX}vw, ${moveY}vh)`;
}

// 3. Keyboard Listeners
window.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp':    curY--; break;
        case 'ArrowDown':  curY++; break;
        case 'ArrowLeft':  curX--; break;
        case 'ArrowRight': curX++; break;
        default: return; // Exit if other keys are pressed
    }
    navigate();
});

// 4. Swipe Detection for Mobile
let touchStartX = 0;
let touchStartY = 0;

window.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, false);

window.addEventListener('touchend', e => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
}, false);

function handleSwipe(startX, startY, endX, endY) {
    const threshold = 50; // Minimum distance for a swipe
    const diffX = startX - endX;
    const diffY = startY - endY;

    // Check if horizontal or vertical swipe is stronger
    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > threshold) {
            if (diffX > 0) curX++; // Swipe Left -> Go Right
            else curX--;           // Swipe Right -> Go Left
        }
    } else {
        if (Math.abs(diffY) > threshold) {
            if (diffY > 0) curY++; // Swipe Up -> Go Down
            else curY--;           // Swipe Down -> Go Up
        }
    }
    navigate();
}
