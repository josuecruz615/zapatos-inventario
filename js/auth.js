(() => {
  const STORAGE_KEY = 'portalSesionVerificada';
  const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 horas
  const REVALIDATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

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

  const readSessionWithoutValidation = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Sesión inválida en almacenamiento local, limpiando.', error);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  };

  const persistSession = (session) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    refreshSessionIndicators(session);
  };

  const clearSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    refreshSessionIndicators(null);
  };

  const refreshSessionIndicators = (sessionParam) => {
    const session = sessionParam || readSessionWithoutValidation();
    const aliasElement = document.getElementById('session-user-alias');
    const logoutButton = document.querySelector('[data-logout]');

    if (aliasElement) {
      if (session && session.alias) {
        aliasElement.textContent = `🔐 ${session.alias}`;
      } else if (session) {
        aliasElement.textContent = '🔐 Acceso activo';
      } else {
        aliasElement.textContent = '';
      }
    }

    if (logoutButton) {
      logoutButton.style.display = session ? 'inline-flex' : 'none';
    }
  };

  const hashVerificationCode = async (code) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const fetchCodeRecord = async (hash) => {
    // Espera que exista la función RPC validar_codigo_acceso(hash text)
    // que devuelve la fila activa coincidente con el hash proporcionado.
    const { data, error } = await supabase.rpc('validar_codigo_acceso', { p_hash: hash });

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    if (Array.isArray(data)) {
      return data[0] || null;
    }

    return data;
  };

  const obtainCurrentSession = async ({ revalidate = true } = {}) => {
    const stored = readSessionWithoutValidation();
    if (!stored || !stored.token || !stored.expira) {
      clearSession();
      return null;
    }

    if (Date.now() > stored.expira) {
      clearSession();
      return null;
    }

    if (!revalidate) {
      return stored;
    }

    const lastValidation = stored.ultimaValidacion || 0;
    if (Date.now() - lastValidation < REVALIDATION_INTERVAL_MS) {
      return stored;
    }

    const record = await fetchCodeRecord(stored.token);
    if (!record) {
      clearSession();
      return null;
    }

    const refreshed = {
      token: stored.token,
      alias: record.alias || stored.alias || '',
      expira: Date.now() + SESSION_DURATION_MS,
      ultimaValidacion: Date.now()
    };
    persistSession(refreshed);
    return refreshed;
  };

  const ensureActiveSession = async () => {
    if (typeof supabase === 'undefined') {
      console.error('Supabase no está disponible. Verifica la carga de supabase-client.js.');
      return false;
    }

    if (isLoginPage()) {
      const existing = await obtainCurrentSession({ revalidate: false });
      if (existing) {
        const destination = getSafeDestination();
        window.location.replace(destination);
        return false;
      }
      return true;
    }

    try {
      const session = await obtainCurrentSession();
      if (!session) {
        redirectToLogin();
        return false;
      }
      refreshSessionIndicators(session);
      return session;
    } catch (error) {
      console.error('No se pudo validar la sesión activa', error);
      alert('No se pudo validar tu sesión. Por favor ingresa nuevamente.');
      redirectToLogin();
      return false;
    }
  };

  const startSessionWithCode = async (code) => {
    const hash = await hashVerificationCode(code);
    const record = await fetchCodeRecord(hash);

    if (!record) {
      return { ok: false, reason: 'invalid' };
    }

    const session = {
      token: hash,
      alias: record.alias || '',
      expira: Date.now() + SESSION_DURATION_MS,
      ultimaValidacion: Date.now()
    };

    persistSession(session);
    return { ok: true, session };
  };

  const getSafeDestination = () => {
    const params = new URLSearchParams(window.location.search);
    const nextParam = params.get('next');
    const safePath = sanitizeDestination(nextParam);
    return safePath;
  };

  const redirectToLogin = () => {
    if (isLoginPage()) return;
    const nextValue = buildNextParam();
    window.location.replace(`login.html?next=${nextValue}`);
  };

  const logout = (redirect = true) => {
    clearSession();
    if (redirect) {
      window.location.replace('login.html');
    }
  };

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
    iniciarSesionConCodigo: startSessionWithCode,
    cerrarSesion: logout,
    refrescarIndicadoresSesion: refreshSessionIndicators,
    obtenerSesionActual: obtainCurrentSession,
    obtenerDestinoSeguro: getSafeDestination
  };
})();
