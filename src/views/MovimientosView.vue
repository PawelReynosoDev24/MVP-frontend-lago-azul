<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../services/api';

// --- Estados de la lista ---
const movimientos = ref([]);
const meta = ref({});
const loadingList = ref(false);
const errorList = ref(null);

// --- Estados de los filtros ---
const filtroTipo = ref('');
const filtroProducto = ref('');
const productosDB = ref([]);

// --- Cargar Movimientos ---
const cargarMovimientos = async (page = 1) => {
  loadingList.value = true;
  errorList.value = null;
  try {
    // Armamos los query params
    let url = `/movimientos/listar?page=${page}&limit=15`;
    if (filtroTipo.value) url += `&tipo_movimiento=${filtroTipo.value}`;
    if (filtroProducto.value) url += `&id_producto=${filtroProducto.value}`;

    const res = await api.get(url);
    movimientos.value = res.data;
    meta.value = res.meta;
  } catch (err) {
    errorList.value = err.message;
  } finally {
    loadingList.value = false;
  }
};

// --- Cargar Productos para el filtro ---
const cargarProductos = async () => {
  try {
    const res = await api.get('/productos/listar?limit=100');
    productosDB.value = res.data;
  } catch (err) {
    console.error('Error al cargar productos:', err);
  }
};

onMounted(async () => {
  await cargarProductos();
  await cargarMovimientos();
});

// --- Helpers ---
// Antes:
// const getFotoUrl = (filename) => {
//   if (!filename) return 'https://via.placeholder.com/150?text=Sin+Foto';
//   return `/uploads/${filename}`;
// };

// Después:
const getFotoUrl = (filename) => {
  if (!filename) return 'https://via.placeholder.com/150?text=Sin+Foto';
  // Si es una URL de Cloudinary (empieza con http), la devolvemos tal cual
  if (filename.startsWith('http')) return filename;
  // Si es una foto vieja guardada localmente, usamos la ruta local
  return `/uploads/${filename}`; 
};

const formatearFecha = (fechaStr) => {
  const fecha = new Date(fechaStr);
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(fecha);
};

const getBadgeClass = (tipo) => {
  if (tipo === 'ingreso') return 'badge-ingreso';
  if (tipo === 'egreso') return 'badge-egreso';
  return 'badge-ajuste';
};

const getSigno = (cantidad) => {
  const num = Number(cantidad);
  return num > 0 ? '+' : '';
};
</script>

<template>
  <div class="movimientos-view">
    <header class="header">
      <div>
        <h1>Historial de Movimientos</h1>
        <p class="subtitle">Registro de ingresos, egresos y ajustes de inventario.</p>
      </div>
    </header>

    <!-- FILTROS -->
    <div class="filters-container">
      <div class="filter-group">
        <label>Tipo de Movimiento</label>
        <select v-model="filtroTipo" @change="cargarMovimientos(1)" class="form-select">
          <option value="">Todos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
          <option value="ajuste">Ajustes</option>
        </select>
      </div>

      <div class="filter-group">
        <label>Producto</label>
        <select v-model="filtroProducto" @change="cargarMovimientos(1)" class="form-select">
          <option value="">Todos los productos</option>
          <option v-for="p in productosDB" :key="p.id_producto" :value="p.id_producto">
            {{ p.codigo }} - {{ p.producto || 'Sin nombre' }}
          </option>
        </select>
      </div>
    </div>

    <p v-if="errorList" class="error-msg">❌ {{ errorList }}</p>

    <!-- TABLA -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Fecha y Hora</th>
            <th>Usuario</th>
            <th>Producto</th>
            <th>Tipo</th>
            <th>Cantidad</th>
            <th>Equivalente en Onzas</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loadingList">
            <td colspan="6" class="text-center">Cargando movimientos...</td>
          </tr>
          <tr v-else-if="movimientos.length === 0">
            <td colspan="6" class="text-center">No hay movimientos registrados.</td>
          </tr>

          <tr v-for="mov in movimientos" :key="mov.id_movimiento">
            <!-- Fecha -->
            <td class="fecha-cell">{{ formatearFecha(mov.fecha_hora) }}</td>
            
            <!-- Usuario -->
            <td>
              <div class="user-info">
                <span class="user-icon">👤</span>
                <strong>{{ mov.usuario?.usuario || 'Desconocido' }}</strong>
              </div>
            </td>

            <!-- Producto -->
            <td>
              <div class="product-cell">
                <img :src="getFotoUrl(mov.producto?.foto)" class="img-thumb" alt="foto" />
                <div class="prod-details">
                  <strong>{{ mov.producto?.codigo }}</strong>
                  <span class="color-swatch" :style="{ backgroundColor: mov.producto?.color_hex || '#ccc' }"></span>
                </div>
              </div>
            </td>

            <!-- Tipo -->
            <td>
              <span class="badge" :class="getBadgeClass(mov.tipo_movimiento)">
                {{ mov.tipo_movimiento }}
              </span>
            </td>

            <!-- Cantidad -->
            <td class="cantidad-cell" :class="{ 'positivo': Number(mov.cantidad_movimiento) > 0, 'negativo': Number(mov.cantidad_movimiento) < 0 }">
              {{ getSigno(mov.cantidad_movimiento) }}{{ mov.cantidad_movimiento }} {{ mov.unidad?.unidad_medida }}
            </td>

            <!-- Onzas (Equivalente) -->
            <td class="onzas-cell" :class="{ 'positivo': Number(mov.cantidad_onzas) > 0, 'negativo': Number(mov.cantidad_onzas) < 0 }">
              {{ getSigno(mov.cantidad_onzas) }}{{ mov.cantidad_onzas }} oz
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- PAGINACIÓN -->
    <div class="pagination" v-if="meta.totalPages > 1">
      <button :disabled="meta.page === 1" @click="cargarMovimientos(meta.page - 1)">Anterior</button>
      <span>Página {{ meta.page }} de {{ meta.totalPages }}</span>
      <button :disabled="meta.page === meta.totalPages" @click="cargarMovimientos(meta.page + 1)">Siguiente</button>
    </div>
  </div>
