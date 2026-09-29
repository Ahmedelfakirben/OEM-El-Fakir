/**
 * auth.js
 * Manejo de sesión JWT, redirecciones MSAL y persistencia.
 */

document.addEventListener('DOMContentLoaded', () => {
  const isLoginPage = window.location.pathname === '/login.html';

  // 1. Interceptar Token desde Entra ID (URL redirect)
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');

  if (tokenFromUrl) {
    localStorage.setItem('oem_admin_token', tokenFromUrl);
    // Limpiar la URL sin recargar
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // 2. Verificar Sesión
  const currentToken = localStorage.getItem('oem_admin_token');

  if (!currentToken && !isLoginPage) {
    // Redirigir a login si no hay token
    window.location.href = '/login.html';
    return;
  }

  if (currentToken && isLoginPage) {
    // Si ya estamos autenticados y visitamos login, saltar a index
    window.location.href = '/';
    return;
  }

  // 3. Controladores de la vista Login
  if (isLoginPage) {
    const btnEntra = document.getElementById('btn-login-entra');
    const formLocal = document.getElementById('login-local-form');
    const errorDiv = document.getElementById('login-error');

    if (btnEntra) {
      btnEntra.addEventListener('click', () => {
        window.location.href = '/api/auth/login/microsoft';
      });
    }

    if (formLocal) {
      formLocal.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.style.display = 'none';
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const btnLocal = document.getElementById('btn-login-local');
        
        btnLocal.disabled = true;
        btnLocal.textContent = 'Autenticando...';

        try {
          const res = await fetch('/api/auth/local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Credenciales inválidas');
          }
          
          const data = await res.json();
          localStorage.setItem('oem_admin_token', data.token);
          window.location.href = '/';
        } catch (err) {
          errorDiv.textContent = err.message;
          errorDiv.style.display = 'block';
          btnLocal.disabled = false;
          btnLocal.textContent = 'Acceder Localmente';
        }
      });
    }
  }
});

// Wrapper para inyectar token en fetch (opcional, para usar en otras partes del código)
window.getAuthToken = () => localStorage.getItem('oem_admin_token');
window.logout = () => {
  localStorage.removeItem('oem_admin_token');
  window.location.href = '/login.html';
};
