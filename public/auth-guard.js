/**
 * auth-guard.js
 * Script síncrono para bloquear el renderizado si no hay sesión activa.
 */

(function() {
  const SESSION_TOKEN_KEY = 'oem_admin_token';
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');

  if (tokenFromUrl) {
    localStorage.setItem(SESSION_TOKEN_KEY, tokenFromUrl);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const currentToken = localStorage.getItem(SESSION_TOKEN_KEY);
  if (!currentToken) {
    window.location.href = '/login.html';
  }
})();