</template>

<style scoped>
.movimientos-view { max-width: 1200px; margin: 0 auto; }
.header { margin-bottom: 2rem; }
h1 { margin: 0; font-size: 1.8rem; }
.subtitle { margin: 0.25rem 0 0; color: #6b7280; font-size: 0.9rem; }

/* --- FILTROS --- */
.filters-container {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  background: white;
  padding: 1rem;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  flex-wrap: wrap;
}
.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 200px;
}
.filter-group label { font-size: 0.85rem; font-weight: 600; color: #4b5563; }
.form-select { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.95rem; width: 100%; }

/* --- TABLA --- */
.table-container { background: white; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto; }
table { width: 100%; border-collapse: collapse; min-width: 800px; }
th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
th { background: #f9fafb; font-weight: 600; color: #374151; font-size: 0.9rem; }

/* --- CELDAS ESPECÍFICAS --- */
.fecha-cell { font-size: 0.85rem; color: #4b5563; white-space: nowrap; }

.user-info { display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; }
.user-icon { background: #e0f2fe; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.8rem; }

.product-cell { display: flex; align-items: center; gap: 0.75rem; }
.img-thumb { width: 45px; height: 45px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
.prod-details { display: flex; flex-direction: column; gap: 0.3rem; }
.color-swatch { width: 14px; height: 14px; border-radius: 50%; border: 1px solid #d1d5db; display: inline-block; }

/* --- BADGES DE TIPO --- */
.badge { padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600; text-transform: capitalize; }
.badge-ingreso { background: #d1fae5; color: #065f46; }
.badge-egreso { background: #fee2e2; color: #991b1b; }
.badge-ajuste { background: #fef3c7; color: #92400e; border: 1px dashed #d97706; }

/* --- CANTIDADES --- */
.cantidad-cell { font-weight: 600; font-size: 1rem; }
.onzas-cell { font-weight: 600; font-size: 0.9rem; color: #6b7280; }
.positivo { color: #059669; }
.negativo { color: #dc2626; }

/* --- PAGINACIÓN Y UTILS --- */
.pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.5rem; }
.pagination button { padding: 0.5rem 1rem; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer; }
.pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
.error-msg { color: #dc2626; background: #fef2f2; padding: 0.75rem; border-radius: 6px; font-size: 0.9rem; }
.text-center { text-align: center; color: #6b7280; padding: 2rem !important; }

@media (max-width: 768px) {
  .filters-container { flex-direction: column; }
}
</style>