// cogniterra-widget-safe.v8.js

// Function to create animated loading dots
function showLoadingDots() {
    const loadingDots = document.createElement('div');
    loadingDots.className = 'loading-dots';
    loadingDots.innerHTML = '<span>.</span><span>.</span><span>.</span>';
    document.body.appendChild(loadingDots);
}

// Function for typing effect
function typingEffect(element, text, delay) {
    let index = 0;
    const interval = setInterval(() => {
        if (index < text.length) {
            element.innerHTML += text.charAt(index);
            index++;
        } else {
            clearInterval(interval);
        }
    }, delay);
}

// Smooth scrolling with easing
function smoothScroll(target) {
    const element = document.querySelector(target);
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Show toast notifications
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Add skeleton loading
function showSkeletonLoading() {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton';
    document.body.appendChild(skeleton);
}

// Micro-interactions on buttons
document.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.add('active');
        setTimeout(() => {
            button.classList.remove('active');
        }, 200);
    });
});

// Main function to initialize all features
function initCogniterraWidget() {
    showLoadingDots();
    // Example usage
    const responseElement = document.getElementById('ai-response');
    typingEffect(responseElement, 'Welcome to the Cogniterra Chatbot!', 100);
    smoothScroll('#chat-window');
    showToast('Chatbot is ready to assist you!');
    showSkeletonLoading();
}

// Call the init function on page load
window.onload = initCogniterraWidget;