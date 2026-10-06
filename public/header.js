document.addEventListener('DOMContentLoaded', () => {
  const headerHTML = `
  <header class="site-header" role="banner">
    <div class="header-inner">
      <div class="logo">
        <img class="logo-svg" src="/refresh_14433.png" alt="Logo" style="width: 32px; height: 32px;" />
        <div class="logo-title-group">
          <span class="logo-text">Driver Explorer</span>
          <span class="logo-subtext">Auditoría Corporativa &amp; Windows Update</span>
        </div>
      </div>
      <nav class="primary-nav" aria-label="Navegación principal">
        <a href="/index.html" id="nav-btn-catalog" class="nav-tab-btn">
          <span class="nav-tab-label">Catálogo de Modelos</span>
        </a>
        <a href="/flota.html" id="nav-btn-fleet" class="nav-tab-btn">
          <span class="nav-tab-label">Equipos Intune</span>
          <span id="nav-fleet-count-badge" class="nav-count-badge">0</span>
        </a>
      </nav>
      <div class="user-profile">
        <span id="current-user-display" class="user-name"></span>
        <button id="logout-btn" class="btn-text">Cerrar Sesión</button>
      </div>
    </div>
  </header>
  `;

  const appHeader = document.getElementById('app-header');
  if (appHeader) {
    appHeader.innerHTML = headerHTML;
  }

  // Marcar link activo
  const pathname = window.location.pathname;
  let activeId = 'nav-btn-catalog';
  
  if (pathname.includes('/flota') || pathname.includes('/equipo')) {
    activeId = 'nav-btn-fleet';
  } else if (pathname.includes('/politicas')) {
    activeId = 'nav-btn-settings';
  } else if (pathname.includes('/conectores')) {
    activeId = 'nav-btn-connectors';
  } else if (pathname.includes('/audit')) {
    activeId = 'nav-btn-audit';
  } else if (pathname.includes('/detail') || pathname === '/' || pathname === '/index.html') {
    activeId = 'nav-btn-catalog';
  }

  const activeEl = document.getElementById(activeId);
  if (activeEl) {
    activeEl.classList.add('active');
  }

  // Sincronización Global de Estado: Badge de Flota y Lógica de Sesión
  const token = localStorage.getItem('oem_admin_token') || localStorage.getItem('jwt_token');
  if (token) {
    // Extraer usuario del JWT
    try {
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      const username = payload.name || payload.email || payload.unique_name || payload.username || payload.sub || 'Administrador';
      
      const userDisplay = document.getElementById('current-user-display');
      if (userDisplay) {
        userDisplay.textContent = username;
      }
    } catch (e) {
      console.error('Error decodificando JWT:', e);
    }

    // Obtener badge
    fetch('/api/fleet/stats', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(r => {
      if (r.status === 401 || r.status === 403) throw new Error('Auth error');
      return r.json();
    })
    .then(data => {
      const badge = document.getElementById('nav-fleet-count-badge');
      if (badge && data && typeof data.totalDevices !== 'undefined') {
        badge.textContent = data.totalDevices;
      }
    })
    .catch(e => console.error('Error sincronizando badge global:', e));
  }

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('oem_admin_token');
      localStorage.removeItem('jwt_token');
      window.location.href = '/login.html';
    });
  }
});
