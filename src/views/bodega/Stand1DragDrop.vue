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

// Para el Drag & Drop (PC)
const arrastrando = ref(null);
const dropZoneActive = ref(null);

// Para selección en Móviles (Tap)
const bloqueSeleccionado = ref(null);

// Estados del Modal (Gestión)
const showGestionModal = ref(false);
const cubiculoSeleccionado = ref(null);
const operacionLoading = ref(false);
const operacionError = ref(null);

// Estados para Ingresar
const formIngreso = ref({ id_producto: '', id_unidad: '', cantidad: 0 });
const productosDB = ref([]);
const unidadesDB = ref([]);

// --- NUEVOS ESTADOS PARA LOS COMBOBOX ---
const dropdownOpen = ref(null);

// Propiedad computada para mostrar la foto y color en el modal
const productoModal = computed(() => {
  if (!formIngreso.value.id_producto) return null;
  return productosDB.value.find(p => p.id_producto === Number(formIngreso.value.id_producto));
});

// Etiquetas para los combobox
const labelProducto = computed(() => {
  const p = productosDB.value.find(p => p.id_producto === Number(formIngreso.value.id_producto));
  return p ? `${p.codigo} - ${p.producto || 'Sin nombre'}` : 'Seleccionar...';
});
const labelUnidad = computed(() => {
  const u = unidadesDB.value.find(u => u.id_unidad === Number(formIngreso.value.id_unidad));
  return u ? u.unidad_medida : 'Seleccionar...';
});

