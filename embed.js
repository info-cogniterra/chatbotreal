// Cogniterra Widget Embed Loader - FIXED v8
(function() {
  'use strict';

  const WIDGET_URL = 'https://raw.githubusercontent.com/info-cogniterra/chatbotreal/main/cogniterra-widget-safe.v6.js';
  const CONFIG_URL = 'https://raw.githubusercontent.com/info-cogniterra/chatbotreal/main/data/v1/widget_config.json';
  
  let isLoaded = false;
  let hostElement = null;
  let cleanupFn = null;

  // Create launcher button
  function createLauncher() {
    const launcher = document.createElement('div');
    launcher.id = 'cogniterra-launcher';
    launcher.innerHTML = '💬';
    launcher.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999998;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    `;
    
    launcher.addEventListener('mouseenter', () => {
      launcher.style.transform = 'scale(1.1)';
      launcher.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
    });
    
    launcher.addEventListener('mouseleave', () => {
      launcher.style.transform = 'scale(1)';
      launcher.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });
    
    launcher.addEventListener('click', loadWidget);
    
    document.body.appendChild(launcher);
    return launcher;
  }

  // Load widget script
  function loadWidget() {
    if (isLoaded) return;
    
    const launcherBtn = document.getElementById('cogniterra-launcher');
    if (launcherBtn) {
      launcherBtn.style.display = 'none';
    }

    // Create host element with correct ID
    hostElement = document.createElement('div');
    hostElement.id = 'cogniterra-chat-bubble'; // Widget expects this ID
    document.body.appendChild(hostElement);

    // Load widget script
    const script = document.createElement('script');
    script.src = WIDGET_URL;
    script.onload = () => {
      if (window.CogniterraWidget && typeof window.CogniterraWidget.init === 'function') {
        cleanupFn = window.CogniterraWidget.init({
          container: '#cogniterra-chat-bubble',
          configUrl: CONFIG_URL,
          onClose: handleClose
        });
        isLoaded = true;
      }
    };
    script.onerror = () => {
      console.error('Failed to load Cogniterra widget');
      cleanup();
    };
    document.head.appendChild(script);
  }

  // Handle widget close
  function handleClose() {
    cleanup();
  }

  // Cleanup function
  function cleanup() {
    if (cleanupFn && typeof cleanupFn === 'function') {
      cleanupFn();
    }
    
    if (hostElement && hostElement.parentNode) {
      hostElement.parentNode.removeChild(hostElement);
    }
    
    hostElement = null;
    cleanupFn = null;
    isLoaded = false;
    
    // Show launcher again
    let launcher = document.getElementById('cogniterra-launcher');
    if (!launcher) {
      launcher = createLauncher();
    } else {
      launcher.style.display = 'flex';
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createLauncher);
  } else {
    createLauncher();
  }
})();