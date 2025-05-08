const supabaseUrl = 'https://pmdnbjorfimihsyxmfzh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZG5iam9yZmltaWhzeXhtZnpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3MzUyMDAsImV4cCI6MjA2MjMxMTIwMH0.SFs7X2GqxCWGaqOShhvykPvgFAba_w0qit2sIXXH-bg';

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

async function cargarZapatos() {
  const { data, error } = await supabase
    .from('INVENTARIO')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  const contenedor = document.getElementById('lista-zapatos');
  data.forEach(zapato => {
    const div = document.createElement('div');
    div.className = 'zapato';
    div.innerHTML = `
      <h3>${zapato.nombre} (${zapato.codigo})</h3>
      <p><strong>Talla:</strong> ${zapato.talla} | <strong>Precio:</strong> Q${zapato.precio}</p>
      <p><strong>Disponibles:</strong> ${zapato.disponible}</p>
      ${zapato.imagen_url ? `<img src="${zapato.imagen_url}" width="150">` : ''}
      <p>${zapato.descripcion || ''}</p>
    `;
    contenedor.appendChild(div);
  });
}

cargarZapatos();
