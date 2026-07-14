// public/global.js
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

window.clearProxyCacheAndReload = async () => {
  let changed = false;
  if(getCookie("shouldProxy") == "true"){
      document.cookie = "shouldProxy=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      changed = true;
  }
  
  // Unregister all service workers
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const result = await reg.unregister();
      if (result) {
        changed = true;
      } else {
        console.warn('⚠️ Failed to unregister:', reg.scope);
      }
    }
  } else {
    console.warn('Service workers not supported in this browser.');
  }

  // Clear all caches
  if ('caches' in window) {
    const keys = await caches.keys();
    for (const key of keys) {
      await caches.delete(key);
      console.log('🧹 Deleted cache:', key);
      changed = true;
    }
  }
  
  if (changed) {
    location.reload(true);
  }
};
