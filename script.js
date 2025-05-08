const supabaseUrl = 'https://pmdnbjorfimihsyxmfzh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // pega aquí tu ANON_KEY completo

const supabase = supabase.createClient(supabaseUrl, supabaseKey);

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
