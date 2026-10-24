<script setup>
import { ref, onMounted, computed } from 'vue';
import { api } from '../../services/api';
import { useAuth } from '../../stores/auth';

const auth = useAuth();

// --- Estados de la Bodega ---
const estanterias = ref([]);
const estanteriaActual = ref(null);
const loading = ref(false);

// --- Estados del Modal de Creación ---
const showCrearModal = ref(false);
const formEstanteria = ref({ nombre: '', filas: '', columnas: '', capacidad: '' });
const creando = ref(false);

// --- Estados del Modal de Gestión (Ingreso/Egreso) ---
const showGestionModal = ref(false);
const cubiculoSeleccionado = ref(null);
const operacionLoading = ref(false);
const operacionError = ref(null);

// --- ESTADOS PARA EL MODAL DE MOVER EN COLA ---
const showMoverModal = ref(false);
const moveContext = ref({ cub: null, colIndex: null, filaIndex: null, ub: null, direccion: null });
const moveCantidad = ref(0);

// --- Estados para Ingresar ---
const formIngreso = ref({ id_producto: '', id_unidad: '', cantidad: 0 });
const productosDB = ref([]);
const unidadesDB = ref([]);
const dropdownOpen = ref(null);

// --- Propiedades Computadas ---
const productoModal = computed(() => {
  if (!formIngreso.value.id_producto) return null;
  return productosDB.value.find(p => p.id_producto === Number(formIngreso.value.id_producto));
});

const labelProducto = computed(() => {
  const p = productosDB.value.find(p => p.id_producto === Number(formIngreso.value.id_producto));
  return p ? `${p.codigo} - ${p.producto || 'Sin nombre'}` : 'Seleccionar...';
});
const labelUnidad = computed(() => {
  const u = unidadesDB.value.find(u => u.id_unidad === Number(formIngreso.value.id_unidad));
  return u ? u.unidad_medida : 'Seleccionar...';
});

// Agrupamos por columnas (para la lógica de movimiento vertical)
const columnasBodega = computed(() => {
  if (!estanteriaActual.value) return [];
  const cols = {};
  estanteriaActual.value.cubiculos.forEach(c => {
    if (!cols[c.columna]) cols[c.columna] = [];
    cols[c.columna].push(c);
  });
  const colKeys = Object.keys(cols).sort((a, b) => a - b);
  return colKeys.map(k => cols[k].sort((a, b) => a.fila - b.fila));
});

// Agrupamos por filas (para dibujar la Tabla de la estantería)
const filasBodega = computed(() => {
  if (!estanteriaActual.value) return [];
  const rows = {};
  estanteriaActual.value.cubiculos.forEach(c => {
    if (!rows[c.fila]) rows[c.fila] = [];
    rows[c.fila].push(c);
  });
  const rowKeys = Object.keys(rows).sort((a, b) => a - b);
  return rowKeys.map(k => rows[k].sort((a, b) => a.columna - b.columna));
});

