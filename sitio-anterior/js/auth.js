(() => {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof supabase === 'undefined') {
    console.error('Supabase no está disponible. Verifica la carga de supabase-client.js.');
    window.portalAuth = {
      asegurarSesionActiva: async () => false,
      cerrarSesion: async () => {},
      refrescarIndicadoresSesion: () => {},
      obtenerSesionActual: async () => null,
      obtenerDestinoSeguro: () => 'inventario.html'
    };
    return;
  }

  let lastKnownSession = null;

  const getCurrentFile = () => {
    const parts = window.location.pathname.split('/');
    const last = parts[parts.length - 1];
    return (last || 'index.html').toLowerCase();
  };

  const isLoginPage = () => getCurrentFile() === 'login.html';

  const buildNextParam = () => {
    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return encodeURIComponent(path);
  };

  const sanitizeDestination = (rawNext) => {
    if (!rawNext) return 'inventario.html';

    try {
      const decoded = decodeURIComponent(rawNext).trim();
      if (!decoded) return 'inventario.html';
      if (/^https?:\/\//i.test(decoded) || decoded.startsWith('//')) {
        return 'inventario.html';
      }
      if (decoded.includes('..')) {
        return 'inventario.html';
      }
      return decoded;
    } catch (error) {
      console.error('No se pudo interpretar el parámetro next', error);
      return 'inventario.html';
    }
  };

  const getSafeDestination = () => {
    const params = new URLSearchParams(window.location.search);
    const nextParam = params.get('next');
    return sanitizeDestination(nextParam);
  };

  const redirectToLogin = () => {
    if (isLoginPage()) return;
    const nextValue = buildNextParam();
    window.location.replace(`login.html?next=${nextValue}`);
  };

  const extractAlias = (session) => {
    if (!session || !session.user) return '';
    const { user } = session;
    return user.email || user.user_metadata?.full_name || user.user_metadata?.name || 'Usuario autenticado';
  };

  const refreshSessionIndicators = (sessionParam) => {
    if (sessionParam !== undefined) {
      lastKnownSession = sessionParam;
    }

    const session = sessionParam !== undefined ? sessionParam : lastKnownSession;
    const aliasElement = document.getElementById('session-user-alias');
    const logoutButton = document.querySelector('[data-logout]');

    if (aliasElement) {
      if (session) {
        aliasElement.textContent = `🔐 ${extractAlias(session)}`;
      } else {
        aliasElement.textContent = '';
      }
    }

    if (logoutButton) {
      logoutButton.style.display = session ? 'inline-flex' : 'none';
    }
  };

  const getCurrentSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    const session = data?.session || null;
    lastKnownSession = session;
    return session;
  };

  const ensureActiveSession = async () => {
    let session = null;

    try {
      session = await getCurrentSession();
    } catch (error) {
      console.error('No se pudo obtener la sesión actual', error);
      if (!isLoginPage()) {
        alert('No se pudo validar tu sesión. Por favor ingresa nuevamente.');
        redirectToLogin();
      }
      return false;
    }

    if (isLoginPage()) {
      if (session) {
        refreshSessionIndicators(session);
        const destination = getSafeDestination();
        window.location.replace(destination);
        return false;
      }

      refreshSessionIndicators(null);
      return true;
    }

    if (!session) {
      redirectToLogin();
      return false;
    }

    refreshSessionIndicators(session);
    return session;
  };

  const logout = async (redirect = true) => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error al cerrar la sesión de Supabase', error);
    }

    refreshSessionIndicators(null);

    if (redirect) {
      window.location.replace('login.html');
    }
  };

  supabase.auth.onAuthStateChange((_event, session) => {
    lastKnownSession = session;
    refreshSessionIndicators(session);
    if (!session && !isLoginPage()) {
      redirectToLogin();
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target.matches('[data-logout]')) {
      event.preventDefault();
      logout(true);
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    refreshSessionIndicators();
  });

  window.portalAuth = {
    asegurarSesionActiva: ensureActiveSession,
    cerrarSesion: logout,
    refrescarIndicadoresSesion: refreshSessionIndicators,
    obtenerSesionActual: async () => {
      try {
        return await getCurrentSession();
      } catch (error) {
        console.error('No se pudo obtener la sesión actual', error);
        return null;
      }
    },
    obtenerDestinoSeguro: getSafeDestination
  };
})();
