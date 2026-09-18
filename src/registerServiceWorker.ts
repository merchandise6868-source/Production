/**
 * Đăng ký Service Worker cho Progressive Web App (PWA)
 */
export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ PWA ServiceWorker đã đăng ký thành công:', registration.scope);
        })
        .catch((error) => {
          console.warn('⚠️ Lỗi đăng ký ServiceWorker:', error);
        });
    });
  }
}