const cargarDatos = async () => {
  loading.value = true;
  try {
    const [resEst, resProd, resUni] = await Promise.all([
      api.get('/bodega/estanterias'),
      api.get('/productos/listar?limit=100'),
      api.get('/unidades/listar')
    ]);
    
    estanterias.value = resEst;
    
    // Lógica para mantener la estantería seleccionada o agarrar la primera
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

// --- LÓGICA PARA MOVER (COMPARTIDA PC/Móvil) ---
const moverCantidad = async (origen, destino, cantidadDisponible, idProducto, codigo) => {
  let cantidadMover = cantidadDisponible;
  if (cantidadDisponible > 1) {
    const input = prompt(`¿Cuántos quintales de ${codigo} deseas mover? (Tienes ${cantidadDisponible})`, "1");
    if (!input || isNaN(input) || Number(input) <= 0 || Number(input) > cantidadDisponible) return;
    cantidadMover = Number(input);
  }

  try {
    await api.post('/bodega/mover', {
      id_producto: idProducto,
      id_cubiculo_origen: origen.id_cubiculo,
      id_cubiculo_destino: destino.id_cubiculo,
      cantidad_quintales: cantidadMover
    });
    await cargarDatos();
    bloqueSeleccionado.value = null; // Limpiar selección
  } catch (error) {
    alert('Error al mover: ' + error.message);
  }
};

// --- LÓGICA DRAG & DROP (PC) ---
const onDragStart = (event, ubicacion, cubiculoOrigen) => {
  arrastrando.value = {
    id_producto: ubicacion.id_producto,
    id_cubiculo_origen: cubiculoOrigen.id_cubiculo,
    cantidad_disponible: Number(ubicacion.cantidad_quintales),
    codigo: ubicacion.producto.codigo
  };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', ubicacion.id_producto);
};

const onDragEnd = () => {
  arrastrando.value = null;
  dropZoneActive.value = null;
};

const onDragOver = (event, cubiculoId) => {
  event.preventDefault();
  dropZoneActive.value = cubiculoId;
};

const onDragLeave = () => {
  dropZoneActive.value = null;
};

const onDrop = async (event, cubiculoDestino) => {
  event.preventDefault();
  dropZoneActive.value = null;
  if (!arrastrando.value || arrastrando.value.id_cubiculo_origen === cubiculoDestino.id_cubiculo) return;

  await moverCantidad(
    { id_cubiculo: arrastrando.value.id_cubiculo_origen },
    cubiculoDestino,
    arrastrando.value.cantidad_disponible,
    arrastrando.value.id_producto,
    arrastrando.value.codigo
  );
  arrastrando.value = null;
};

// --- LÓGICA TÁCTIL (Móvil) ---
const seleccionarBloque = (ubicacion, cub) => {
  bloqueSeleccionado.value = { ubicacion, cub };
};

const clickCubiculo = (cub) => {
  if (bloqueSeleccionado.value) {
    if (bloqueSeleccionado.value.cub.id_cubiculo === cub.id_cubiculo) {
      bloqueSeleccionado.value = null;
      return;
    }
    moverCantidad(
      bloqueSeleccionado.value.cub,
      cub,
      Number(bloqueSeleccionado.value.ubicacion.cantidad_quintales),
      bloqueSeleccionado.value.ubicacion.id_producto,
      bloqueSeleccionado.value.ubicacion.producto.codigo
    );
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
  <div class="stand1-view">
    <header class="header">
      <div>
        <h1>Bodega: Modo Libre (Drag & Drop)</h1>
        <p class="subtitle">En PC: arrastra los hilos. En Móvil: toca un hilo y luego el cubículo destino. Usa el botón + para gestionar.</p>
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

    <!-- CONTENIDO DE LA ESTANTERÍA -->
    <div v-if="estanteriaActual" class="estanteria-container">
      <h2>{{ estanteriaActual.nombre }}</h2>
      
      <div class="grid-scroll-container">
        <div 
          class="grid-bodega" 
          :style="{ gridTemplateColumns: `repeat(${Math.max(...estanteriaActual.cubiculos.map(c => c.columna))}, minmax(140px, 1fr))` }"
        >
          <div 
            v-for="cub in estanteriaActual.cubiculos" 
            :key="cub.id_cubiculo"
            class="cubiculo-card"
            :class="{ 'drop-active': dropZoneActive === cub.id_cubiculo, 'destino-valido': bloqueSeleccionado && bloqueSeleccionado.cub.id_cubiculo !== cub.id_cubiculo }"
            @dragover="onDragOver($event, cub.id_cubiculo)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, cub)"
            @click="clickCubiculo(cub)"
          >
            <div class="cub-header">
              <span class="cub-num">#{{ cub.fila }} - {{ cub.columna }}</span>
              <span class="cub-cap">{{ calcularOcupacion(cub) }} / {{ cub.capacidad_quintales }} QQ</span>
              <button class="btn-add" @click.stop="abrirGestion(cub)" title="Gestionar Cubículo">+</button>
            </div>
            
            <div class="cub-content">
              <div v-if="!cub.ubicaciones || cub.ubicaciones.length === 0" class="cub-empty">
                {{ bloqueSeleccionado ? 'Toca aquí para mover' : 'Vacío (Clic en +)' }}
              </div>
              <div v-else class="cub-products">
                <!-- BLOQUES ARRASTRABLES -->
                <div 
                  v-for="ub in cub.ubicaciones" 
                  :key="ub.id_ubicacion" 
                  class="product-block" 
                  :class="{ 'seleccionado': bloqueSeleccionado?.ubicacion.id_ubicacion === ub.id_ubicacion }"
                  :style="{ backgroundColor: getColor(ub) }"
                  draggable="true"
                  @dragstart="onDragStart($event, ub, cub)"
                  @dragend="onDragEnd"
                  @click.stop="seleccionarBloque(ub, cub)"
                  :title="`${ub.producto.codigo} - ${ub.cantidad_quintales} QQ`"
                >
                  <span class="prod-code">{{ ub.producto.codigo }}</span>
                  <span class="prod-qty">{{ ub.cantidad_quintales }} QQ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
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
              <label>Filas</label>
              <input v-model="formEstanteria.filas" type="number" min="1" placeholder="Ej: 3" />
            </div>
            <div class="form-group">
              <label>Columnas</label>
              <input v-model="formEstanteria.columnas" type="number" min="1" placeholder="Ej: 4" />
            </div>
          </div>
          <div class="form-group">
            <label>Capacidad por Cubículo (Quintales)</label>
            <input v-model="formEstanteria.capacidad" type="number" min="1" step="0.5" placeholder="Ej: 4.5" />
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

    <!-- MODAL DE GESTIÓN (INGRESO Y EGRESO) -->
    <div v-if="showGestionModal" class="modal-overlay" @click.self="dropdownOpen = null">
      <div class="modal modal-lg">
        <header class="modal-header">
          <h2>Gestionar #{{ cubiculoSeleccionado?.fila }} - {{ cubiculoSeleccionado?.columna }}</h2>
          <button @click="showGestionModal = false" class="btn-close">✖</button>
        </header>
        
        <div class="modal-body">
          <p v-if="operacionError" class="error-msg">❌ {{ operacionError }}</p>

          <!-- CONTENIDO ACTUAL (EGRESO) -->
          <div class="section">
            <h3>Contenido Actual</h3>
            <div v-if="cubiculoSeleccionado?.ubicaciones.length === 0" class="text-muted">El cubículo está vacío.</div>
            <ul class="lista-productos">
              <li v-for="ub in cubiculoSeleccionado?.ubicaciones" :key="ub.id_ubicacion">
                <div class="prod-info">
                  <div class="img-wrapper">
                    <img v-if="getFotoUrl(ub.producto.foto)" :src="getFotoUrl(ub.producto.foto)" class="prod-img" alt="foto" />
                    <span v-else class="prod-no-img">Sin foto</span>
                  </div>
                  <div class="color-dot" :style="{ backgroundColor: getColor(ub) }"></div>
                  <div class="prod-text">
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
            
            <!-- VISTA PREVIA DEL PRODUCTO -->
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
.stand1-view { max-width: 1200px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
h1 { margin: 0; font-size: 1.8rem; }
.subtitle { margin: 0.25rem 0 0; color: #6b7280; font-size: 0.9rem; }

.btn-primary { background: #2563eb; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
.btn-secondary { background: #e5e7eb; color: #374151; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
.btn-success { background: #10b981; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%; }
.btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280; }
.btn-icon { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; }

/* --- PESTAÑAS --- */
.tabs-container {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}
.tab-btn {
  background: white;
  border: 1px solid #d1d5db;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  color: #4b5563;
  white-space: nowrap;
  transition: all 0.2s;
}
.tab-btn:hover { background: #f3f4f6; }
.tab-btn.active {
  background: #2563eb;
  color: white;
  border-color: #2563eb;
}

/* --- ESTANTERÍA Y CUADRÍCULA --- */
.estanteria-container { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.estanteria-container h2 { margin-top: 0; margin-bottom: 1.5rem; }

.grid-scroll-container { width: 100%; overflow-x: auto; padding-bottom: 1rem; }
.grid-bodega { display: grid; gap: 1rem; min-width: 100%; }

.cubiculo-card { 
  background: #f9fafb; border: 2px dashed #d1d5db; border-radius: 10px; padding: 1rem;
  min-height: 140px; display: flex; flex-direction: column; transition: all 0.2s;
}
.cubiculo-card.drop-active { border-color: #3b82f6; background: #eff6ff; transform: scale(1.02); }
.cubiculo-card:hover { border-color: #93c5fd; }
.cubiculo-card.destino-valido { border-color: #10b981; background: #ecfdf5; cursor: pointer; }

.cub-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: bold; color: #4b5563; margin-bottom: 1rem; white-space: nowrap; }
.cub-num { background: #e5e7eb; padding: 0.2rem 0.5rem; border-radius: 4px; }
.cub-cap { color: #2563eb; margin-left: auto; margin-right: 0.5rem;}

.btn-add { background: #2563eb; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }

.cub-content { flex: 1; display: flex; align-items: center; justify-content: center; }
.cub-empty { color: #9ca3af; font-style: italic; font-size: 0.8rem; text-align: center; }

.cub-products { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }

/* --- BLOQUES DE PRODUCTO --- */
.product-block {
  width: 60px; height: 60px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: white; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.5); cursor: grab;
  border: 2px solid rgba(255,255,255,0.4); box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  transition: transform 0.1s, box-shadow 0.2s;
}
.product-block:active { cursor: grabbing; transform: scale(0.95); }
.product-block.seleccionado { border: 3px solid #10b981; box-shadow: 0 0 15px rgba(16, 185, 129, 0.8); transform: scale(1.1); }

.prod-code { font-size: 0.75rem; }
.prod-qty { font-size: 0.65rem; background: rgba(0,0,0,0.3); padding: 0.1rem 0.3rem; border-radius: 4px; margin-top: 2px; }

/* --- MODAL --- */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
.modal { background: white; border-radius: 12px; width: 100%; max-width: 800px; max-height: 95vh; display: flex; flex-direction: column; overflow: hidden; }
.modal-sm { max-width: 450px; }
.modal-lg { max-width: 800px; }
.modal-header { padding: 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
.modal-header h2 { margin: 0; font-size: 1.3rem; }
.modal-body { padding: 1.5rem; overflow-y: auto; }
.modal-footer { padding: 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 1rem; }

/* --- FORMULARIOS Y SECCIONES --- */
.form-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.form-group label { font-weight: 600; font-size: 0.9rem; color: #374151; }
.form-group input, .form-group select { padding: 0.6rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; width: 100%; }
.grid-2-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.grid-3-col { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1rem; }
.mt-2 { margin-top: 0.5rem; }

.section { margin-bottom: 1.5rem; }
.section h3 { font-size: 1.1rem; margin-bottom: 1rem; color: #111827; }
.border-top { border-top: 1px solid #e5e7eb; padding-top: 1.5rem; }
.lista-productos { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.lista-productos li { display: flex; justify-content: space-between; align-items: center; background: #f9fafb; padding: 0.75rem; border-radius: 8px; border: 1px solid #e5e7eb; }

.preview-producto { display: flex; align-items: center; gap: 1rem; background: #f9fafb; padding: 1rem; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 1.5rem; }
.img-wrapper-lg { width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 1px solid #d1d5db; background: white; display: flex; align-items: center; justify-content: center; }
.img-preview { width: 100%; height: 100%; object-fit: cover; }
.no-foto { font-size: 0.6rem; color: #9ca3af; text-align: center; }
.color-dot-lg { width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 1px #d1d5db; flex-shrink: 0; }
.info-preview { display: flex; flex-direction: column; }
.info-preview strong { font-size: 1.1rem; color: #111827; }
.info-preview span { font-size: 0.85rem; color: #6b7280; }

.prod-info { display: flex; align-items: center; gap: 0.75rem; }
.img-wrapper { width: 45px; height: 45px; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #f3f4f6; }
.prod-img { width: 100%; height: 100%; object-fit: cover; }
.prod-no-img { font-size: 0.55rem; color: #9ca3af; text-align: center; line-height: 1.1; }
.color-dot { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #d1d5db; flex-shrink: 0; }
.prod-text { display: flex; flex-direction: column; }
.prod-name { font-size: 0.8rem; color: #6b7280; }
.prod-actions { display: flex; align-items: center; gap: 1rem; }
.prod-cant { font-weight: bold; color: #2563eb; }
.text-muted { color: #6b7280; font-style: italic; }

/* --- COMBOBOX PERSONALIZADOS --- */
.relative { position: relative; }
.custom-select {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.6rem; border: 1px solid #d1d5db; border-radius: 6px; background: white;
  font-size: 1rem; cursor: pointer; user-select: none;
}
.custom-select:hover { border-color: #9ca3af; }
.select-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%; }
.select-arrow { font-size: 0.7rem; color: #6b7280; }
.custom-options {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 100;
  background: white; border: 1px solid #d1d5db; border-radius: 6px;
  margin-top: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  max-height: 200px; overflow-y: auto;
}
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