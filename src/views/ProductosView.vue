<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../services/api';
import { useAuth } from '../stores/auth';

const auth = useAuth();

// --- Estados de la lista ---
const productos = ref([]);
const meta = ref({});
const loadingList = ref(false);
const errorList = ref(null);

// --- Estados del Modal Crear/Editar ---
const showModal = ref(false);
const isEditing = ref(false);
const formLoading = ref(false);
const formError = ref(null);

// --- NUEVOS ESTADOS: Modal de Ajuste ---
const showAjusteModal = ref(false);
const ajusteProducto = ref(null);
const ajusteLoading = ref(false);
const ajusteError = ref(null);
const ajusteSuccess = ref(false);
const formAjuste = ref({ cantidad: 0, id_unidad: '', tipo: 'sumar', id_estanteria: '' }); // <-- Agregado id_estanteria

// --- Estados del Formulario ---
const form = ref({
  id_producto: null,
  codigo: '',
  producto: '',
  color_hex: '#CCCCCC',
  conversiones: [],
});

// Para manejar la foto
const fileInput = ref(null);
const fotoPreview = ref(null);
const fotoFile = ref(null);

// Para manejar el ingreso de stock
const stockInput = ref(0);
const stockUnidadId = ref(null);

// Listas para combos
const unidadesDB = ref([]);
const estanteriasDB = ref([]); // <-- NUEVO: Lista de estanterías

const FACTORES_FIJOS = {
  'quintal': 1600,
  'paquetes': 80,
  'libras': 16,
  'onzas': 1
};

// --- Helpers de formato ---
const mostrarStockBonito = (onzas) => {
  const num = Number(onzas);
  if (num >= 1600) return (num / 1600).toFixed(2) + ' Quintales';
  if (num >= 80) return (num / 80).toFixed(2) + ' Paquetes';
  if (num >= 16) return (num / 16).toFixed(2) + ' Libras';
  return num.toFixed(2) + ' Onzas';
};

const getFotoUrl = (filename) => {
  if (!filename) return 'https://via.placeholder.com/150?text=Sin+Foto';
  return `/uploads/${filename}`;
};

// --- 1. Cargar Productos ---
const cargarProductos = async (page = 1) => {
  loadingList.value = true;
  errorList.value = null;
  try {
    const res = await api.get(`/productos/listar?page=${page}&limit=10`);
    productos.value = res.data;
    meta.value = res.meta;
  } catch (err) {
    errorList.value = err.message;
  } finally {
    loadingList.value = false;
  }
};

// --- 2. Cargar Unidades y Estanterías ---
const cargarCombos = async () => {
  try {
    const [resUni, resEst] = await Promise.all([
      api.get('/unidades/listar'),
      api.get('/bodega/estanterias')
    ]);
    unidadesDB.value = resUni;
    estanteriasDB.value = resEst;
  } catch (err) {
    console.error('Error al cargar combos:', err);
  }
};

onMounted(async () => {
  await cargarCombos();
  await cargarProductos();
});

// --- 3. Lógica de Color ---
const extraerColorDePantalla = async () => {
  if (!window.EyeDropper) {
    alert('Tu navegador no soporta el gotero de color (usa Chrome, Edge o Brave).');
    return;
  }
  try {
    const eyeDropper = new window.EyeDropper();
    const result = await eyeDropper.open();
    form.value.color_hex = result.sRGBHex;
  } catch (e) {
    console.log('Gotero cancelado por el usuario');
  }
};

// --- 4. Manejo de Foto ---
const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    fotoFile.value = file;
    fotoPreview.value = URL.createObjectURL(file);
  }
};

// --- 5. Abrir Modal Crear / Editar ---
const abrirCrear = () => {
  isEditing.value = false;
  formError.value = null;
  fotoFile.value = null;
  fotoPreview.value = null;
  stockInput.value = 0;
  
  const convsFijas = unidadesDB.value.map(u => {
    const nombre = u.unidad_medida.toLowerCase().trim();
    const factor = FACTORES_FIJOS[nombre] || FACTORES_FIJOS[nombre.replace(/s$/, '')] || 1;
    return { id_unidad: u.id_unidad, factor_conversion: factor };
  });

  form.value = {
    id_producto: null,
    codigo: '',
    producto: '',
    color_hex: '#CCCCCC',
    conversiones: convsFijas
  };
  
  stockUnidadId.value = unidadesDB.value[0]?.id_unidad || null;
  showModal.value = true;
};

