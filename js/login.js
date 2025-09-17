document.addEventListener('DOMContentLoaded', async () => {
  if (!window.portalAuth || typeof supabase === 'undefined') {
    console.error('El módulo de autenticación no está disponible.');
    return;
  }

  const continuar = await portalAuth.asegurarSesionActiva();
  if (!continuar) {
    return;
  }

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const feedback = document.getElementById('login-feedback');
  const submitButton = document.getElementById('login-submit');

  if (!form || !emailInput || !passwordInput || !feedback || !submitButton) {
    console.error('Faltan elementos requeridos en la pantalla de acceso.');
    return;
  }

  const setFeedback = (message, type = '') => {
    feedback.textContent = message;
    feedback.classList.remove('error', 'success', 'info');
    if (type) {
      feedback.classList.add(type);
    }
  };

  const clearFeedbackIfNeeded = () => {
    if (feedback.textContent) {
      setFeedback('');
    }
  };

  emailInput.addEventListener('input', clearFeedbackIfNeeded);
  passwordInput.addEventListener('input', clearFeedbackIfNeeded);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      setFeedback('Ingresa tu correo y contraseña para continuar.', 'error');
      if (!email) {
        emailInput.focus();
      } else {
        passwordInput.focus();
      }
      return;
    }

    submitButton.disabled = true;
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Validando...';

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        const message = error.message || 'No se pudo iniciar sesión. Verifica tus credenciales.';
        setFeedback(message, 'error');
        return;
      }

      if (!data || !data.session) {
        setFeedback('Tu cuenta requiere confirmación antes de iniciar sesión. Revisa tu correo.', 'info');
        return;
      }

      portalAuth.refrescarIndicadoresSesion(data.session);
      setFeedback('Acceso concedido. Redirigiendo...', 'success');
      const destino = portalAuth.obtenerDestinoSeguro();
      setTimeout(() => {
        window.location.replace(destino);
      }, 400);
    } catch (error) {
      console.error('Error al iniciar sesión con Supabase Auth', error);
      setFeedback('Ocurrió un error al validar tus credenciales. Intenta nuevamente.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });
});