// --- Cargar Datos ---
const cargarDatos = async () => {
  loading.value = true;
  try {
    const [resEst, resProd, resUni] = await Promise.all([
      api.get('/bodega/estanterias'),
      api.get('/productos/listar?limit=100'),
      api.get('/unidades/listar')
    ]);
    
    estanterias.value = resEst;
    if (estanterias.value.length > 0) {
      if (!estanteriaActual.value) {
        estanteriaActual.value = estanterias.value[0];
      } else {
        const actualizada = estanterias.value.find(e => e.id_estanteria === estanteriaActual.value.id_estanteria);
        estanteriaActual.value = actualizada || estanterias.value[0];
      }
    } else {
      estanteriaActual.value = null;
    }

    productosDB.value = resProd.data;
    unidadesDB.value = resUni;
    
    if (unidadesDB.value.length > 0) formIngreso.value.id_unidad = unidadesDB.value[0].id_unidad;
    if (productosDB.value.length > 0) formIngreso.value.id_producto = productosDB.value[0].id_producto;
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
};

onMounted(cargarDatos);

// --- Crear Estantería ---
const crearEstanteria = async () => {
  if (!formEstanteria.value.nombre || !formEstanteria.value.filas || !formEstanteria.value.columnas || !formEstanteria.value.capacidad) {
    alert('Por favor, completa todos los campos para crear la estantería.');
    return;
  }

  creando.value = true;
  try {
    const payload = {
      nombre: formEstanteria.value.nombre,
      filas: Number(formEstanteria.value.filas),
      columnas: Number(formEstanteria.value.columnas),
      capacidad_por_cubiculo: Number(formEstanteria.value.capacidad)
    };
    await api.post('/bodega/estanterias', payload);
    
    formEstanteria.value = { nombre: '', filas: '', columnas: '', capacidad: '' };
    showCrearModal.value = false;
    
    await cargarDatos();
  } catch (err) {
    alert('Error al crear: ' + err.message);
  } finally {
    creando.value = false;
  }
};

// --- LÓGICA DE COLAS (FLECHAS) ---
const prepararMovimiento = (cub, colIndex, filaIndex, ub, direccion) => {
  moveContext.value = { cub, colIndex, filaIndex, ub, direccion };
  moveCantidad.value = Number(ub.cantidad_quintales);
  showMoverModal.value = true;
};

// Función que busca el siguiente espacio disponible (salta llenos o con 3 colores)
const encontrarDestino = (colIndex, filaIndex, direccion, idProducto, cantidad) => {
  const col = columnasBodega.value[colIndex];
  let curr = filaIndex + (direccion === 'abajo' ? 1 : -1);
  
  while (curr >= 0 && curr < col.length) {
    const c = col[curr];
    const sumQty = c.ubicaciones.reduce((s, u) => s + Number(u.cantidad_quintales), 0);
    const spaceLeft = Number(c.capacidad_quintales) - sumQty;
    const hasProduct = c.ubicaciones.find(u => u.id_producto === idProducto);
    
    if (spaceLeft >= cantidad) {
      if (hasProduct || c.ubicaciones.length < 3) {
        return c; // ¡Encontramos espacio!
      }
    }
    curr += (direccion === 'abajo' ? 1 : -1);
  }
  return null; // No hay espacio
};

const ejecutarMoverCola = async () => {
  const { cub, colIndex, filaIndex, ub, direccion } = moveContext.value;
  const cant = Number(moveCantidad.value);
  
  if (cant <= 0 || cant > Number(ub.cantidad_quintales)) {
    return alert('La cantidad debe ser mayor a 0 y no puede exceder lo disponible.');
  }

  const destino = encontrarDestino(colIndex, filaIndex, direccion, ub.id_producto, cant);
  
  if (!destino) {
    return alert('No se encontró espacio disponible en los siguientes cubículos de esta columna.');
  }

  operacionLoading.value = true;
  try {
    await api.post('/bodega/mover', {
      id_producto: ub.id_producto,
      id_cubiculo_origen: cub.id_cubiculo,
      id_cubiculo_destino: destino.id_cubiculo,
      cantidad_quintales: cant
    });
    showMoverModal.value = false;
    await cargarDatos();
  } catch (error) {
    alert('Error al mover: ' + error.message);
  } finally {
    operacionLoading.value = false;
  }
};

// --- LÓGICA DEL MODAL DE GESTIÓN ---
const abrirGestion = (cubiculo) => {
  cubiculoSeleccionado.value = cubiculo;
  formIngreso.value.cantidad = 0;
  operacionError.value = null;
  dropdownOpen.value = null;
  
  if (productosDB.value.length > 0) formIngreso.value.id_producto = productosDB.value[0].id_producto;
  showGestionModal.value = true;
};

const calcularOcupacion = (cubiculo) => {
  if (!cubiculo.ubicaciones) return 0;
  return cubiculo.ubicaciones.reduce((sum, u) => sum + Number(u.cantidad_quintales), 0);
};

const procesarIngreso = async () => {
  if (formIngreso.value.cantidad <= 0) return;
  operacionLoading.value = true;
  operacionError.value = null;
  try {
    await api.post('/movimientos/ingreso', {
      id_producto: Number(formIngreso.value.id_producto),
      id_unidad: Number(formIngreso.value.id_unidad),
      cantidad_movimiento: Number(formIngreso.value.cantidad),
      id_cubiculo: cubiculoSeleccionado.value.id_cubiculo
    });
    await cargarDatos();
    cubiculoSeleccionado.value = estanteriaActual.value.cubiculos.find(c => c.id_cubiculo === cubiculoSeleccionado.value.id_cubiculo);
    formIngreso.value.cantidad = 0;
  } catch (error) {
    operacionError.value = error.message;
  } finally {
    operacionLoading.value = false;
  }
};

const procesarEgreso = async (ubicacion) => {
  const cant = prompt(`¿Cuántos quintales de ${ubicacion.producto.codigo} deseas egresar/retirar?`);
  if (!cant || isNaN(cant) || Number(cant) <= 0) return;

  operacionLoading.value = true;
  operacionError.value = null;
  try {
    await api.post('/movimientos/egreso', {
      id_producto: ubicacion.id_producto,
      id_unidad: 1,
      cantidad_movimiento: Number(cant),
      id_cubiculo: cubiculoSeleccionado.value.id_cubiculo
    });
    await cargarDatos();
    cubiculoSeleccionado.value = estanteriaActual.value.cubiculos.find(c => c.id_cubiculo === cubiculoSeleccionado.value.id_cubiculo);
  } catch (error) {
    operacionError.value = error.message;
  } finally {
    operacionLoading.value = false;
  }
};

const getColor = (ubicacion) => ubicacion.producto?.color_hex || '#ccc';
// Antes:
// const getFotoUrl = (filename) => filename ? `/uploads/${filename}` : null;

// Después:
const getFotoUrl = (filename) => {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename; // URL de Cloudinary
  return `/uploads/${filename}`; // Foto local antigua
};
</script>

<template>
  <div class="stand3-view">
    <header class="header">
      <div>
        <h1>Bodega: Modo Cola (FIFO)</h1>
        <p class="subtitle">Mueve los hilos con las flechas ⬆️ ⬇️. El sistema buscará el próximo espacio disponible en la misma columna.</p>
      </div>
      <button v-if="auth.hasPermission('bodega.editar')" @click="showCrearModal = true" class="btn-primary">
        + Crear Estantería
      </button>
    </header>

    <p v-if="loading" class="text-center">Cargando...</p>

    <!-- ESTADO VACÍO -->
    <div v-if="!loading && estanterias.length === 0" class="empty-state">
      <h2>No hay estanterías creadas</h2>
      <p>Crea una estantería para empezar a mapear tus productos.</p>
      <button v-if="auth.hasPermission('bodega.editar')" @click="showCrearModal = true" class="btn-primary">
        Crear mi primera estantería
      </button>
    </div>

    <!-- SELECTOR DE ESTANTERÍAS (PESTAÑAS) -->
    <div v-if="estanterias.length > 1" class="tabs-container">
      <button 
        v-for="est in estanterias" 
        :key="est.id_estanteria"
        class="tab-btn"
        :class="{ active: estanteriaActual?.id_estanteria === est.id_estanteria }"
        @click="estanteriaActual = est"
      >
        {{ est.nombre }}
      </button>
    </div>

    <!-- CONTENIDO DE LA ESTANTERÍA (TABLA) -->
    <div v-if="estanteriaActual" class="estanteria-container">
      <h2>{{ estanteriaActual.nombre }}</h2>
      
      <div class="table-responsive">
        <table class="bodega-table">
          <!-- CABECERA (Nombres de Columnas) -->
          <thead>
            <tr>
              <th class="corner-cell">Fila / Col</th>
              <th v-for="(col, cIndex) in columnasBodega" :key="cIndex" class="col-header">
                Columna {{ cIndex + 1 }}
              </th>
            </tr>
          </thead>
          
          <tbody>
            <!-- FILAS -->
            <tr v-for="(fila, rIndex) in filasBodega" :key="rIndex">
              <!-- Etiqueta de la Fila -->
              <td class="row-header">Fila {{ rIndex + 1 }}</td>
              
              <!-- CUBÍCULOS -->
              <td 
                v-for="(cub, cIndex) in fila" 
                :key="cub.id_cubiculo" 
                class="cubby-cell"
              >
                <div class="cubby-container">
                  <!-- Header del Cubículo -->
                  <div class="cub-header">
                    <span class="cub-cap">{{ calcularOcupacion(cub) }} / {{ cub.capacidad_quintales }} QQ</span>
                    <button class="btn-add" @click="abrirGestion(cub)" title="Ingresar/Retirar">+</button>
                  </div>

                  <!-- Contenido del Cubículo -->
                  <div class="cub-content">
                    <div v-if="!cub.ubicaciones || cub.ubicaciones.length === 0" class="cub-empty">
                      Vacío
                    </div>
                    <div v-else class="cub-products">
                      <div 
                        v-for="ub in cub.ubicaciones" 
                        :key="ub.id_ubicacion" 
                        class="product-block" 
                        :style="{ backgroundColor: getColor(ub) }"
                      >
                        <!-- SOLUCIÓN: Cambié 'prod-info' por 'block-info' para que no choque con el modal -->
                        <div class="block-info">
                          <span class="prod-code">{{ ub.producto.codigo }}</span>
                          <span class="prod-qty">{{ ub.cantidad_quintales }} QQ</span>
                        </div>
                        <div class="prod-arrows">
                          <button @click.stop="prepararMovimiento(cub, cIndex, rIndex, ub, 'arriba')" :disabled="rIndex === 0" title="Mover Arriba">⬆️</button>
                          <button @click.stop="prepararMovimiento(cub, cIndex, rIndex, ub, 'abajo')" :disabled="rIndex === filasBodega.length - 1" title="Mover Abajo">⬇️</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL CREAR ESTANTERÍA -->
    <div v-if="showCrearModal" class="modal-overlay">
      <div class="modal modal-sm">
        <header class="modal-header">
          <h2>Nueva Estantería</h2>
          <button @click="showCrearModal = false" class="btn-close">✖</button>
        </header>
        <div class="modal-body">
          <div class="form-group">
            <label>Nombre del Estante</label>
            <input v-model="formEstanteria.nombre" type="text" placeholder="Ej: Estante Principal" />
          </div>
          <div class="grid-2-col">
            <div class="form-group">
              <label>Filas (Horizontal)</label>
              <input v-model="formEstanteria.filas" type="number" min="1" placeholder="Ej: 4" />
            </div>
            <div class="form-group">
              <label>Columnas (Vertical)</label>
              <input v-model="formEstanteria.columnas" type="number" min="1" placeholder="Ej: 6" />
            </div>
          </div>
          <div class="form-group">
            <label>Capacidad por Cubículo (Quintales)</label>
            <input v-model="formEstanteria.capacidad" type="number" min="1" step="0.5" placeholder="Ej: 6.0" />
          </div>
        </div>
        <footer class="modal-footer">
          <button @click="showCrearModal = false" class="btn-secondary">Cancelar</button>
          <button @click="crearEstanteria" class="btn-primary" :disabled="creando">
            {{ creando ? 'Creando...' : 'Crear Estante' }}
          </button>
        </footer>
      </div>
    </div>

    <!-- MODAL DE MOVER EN COLA -->
    <div v-if="showMoverModal" class="modal-overlay">
      <div class="modal modal-sm">
        <header class="modal-header">
          <h2>Mover Producto</h2>
          <button @click="showMoverModal = false" class="btn-close">✖</button>
        </header>
        <div class="modal-body">
          <p class="text-muted mb-3">
            Moviendo <strong>{{ moveContext.ub?.producto.codigo }}</strong> 
            {{ moveContext.direccion === 'abajo' ? 'hacia abajo ⬇️' : 'hacia arriba ⬆️' }}
          </p>
          
          <div class="form-group">
            <label>Cantidad a mover (QQ)</label>
            <input v-model="moveCantidad" type="number" min="0.01" step="0.1" :max="moveContext.ub?.cantidad_quintales" />
            <small class="text-muted">Máximo disponible: {{ moveContext.ub?.cantidad_quintales }} QQ</small>
          </div>
          
          <p class="text-muted" style="font-size: 0.8rem; margin-top: 1rem;">
            Se buscará el siguiente cubículo con espacio. Si el de abajo está lleno o tiene 3 colores, se saltará al próximo.
          </p>
        </div>
        <footer class="modal-footer">
          <button @click="showMoverModal = false" class="btn-secondary">Cancelar</button>
          <button @click="ejecutarMoverCola" class="btn-primary" :disabled="operacionLoading">
            {{ operacionLoading ? 'Moviendo...' : 'Mover' }}
          </button>
        </footer>
      </div>
    </div>

    <!-- MODAL DE GESTIÓN (INGRESO Y EGRESO) -->
    <div v-if="showGestionModal" class="modal-overlay" @click.self="dropdownOpen = null">
      <div class="modal modal-lg">
        <header class="modal-header">
          <h2>Gestionar Fila {{ cubiculoSeleccionado?.fila }} - Columna {{ cubiculoSeleccionado?.columna }}</h2>
          <button @click="showGestionModal = false" class="btn-close">✖</button>
        </header>
        
        <div class="modal-body">
          <p v-if="operacionError" class="error-msg">❌ {{ operacionError }}</p>

          <!-- CONTENIDO ACTUAL (EGRESO) -->
          <div class="section">
            <h3>Contenido Actual</h3>
            <div v-if="cubiculoSeleccionado?.ubicaciones.length === 0" class="text-muted">El cubículo está vacío.</div>
            <ul class="lista-productos">
              <!-- SOLUCIÓN: Usé la clase 'modal-product' para que se vea igual que la vista previa -->
              <li v-for="ub in cubiculoSeleccionado?.ubicaciones" :key="ub.id_ubicacion">
                <div class="modal-product">
                  <div class="img-wrapper-modal">
                    <img v-if="getFotoUrl(ub.producto.foto)" :src="getFotoUrl(ub.producto.foto)" class="prod-img" alt="foto" />
                    <span v-else class="prod-no-img">Sin foto</span>
                  </div>
                  <div class="color-dot-modal" :style="{ backgroundColor: getColor(ub) }"></div>
                  <div class="prod-text-modal">
                    <strong>{{ ub.producto.codigo }}</strong>
                    <span class="prod-name">{{ ub.producto.producto || 'Sin nombre' }}</span>
                  </div>
                </div>
                <div class="prod-actions">
                  <span class="prod-cant">{{ ub.cantidad_quintales }} QQ</span>
                  <button @click="procesarEgreso(ub)" class="btn-icon" title="Retirar/Egresar">➖</button>
                </div>
              </li>
            </ul>
          </div>

          <!-- INGRESO -->
          <div class="section border-top">
            <h3>Ingresar Mercancía</h3>
            
            <div v-if="productoModal" class="preview-producto">
              <div class="img-wrapper-lg">
                <img v-if="getFotoUrl(productoModal.foto)" :src="getFotoUrl(productoModal.foto)" class="img-preview" alt="foto" />
                <span v-else class="no-foto">Sin foto</span>
              </div>
              <div class="color-dot-lg" :style="{ backgroundColor: productoModal.color_hex || '#ccc' }"></div>
              <div class="info-preview">
                <strong>{{ productoModal.codigo }}</strong>
                <span>{{ productoModal.producto || 'Sin nombre' }}</span>
              </div>
            </div>

            <div class="grid-3-col">
              <!-- COMBOBOX PRODUCTO -->
              <div class="form-group relative">
                <label>Producto</label>
                <div class="custom-select" @click="dropdownOpen = dropdownOpen === 'producto' ? null : 'producto'">
                  <span class="select-label">{{ labelProducto }}</span>
                  <span class="select-arrow">▼</span>
                </div>
                <div v-if="dropdownOpen === 'producto'" class="custom-options">
                  <div 
                    v-for="p in productosDB" :key="p.id_producto"
                    class="custom-option"
                    :class="{ 'selected': formIngreso.id_producto === p.id_producto }"
                    @click="formIngreso.id_producto = p.id_producto; dropdownOpen = null"
                  >
                    {{ p.codigo }} - {{ p.producto || 'Sin nombre' }}
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label>Cantidad</label>
                <input v-model="formIngreso.cantidad" type="number" min="0.01" step="0.1" />
              </div>

              <!-- COMBOBOX UNIDAD -->
              <div class="form-group relative">
                <label>Unidad</label>
                <div class="custom-select" @click="dropdownOpen = dropdownOpen === 'unidad' ? null : 'unidad'">
                  <span class="select-label">{{ labelUnidad }}</span>
                  <span class="select-arrow">▼</span>
                </div>
                <div v-if="dropdownOpen === 'unidad'" class="custom-options">
                  <div 
                    v-for="u in unidadesDB" :key="u.id_unidad"
                    class="custom-option"
                    :class="{ 'selected': formIngreso.id_unidad === u.id_unidad }"
                    @click="formIngreso.id_unidad = u.id_unidad; dropdownOpen = null"
                  >
                    {{ u.unidad_medida }}
                  </div>
                </div>
              </div>
            </div>
            
            <button @click="procesarIngreso" class="btn-success mt-2" :disabled="operacionLoading">
              ⬇️ Ingresar Producto
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* --- ESTILOS GENERALES --- */
.stand3-view { max-width: 1200px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
h1 { margin: 0; font-size: 1.8rem; }
.subtitle { margin: 0.25rem 0 0; color: #6b7280; font-size: 0.9rem; }

/* --- PESTAÑAS --- */
.tabs-container { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 0.5rem; }
.tab-btn { background: white; border: 1px solid #d1d5db; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-weight: 600; color: #4b5563; white-space: nowrap; transition: all 0.2s; }
.tab-btn:hover { background: #f3f4f6; }
.tab-btn.active { background: #2563eb; color: white; border-color: #2563eb; }

/* --- DISEÑO DE TABLA (ESTANTERÍA) --- */
.estanteria-container { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.estanteria-container h2 { margin-top: 0; margin-bottom: 1.5rem; }

.table-responsive { width: 100%; overflow-x: auto; padding-bottom: 1rem; }

.bodega-table { width: 100%; border-collapse: collapse; min-width: 800px; }

.bodega-table th { background: #f1f5f9; border: 2px solid #cbd5e1; padding: 1rem 0.5rem; text-align: center; font-weight: bold; color: #334155; }
.corner-cell { background: #e2e8f0 !important; width: 80px; }
.row-header { background: #f1f5f9; border: 2px solid #cbd5e1; padding: 1rem 0.5rem; text-align: center; font-weight: bold; color: #334155; width: 80px; }

.cubby-cell { border: 2px solid #cbd5e1; padding: 0.5rem; vertical-align: top; min-width: 180px; background: #ffffff; }
.cubby-container { display: flex; flex-direction: column; height: 100%; min-height: 120px; }

.cub-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; font-weight: bold; color: #4b5563; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px dashed #e2e8f0; }
.cub-cap { color: #2563eb; }
.btn-add { background: #10b981; color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; transition: transform 0.1s; }
.btn-add:hover { transform: scale(1.1); }

.cub-content { flex: 1; display: flex; flex-direction: column; justify-content: flex-start; }
.cub-empty { color: #9ca3af; font-style: italic; font-size: 0.75rem; text-align: center; padding-top: 1rem; }
.cub-products { display: flex; flex-direction: column; gap: 0.4rem; width: 100%; }

/* --- BLOQUES DE PRODUCTO CON FLECHAS (EN LA TABLA) --- */
.product-block { width: 100%; padding: 0.4rem 0.5rem; border-radius: 6px; display: flex; flex-direction: row; align-items: center; justify-content: space-between; color: white; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.5); box-shadow: 0 1px 3px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.2); }

/* Renombrado a block-info para que no choque con el modal */
.block-info { display: flex; flex-direction: column; }
.prod-code { font-size: 0.8rem; }
.prod-qty { font-size: 0.7rem; }

.prod-arrows { display: flex; flex-direction: column; gap: 2px; }
.prod-arrows button { background: rgba(0,0,0,0.2); border: none; color: white; border-radius: 3px; cursor: pointer; padding: 1px 5px; font-size: 0.65rem; transition: background 0.2s; }
.prod-arrows button:hover:not(:disabled) { background: rgba(0,0,0,0.4); }
.prod-arrows button:disabled { opacity: 0.3; cursor: not-allowed; }

/* --- MODALES --- */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
.modal { background: white; border-radius: 12px; width: 100%; max-width: 800px; max-height: 95vh; display: flex; flex-direction: column; overflow: hidden; }
.modal-sm { max-width: 450px; }
.modal-lg { max-width: 800px; }
.modal-header { padding: 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
.modal-header h2 { margin: 0; font-size: 1.3rem; }
.modal-body { padding: 1.5rem; overflow-y: auto; }
.modal-footer { padding: 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 1rem; }

/* FORMULARIOS Y BOTONES */
.btn-primary { background: #2563eb; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
.btn-secondary { background: #e5e7eb; color: #374151; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
.btn-success { background: #10b981; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%;}
.btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280; }
.btn-icon { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; }

.form-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.form-group label { font-weight: 600; font-size: 0.9rem; color: #374151; }
.form-group input, .form-group select { padding: 0.6rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; width: 100%; }
.grid-2-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.grid-3-col { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1rem; }
.mt-2 { margin-top: 0.5rem; }
.mb-3 { margin-bottom: 1rem; }

.section { margin-bottom: 1.5rem; }
.section h3 { font-size: 1.1rem; margin-bottom: 1rem; color: #111827; }
.border-top { border-top: 1px solid #e5e7eb; padding-top: 1.5rem; }
.lista-productos { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.lista-productos li { display: flex; justify-content: space-between; align-items: center; background: #f9fafb; padding: 0.75rem; border-radius: 8px; border: 1px solid #e5e7eb; }

/* =========================================
   DISEÑO DE LA LISTA DEL MODAL (CONTENIDO ACTUAL)
   ========================================= */
.modal-product { display: flex; align-items: center; gap: 1rem; }
.img-wrapper-modal { width: 45px; height: 45px; border-radius: 6px; overflow: hidden; border: 1px solid #d1d5db; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: white; }
.prod-img { width: 100%; height: 100%; object-fit: cover; }
.prod-no-img { font-size: 0.55rem; color: #9ca3af; text-align: center; line-height: 1.1; }
.color-dot-modal { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #d1d5db; flex-shrink: 0; }
.prod-text-modal { display: flex; flex-direction: column; }
.prod-text-modal strong { font-size: 1.05rem; color: #111827; }
.prod-name { font-size: 0.8rem; color: #6b7280; }
.prod-actions { display: flex; align-items: center; gap: 1rem; }
.prod-cant { font-weight: bold; color: #2563eb; }

/* =========================================
   DISEÑO DEL PREVIEW (INGRESAR MERCANCÍA)
   ========================================= */
.preview-producto { display: flex; align-items: center; gap: 1rem; background: #f9fafb; padding: 1rem; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 1.5rem; }
.img-wrapper-lg { width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 1px solid #d1d5db; background: white; display: flex; align-items: center; justify-content: center; }
.img-preview { width: 100%; height: 100%; object-fit: cover; }
.no-foto { font-size: 0.6rem; color: #9ca3af; text-align: center; }
.color-dot-lg { width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 1px #d1d5db; flex-shrink: 0; }
.info-preview { display: flex; flex-direction: column; }
.info-preview strong { font-size: 1.1rem; color: #111827; }
.info-preview span { font-size: 0.85rem; color: #6b7280; }

/* COMBOBOX */
.relative { position: relative; }
.custom-select { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem; border: 1px solid #d1d5db; border-radius: 6px; background: white; font-size: 1rem; cursor: pointer; user-select: none; }
.custom-select:hover { border-color: #9ca3af; }
.select-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%; }
.select-arrow { font-size: 0.7rem; color: #6b7280; }
.custom-options { position: absolute; top: 100%; left: 0; right: 0; z-index: 100; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-height: 200px; overflow-y: auto; }
.custom-option { padding: 0.6rem; cursor: pointer; border-bottom: 1px solid #f3f4f6; font-size: 0.95rem; }
.custom-option:last-child { border-bottom: none; }
.custom-option:hover { background: #eff6ff; }
.custom-option.selected { background: #dbeafe; font-weight: 600; color: #1e40af; }

.empty-state { text-align: center; padding: 4rem 2rem; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.empty-state h2 { margin-top: 0; }
.empty-state p { color: #6b7280; margin-bottom: 1.5rem; }

@media (max-width: 768px) {
  .header { flex-direction: column; align-items: flex-start; }
  .header .btn-primary { width: 100%; text-align: center; }
  .grid-3-col { grid-template-columns: 1fr; gap: 0; }
  .grid-2-col { grid-template-columns: 1fr; gap: 0; }
  .modal-footer { flex-direction: column; }
  .modal-footer button { width: 100%; }
}
</style>