const abrirEditar = (prod) => {
  isEditing.value = true;
  formError.value = null;
  fotoFile.value = null;
  fotoPreview.value = prod.foto ? getFotoUrl(prod.foto) : null;

  const convsMap = {};
  prod.conversiones.forEach(c => { convsMap[c.id_unidad] = Number(c.factor_conversion); });

  const convsEdit = unidadesDB.value.map(u => {
    const nombre = u.unidad_medida.toLowerCase().trim();
    const factorFijo = FACTORES_FIJOS[nombre] || FACTORES_FIJOS[nombre.replace(/s$/, '')] || 1;
    return { id_unidad: u.id_unidad, factor_conversion: convsMap[u.id_unidad] || factorFijo };
  });

  form.value = {
    id_producto: prod.id_producto,
    codigo: prod.codigo,
    producto: prod.producto || '',
    color_hex: prod.color_hex || '#CCCCCC',
    conversiones: convsEdit
  };

  stockUnidadId.value = unidadesDB.value[0]?.id_unidad || null;
  if (stockUnidadId.value) {
    const convSeleccionada = form.value.conversiones.find(c => c.id_unidad === stockUnidadId.value);
    const factor = convSeleccionada ? convSeleccionada.factor_conversion : 1;
    stockInput.value = (Number(prod.stock_actual_onzas) / factor).toFixed(2);
  } else {
    stockInput.value = 0;
  }

  showModal.value = true;
};

// --- 6. Guardar Producto ---
const guardarProducto = async () => {
  formLoading.value = true;
  formError.value = null;

  try {
    const formData = new FormData();
    formData.append('codigo', form.value.codigo);
    formData.append('producto', form.value.producto || '');
    formData.append('color_hex', form.value.color_hex);

    const convsParaBackend = form.value.conversiones
      .filter(c => Number(c.factor_conversion) > 0)
      .map(c => ({ id_unidad: c.id_unidad, factor_conversion: Number(c.factor_conversion) }));
    
    formData.append('conversiones', JSON.stringify(convsParaBackend));

    if (stockInput.value >= 0 && stockUnidadId.value) {
      const convSeleccionada = form.value.conversiones.find(c => c.id_unidad === stockUnidadId.value);
      const factor = convSeleccionada ? Number(convSeleccionada.factor_conversion) : 1;
      formData.append('stock_actual_onzas', Number(stockInput.value) * factor);
    }

    if (fotoFile.value) formData.append('foto', fotoFile.value);

    if (isEditing.value) {
      await api.putForm(`/productos/actualizar/${form.value.id_producto}`, formData);
    } else {
      await api.postForm('/productos/crear', formData);
    }

    showModal.value = false;
    await cargarProductos(isEditing.value ? meta.value.page : 1);
  } catch (err) {
    formError.value = err.message;
  } finally {
    formLoading.value = false;
  }
};

// --- 7. Cambiar Estado ---
const toggleEstado = async (prod) => {
  const nuevoEstado = prod.estado === 1 ? 0 : 1;
  if (!confirm(`¿Seguro que quieres ${nuevoEstado === 1 ? 'activar' : 'desactivar'} este producto?`)) return;
  
  try {
    await api.patch(`/productos/cambio/${prod.id_producto}/estado`, { estado: nuevoEstado });
    await cargarProductos(meta.value.page);
  } catch (err) {
    alert('Error al cambiar estado: ' + err.message);
  }
};

// --- 8. NUEVA LÓGICA: Ajustar Stock ---
const abrirAjuste = (prod) => {
  ajusteProducto.value = prod;
  ajusteError.value = null;
  ajusteSuccess.value = false;
  
  formAjuste.value = {
    cantidad: 0,
    id_unidad: unidadesDB.value[0]?.id_unidad || null,
    tipo: 'sumar',
    id_estanteria: '' // Por defecto automático
  };
  
  showAjusteModal.value = true;
};

