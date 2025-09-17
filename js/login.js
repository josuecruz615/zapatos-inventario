document.addEventListener('DOMContentLoaded', async () => {
  if (!window.portalAuth) {
    console.error('El módulo de autenticación no está disponible.');
    return;
  }

  const continuar = await portalAuth.asegurarSesionActiva();
  if (!continuar) {
    return;
  }

  const form = document.getElementById('login-form');
  const codeInput = document.getElementById('verification-code');
  const feedback = document.getElementById('login-feedback');
  const submitButton = document.getElementById('login-submit');

  if (!form || !codeInput || !feedback || !submitButton) {
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

  codeInput.addEventListener('input', () => {
    if (feedback.textContent) {
      setFeedback('');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = codeInput.value.trim();

    if (!code) {
      setFeedback('Ingresa el código de verificación proporcionado.', 'error');
      codeInput.focus();
      return;
    }

    submitButton.disabled = true;
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Validando...';

    try {
      const result = await portalAuth.iniciarSesionConCodigo(code);
      if (result.ok) {
        setFeedback('Acceso concedido. Redirigiendo...', 'success');
        const destino = portalAuth.obtenerDestinoSeguro();
        setTimeout(() => {
          window.location.replace(destino);
        }, 400);
        return;
      }

      if (result.reason === 'invalid') {
        setFeedback('El código no es válido o está inactivo.', 'error');
      } else {
        setFeedback('No se pudo validar el código. Intenta nuevamente.', 'error');
      }
    } catch (error) {
      console.error('Error al iniciar sesión con código', error);
      setFeedback('Ocurrió un error al validar el código. Vuelve a intentarlo.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });
});