const procesarAjuste = async () => {
  if (formAjuste.value.cantidad <= 0) {
    ajusteError.value = 'La cantidad debe ser mayor a 0.';
    return;
  }
  ajusteLoading.value = true;
  ajusteError.value = null;
  ajusteSuccess.value = false;

  const cantidadFirmada = formAjuste.value.tipo === 'sumar' 
    ? Number(formAjuste.value.cantidad) 
    : -Number(formAjuste.value.cantidad);

  try {
    await api.post('/movimientos/ajuste', {
      id_producto: ajusteProducto.value.id_producto,
      id_unidad: Number(formAjuste.value.id_unidad),
      cantidad_movimiento: cantidadFirmada,
      id_estanteria: formAjuste.value.id_estanteria ? Number(formAjuste.value.id_estanteria) : null // <-- Enviamos la estantería
    });
    
    ajusteSuccess.value = true;
    await cargarProductos(meta.value.page);
    
    setTimeout(() => {
      showAjusteModal.value = false;
    }, 1500);

  } catch (err) {
    ajusteError.value = err.message;
  } finally {
    ajusteLoading.value = false;
  }
};
</script>

<template>
  <div class="productos-view">
    <header class="header">
      <div>
        <h1>Catálogo de Productos</h1>
        <p class="subtitle">Gestiona el inventario y las fotos de los hilos.</p>
      </div>
      <button v-if="auth.hasPermission('productos.crear')" @click="abrirCrear" class="btn-primary">
        + Nuevo Producto
      </button>
    </header>

    <p v-if="errorList" class="error-msg">❌ {{ errorList }}</p>

    <!-- TABLA -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Foto</th>
            <th>Código</th>
            <th>Nombre</th>
            <th>Color</th>
            <th>Stock Actual</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loadingList">
            <td colspan="7" class="text-center">Cargando productos...</td>
          </tr>
          <tr v-else-if="productos.length === 0">
            <td colspan="7" class="text-center">No hay productos registrados.</td>
          </tr>
          <tr v-for="prod in productos" :key="prod.id_producto" :class="{ 'inactivo': prod.estado === 0 }">
            <td><img :src="getFotoUrl(prod.foto)" class="img-thumb" alt="foto" /></td>
            <td><strong>{{ prod.codigo }}</strong></td>
            <td>{{ prod.producto || 'Sin nombre' }}</td>
            <td>
              <div class="color-swatch" :style="{ backgroundColor: prod.color_hex || '#ccc' }" :title="prod.color_hex"></div>
            </td>
            <td>{{ mostrarStockBonito(prod.stock_actual_onzas) }}</td>
            <td>
              <span class="badge" :class="prod.estado === 1 ? 'badge-success' : 'badge-danger'">
                {{ prod.estado === 1 ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
            <td class="actions">
              <button 
                v-if="auth.hasPermission('movimientos.corregir')" 
                @click="abrirAjuste(prod)" 
                class="btn-icon" 
                title="Ajustar Stock"
              >
                ⚖️
              </button>

              <button v-if="auth.hasPermission('productos.editar')" @click="abrirEditar(prod)" class="btn-icon" title="Editar">✏️</button>
              <button v-if="auth.hasPermission('productos.estado')" @click="toggleEstado(prod)" class="btn-icon" title="Cambiar Estado">
                {{ prod.estado === 1 ? '🚫' : '✅' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- PAGINACIÓN -->
    <div class="pagination" v-if="meta.totalPages > 1">
      <button :disabled="meta.page === 1" @click="cargarProductos(meta.page - 1)">Anterior</button>
      <span>Página {{ meta.page }} de {{ meta.totalPages }}</span>
      <button :disabled="meta.page === meta.totalPages" @click="cargarProductos(meta.page + 1)">Siguiente</button>
    </div>

    <!-- MODAL CREAR/EDITAR -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <header class="modal-header">
          <h2>{{ isEditing ? 'Editar Producto' : 'Nuevo Producto' }}</h2>
          <button @click="showModal = false" class="btn-close">✖</button>
        </header>
        <div class="modal-body">
          <p v-if="formError" class="error-msg">❌ {{ formError }}</p>
          <div class="grid-2">
            <div class="foto-section">
              <div class="foto-preview" :style="{ borderColor: form.color_hex }">
                <img v-if="fotoPreview" :src="fotoPreview" alt="Preview" />
                <span v-else>Sin Foto</span>
              </div>
              <input type="file" ref="fileInput" @change="handleFileChange" accept="image/*" class="file-input" />
              <div class="color-picker-group">
                <label>Color del Hilo:</label>
                <div class="color-controls">
                  <input type="color" v-model="form.color_hex" />
                  <button @click="extraerColorDePantalla" class="btn-secondary">💧 Gotero</button>
                </div>
                <small>{{ form.color_hex }}</small>
              </div>
            </div>
            <div class="datos-section">
              <div class="form-group">
                <label>Código (Obligatorio)</label>
                <input type="text" v-model="form.codigo" maxlength="8" placeholder="Ej. HIL001" />
              </div>
              <div class="form-group">
                <label>Nombre del Producto (Opcional)</label>
                <input type="text" v-model="form.producto" placeholder="Ej. Hilo Rojo" />
              </div>
              <div class="form-group stock-group">
                <label>{{ isEditing ? 'Ajustar Stock (Cantidad Actual)' : 'Stock Inicial' }}</label>
                <div class="stock-inputs">
                  <input type="number" v-model="stockInput" min="0" step="0.01" />
                  <select v-model="stockUnidadId">
                    <option v-for="u in unidadesDB" :key="u.id_unidad" :value="u.id_unidad">{{ u.unidad_medida }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
        <footer class="modal-footer">
          <button @click="showModal = false" class="btn-secondary" :disabled="formLoading">Cancelar</button>
          <button @click="guardarProducto" class="btn-primary" :disabled="formLoading">
            {{ formLoading ? 'Guardando...' : 'Guardar Producto' }}
          </button>
        </footer>
      </div>
    </div>

    <!-- MODAL DE AJUSTE DE STOCK -->
    <div v-if="showAjusteModal" class="modal-overlay">
      <div class="modal modal-sm">
        <header class="modal-header">
          <h2>Ajustar Stock</h2>
          <button @click="showAjusteModal = false" class="btn-close">✖</button>
        </header>
        
        <div class="modal-body">
          <div class="preview-producto">
            <div class="img-wrapper-lg">
              <img :src="getFotoUrl(ajusteProducto?.foto)" alt="foto" />
            </div>
            <div class="color-dot-lg" :style="{ backgroundColor: ajusteProducto?.color_hex || '#ccc' }"></div>
            <div class="info-preview">
              <strong>{{ ajusteProducto?.codigo }}</strong>
              <span>{{ ajusteProducto?.producto || 'Sin nombre' }}</span>
            </div>
          </div>

          <p v-if="ajusteError" class="error-msg">❌ {{ ajusteError }}</p>
          <p v-if="ajusteSuccess" class="success-msg">✅ Stock ajustado correctamente.</p>

          <!-- NUEVO: SELECTOR DE ESTANTERÍA -->
          <div class="form-group">
            <label>Estantería (Opcional)</label>
            <select v-model="formAjuste.id_estanteria">
              <option value="">Automático (Cualquier estantería)</option>
              <option v-for="est in estanteriasDB" :key="est.id_estanteria" :value="est.id_estanteria">
                {{ est.nombre }}
              </option>
            </select>
            <small class="text-muted">Si eliges una estantería, el ajuste solo afectará a sus cubículos.</small>
          </div>

          <div class="form-group">
            <label>Operación</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" v-model="formAjuste.tipo" value="sumar" /> Sumar (+)
              </label>
              <label class="radio-label">
                <input type="radio" v-model="formAjuste.tipo" value="restar" /> Restar (-)
              </label>
            </div>
          </div>

          <div class="grid-2-col">
            <div class="form-group">
              <label>Cantidad</label>
              <input type="number" v-model="formAjuste.cantidad" min="0.01" step="0.01" />
            </div>
            <div class="form-group">
              <label>Unidad</label>
              <select v-model="formAjuste.id_unidad">
                <option v-for="u in unidadesDB" :key="u.id_unidad" :value="u.id_unidad">
                  {{ u.unidad_medida }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <footer class="modal-footer">
          <button @click="showAjusteModal = false" class="btn-secondary" :disabled="ajusteLoading">Cancelar</button>
          <button @click="procesarAjuste" class="btn-primary" :disabled="ajusteLoading || ajusteSuccess">
            {{ ajusteLoading ? 'Ajustando...' : 'Confirmar Ajuste' }}
          </button>
        </footer>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Mismos estilos que tenías, no hay cambios visuales drásticos en el CSS */
.productos-view { max-width: 1200px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
h1 { margin: 0; font-size: 1.8rem; }
.subtitle { margin: 0.25rem 0 0; color: #6b7280; font-size: 0.9rem; }

.table-container { background: white; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto; -webkit-overflow-scrolling: touch; }
table { width: 100%; border-collapse: collapse; min-width: 700px; }
th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #e5e7eb; vertical-align: middle; white-space: nowrap; }
th { background: #f9fafb; font-weight: 600; color: #374151; font-size: 0.9rem; }
tr.inactivo { opacity: 0.6; background: #fef2f2; }

.img-thumb { width: 90px; height: 90px; object-fit: cover; border-radius: 8px; border: 2px solid #e5e7eb; }
.color-swatch { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #d1d5db; }

.btn-primary { background: #2563eb; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
.btn-primary:hover { background: #1d4ed8; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: #e5e7eb; color: #374151; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
.btn-secondary:hover { background: #d1d5db; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0.2rem 0.5rem; transition: transform 0.1s; }
.btn-icon:hover { transform: scale(1.2); }
.badge { padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600; }
.badge-success { background: #d1fae5; color: #065f46; }
.badge-danger { background: #fee2e2; color: #991b1b; }

.pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.5rem; flex-wrap: wrap; }
.pagination button { padding: 0.5rem 1rem; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer; }
.pagination button:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
.modal { background: white; border-radius: 12px; width: 100%; max-width: 900px; max-height: 95vh; display: flex; flex-direction: column; overflow: hidden; }
.modal-sm { max-width: 500px; }
.modal-header { padding: 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
.modal-header h2 { margin: 0; font-size: 1.3rem; }
.btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280; }
.modal-body { padding: 1.5rem; overflow-y: auto; }
.modal-footer { padding: 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 1rem; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
.grid-2-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

.foto-section { display: flex; flex-direction: column; gap: 1rem; align-items: center; }
.foto-preview { width: 100%; max-width: 320px; aspect-ratio: 1/1; border-radius: 10px; border: 4px solid #ccc; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #f3f4f6; }
.foto-preview img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
.file-input { width: 100%; max-width: 300px; font-size: 0.9rem; }
.color-picker-group { width: 100%; text-align: center; margin-top: 1rem; }
.color-controls { display: flex; align-items: center; justify-content: center; gap: 1rem; margin: 0.5rem 0; }
.color-controls input[type="color"] { width: 50px; height: 40px; padding: 0; border: none; cursor: pointer; }

.datos-section { display: flex; flex-direction: column; gap: 1.2rem; }
.form-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;}
.form-group label { font-weight: 600; font-size: 0.95rem; color: #374151; }
.form-group input, .form-group select { padding: 0.7rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; width: 100%; }

.stock-inputs { display: flex; gap: 0.5rem; width: 100%; }
.stock-inputs input { flex: 2; width: auto; min-width: 0; }
.stock-inputs select { flex: 1; width: auto; min-width: 0; }

.preview-producto { display: flex; align-items: center; gap: 1rem; background: #f9fafb; padding: 1rem; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 1.5rem; }
.img-wrapper-lg { width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 1px solid #d1d5db; background: white; display: flex; align-items: center; justify-content: center; }
.img-wrapper-lg img { width: 100%; height: 100%; object-fit: cover; }
.color-dot-lg { width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 1px #d1d5db; flex-shrink: 0; }
.info-preview { display: flex; flex-direction: column; }
.info-preview strong { font-size: 1.1rem; color: #111827; }
.info-preview span { font-size: 0.85rem; color: #6b7280; }

.radio-group { display: flex; gap: 1.5rem; margin-top: 0.5rem; }
.radio-label { display: flex; align-items: center; gap: 0.5rem; font-weight: normal; cursor: pointer; }
.radio-label input { width: auto; }

.error-msg { color: #dc2626; background: #fef2f2; padding: 0.75rem; border-radius: 6px; font-size: 0.9rem; margin-bottom: 1rem; }
.success-msg { color: #065f46; background: #d1fae5; padding: 0.75rem; border-radius: 6px; font-size: 0.9rem; margin-bottom: 1rem; }
.text-muted { color: #6b7280; }
.text-center { text-align: center; color: #6b7280; padding: 2rem !important; }

@media (max-width: 768px) {
  .header { flex-direction: column; align-items: flex-start; }
  .header .btn-primary { width: 100%; text-align: center; }
  .grid-2 { grid-template-columns: 1fr; gap: 1.5rem; }
  .foto-preview { max-width: 250px; }
  .modal-footer { flex-direction: column; }
  .modal-footer button { width: 100%; }
  table { min-width: 600px; } 
}
</style>