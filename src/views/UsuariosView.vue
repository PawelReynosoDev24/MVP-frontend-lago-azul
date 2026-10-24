<script setup>
import { ref, onMounted, computed } from 'vue';
import { api } from '../services/api';
import { useAuth } from '../stores/auth';

const auth = useAuth();

// --- Estados de la lista ---
const usuarios = ref([]);
const personas = ref([]); // Para cruzar los datos
const roles = ref([]); // Para el dropdown de roles
const loadingList = ref(false);
const errorList = ref(null);

// --- Estados del Modal ---
const showModal = ref(false);
const isEditing = ref(false);
const formLoading = ref(false);
const formError = ref(null);

// --- NUEVO: Estado para ver/ocultar contraseña ---
const showPassword = ref(false);

// --- Estados del Formulario ---
const form = ref({
  id_usuario: null,
  usuario: '',
  contrasenia: '',
  id_rol: '',
  id_persona: null,
  nombre: '',
  dpi: '',
  fecha_nacimiento: '',
  telefono: '',
  correo_electronico: '',
  direccion_domicilio: ''
});

// --- Propiedades Computadas ---
const rolSeleccionadoLabel = computed(() => {
  const r = roles.value.find(rol => rol.id_rol === Number(form.value.id_rol));
  return r ? r.rol : 'Seleccionar Rol...';
});

// --- Cargar Datos ---
const cargarDatos = async () => {
  loadingList.value = true;
  errorList.value = null;
  try {
    const [resUsuarios, resPersonas, resRoles] = await Promise.all([
      api.get('/usuarios/listar'),
      api.get('/personas/listar'),
      api.get('/roles/listar')
    ]);
    
    usuarios.value = resUsuarios;
    personas.value = resPersonas;
    roles.value = resRoles;
  } catch (err) {
    errorList.value = err.message;
  } finally {
    loadingList.value = false;
  }
};

onMounted(cargarDatos);

// Obtener los datos de la persona vinculados a un usuario
const getPersonaDeUsuario = (idUsuario) => {
  return personas.value.find(p => p.id_usuario === idUsuario);
};

// --- Abrir Modal Crear ---
const abrirCrear = () => {
  isEditing.value = false;
  formError.value = null;
  showPassword.value = false; // Reiniciar el ojo
  
  form.value = {
    id_usuario: null,
    usuario: '',
    contrasenia: '',
    id_rol: roles.value.length > 0 ? roles.value[0].id_rol : '',
    id_persona: null,
    nombre: '',
    dpi: '',
    fecha_nacimiento: '',
    telefono: '',
    correo_electronico: '',
    direccion_domicilio: ''
  };
  
  showModal.value = true;
};

// --- Abrir Modal Editar ---
const abrirEditar = (usr) => {
  isEditing.value = true;
  formError.value = null;
  showPassword.value = false; // Reiniciar el ojo

  const persona = getPersonaDeUsuario(usr.id_usuario);

  form.value = {
    id_usuario: usr.id_usuario,
    usuario: usr.usuario,
    contrasenia: '', // Vacío por defecto al editar
    id_rol: usr.id_rol,
    id_persona: persona ? persona.id_persona : null,
    nombre: persona ? persona.nombre : '',
    dpi: persona ? persona.dpi : '',
    fecha_nacimiento: persona ? persona.fecha_nacimiento : '',
    telefono: persona ? persona.telefono : '',
    correo_electronico: persona ? persona.correo_electronico : '',
    direccion_domicilio: persona ? persona.direccion_domicilio : ''
  };

  showModal.value = true;
};

// --- Guardar (Crear / Editar) ---
const guardarUsuario = async () => {
  formLoading.value = true;
  formError.value = null;

  try {
    let userId = form.value.id_usuario;

    // ---- 1. GUARDAR USUARIO ----
    if (!isEditing.value) {
      if (!form.value.contrasenia) throw new Error('La contraseña es obligatoria para un usuario nuevo.');
      
      const payloadUser = {
        usuario: form.value.usuario,
        contrasenia: form.value.contrasenia,
        id_rol: Number(form.value.id_rol)
      };
      const resUser = await api.post('/usuarios/crear', payloadUser);
      userId = resUser.id_usuario;
    } else {
      const payloadUser = {
        usuario: form.value.usuario,
        id_rol: Number(form.value.id_rol)
      };
      if (form.value.contrasenia) {
        payloadUser.contrasenia = form.value.contrasenia;
      }
      await api.put(`/usuarios/actualizar/${userId}`, payloadUser);
    }

    // ---- 2. GUARDAR PERSONA ----
    if (form.value.nombre.trim() !== '') {
      const payloadPersona = {
        nombre: form.value.nombre,
        dpi: form.value.dpi,
        fecha_nacimiento: form.value.fecha_nacimiento,
        telefono: form.value.telefono,
        correo_electronico: form.value.correo_electronico,
        direccion_domicilio: form.value.direccion_domicilio,
        id_usuario: userId
      };

      if (form.value.id_persona) {
        await api.put(`/personas/actualizar/${form.value.id_persona}`, payloadPersona);
      } else {
        await api.post('/personas/crear', payloadPersona);
      }
    }

    showModal.value = false;
    await cargarDatos();
  } catch (err) {
    formError.value = err.message;
  } finally {
    formLoading.value = false;
  }
};

// --- Cambiar Estado ---
const toggleEstado = async (usr) => {
  const nuevoEstado = usr.estado === 1 ? 0 : 1;
  if (!confirm(`¿Seguro que quieres ${nuevoEstado === 1 ? 'activar' : 'desactivar'} al usuario ${usr.usuario}?`)) return;
  
  try {
    await api.patch(`/usuarios/cambio/${usr.id_usuario}/estado`, { estado: nuevoEstado });
    await cargarDatos();
  } catch (err) {
    alert('Error al cambiar estado: ' + err.message);
  }
};
</script>

<template>
  <div class="usuarios-view">
    <header class="header">
      <div>
        <h1>Gestión de Usuarios y Personas</h1>
        <p class="subtitle">Administra el acceso al sistema y los datos personales de cada colaborador.</p>
      </div>
      <button v-if="auth.hasPermission('usuarios.crear')" @click="abrirCrear" class="btn-primary">
        + Nuevo Usuario
      </button>
    </header>

    <p v-if="errorList" class="error-msg">❌ {{ errorList }}</p>

    <!-- TABLA -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Nombre Completo</th>
            <th>DPI</th>
            <th>Contacto</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loadingList">
            <td colspan="7" class="text-center">Cargando usuarios...</td>
          </tr>
          <tr v-else-if="usuarios.length === 0">
            <td colspan="7" class="text-center">No hay usuarios registrados.</td>
          </tr>
          
          <tr v-for="usr in usuarios" :key="usr.id_usuario" :class="{ 'inactivo': usr.estado === 0 }">
            <td><strong>{{ usr.usuario }}</strong></td>
            <td>
              <span class="badge badge-rol">{{ usr.rol?.rol || 'Sin Rol' }}</span>
            </td>
            <td>
              <template v-if="getPersonaDeUsuario(usr.id_usuario)">
                {{ getPersonaDeUsuario(usr.id_usuario).nombre }}
              </template>
              <span v-else class="text-muted">Sin perfil creado</span>
            </td>
            <td>
              <template v-if="getPersonaDeUsuario(usr.id_usuario)">
                {{ getPersonaDeUsuario(usr.id_usuario).dpi }}
              </template>
              <span v-else class="text-muted">-</span>
            </td>
            <td>
              <template v-if="getPersonaDeUsuario(usr.id_usuario)">
                <div class="contacto-info">
                  <span>📞 {{ getPersonaDeUsuario(usr.id_usuario).telefono }}</span>
                  <span>✉️ {{ getPersonaDeUsuario(usr.id_usuario).correo_electronico }}</span>
                </div>
              </template>
              <span v-else class="text-muted">-</span>
            </td>
            <td>
              <span class="badge" :class="usr.estado === 1 ? 'badge-success' : 'badge-danger'">
                {{ usr.estado === 1 ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
            <td class="actions">
              <button v-if="auth.hasPermission('usuarios.editar')" @click="abrirEditar(usr)" class="btn-icon" title="Editar">✏️</button>
              <button v-if="auth.hasPermission('usuarios.estado')" @click="toggleEstado(usr)" class="btn-icon" title="Cambiar Estado">
                {{ usr.estado === 1 ? '🚫' : '✅' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL CREAR/EDITAR -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <header class="modal-header">
          <h2>{{ isEditing ? 'Editar Usuario' : 'Nuevo Usuario y Persona' }}</h2>
          <button @click="showModal = false" class="btn-close">✖</button>
        </header>

        <div class="modal-body">
          <p v-if="formError" class="error-msg">❌ {{ formError }}</p>

          <div class="form-sections">
            
            <!-- SECCIÓN 1: DATOS DE ACCESO (USUARIO) -->
            <div class="section-card">
              <h3>1. Datos de Acceso</h3>
              
              <div class="form-group">
                <label>Nombre de Usuario</label>
                <input type="text" v-model="form.usuario" placeholder="Ej: juan.perez" />
              </div>

              <!-- CAMBIO AQUÍ: Input de contraseña con botón de ojo personalizado -->
              <div class="form-group">
                <label>{{ isEditing ? 'Nueva Contraseña (opcional)' : 'Contraseña' }}</label>
                <div class="password-wrapper">
                  <input 
                    :type="showPassword ? 'text' : 'password'" 
                    v-model="form.contrasenia" 
                    placeholder="••••••••" 
                  />
                  <button 
                    type="button" 
                    class="toggle-password" 
                    @click="showPassword = !showPassword"
                    tabindex="-1"
                    :title="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  >
                    <!-- Ícono de Ojo Abierto -->
                    <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <!-- Ícono de Ojo Cerrado -->
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  </button>
                </div>
                <small v-if="isEditing" class="text-muted">Deja en blanco para mantener la actual.</small>
              </div>

              <div class="form-group relative">
                <label>Rol del Sistema</label>
                <select v-model="form.id_rol" class="custom-input">
                  <option v-for="r in roles" :key="r.id_rol" :value="r.id_rol">
                    {{ r.rol }}
                  </option>
                </select>
              </div>
            </div>

            <!-- SECCIÓN 2: DATOS PERSONALES -->
            <div class="section-card">
              <h3>2. Datos Personales <small>(Opcional)</small></h3>
              
              <div class="form-group">
                <label>Nombre Completo</label>
                <input type="text" v-model="form.nombre" placeholder="Ej: Juan Pérez" />
              </div>

              <div class="grid-2-col">
                <div class="form-group">
                  <label>DPI</label>
                  <input type="text" v-model="form.dpi" maxlength="13" placeholder="13 dígitos" />
                </div>
                <div class="form-group">
                  <label>Fecha de Nacimiento</label>
                  <input type="date" v-model="form.fecha_nacimiento" />
                </div>
              </div>

              <div class="grid-2-col">
                <div class="form-group">
                  <label>Teléfono</label>
                  <input type="text" v-model="form.telefono" placeholder="Ej: 12345678" />
                </div>
                <div class="form-group">
                  <label>Correo Electrónico</label>
                  <input type="email" v-model="form.correo_electronico" placeholder="correo@ejemplo.com" />
                </div>
              </div>

              <div class="form-group">
                <label>Dirección de Domicilio</label>
                <input type="text" v-model="form.direccion_domicilio" placeholder="Ej: Calle Falsa 123" />
              </div>
            </div>

          </div>
        </div>

        <footer class="modal-footer">
          <button @click="showModal = false" class="btn-secondary" :disabled="formLoading">Cancelar</button>
          <button @click="guardarUsuario" class="btn-primary" :disabled="formLoading">
            {{ formLoading ? 'Guardando...' : 'Guardar Todo' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.usuarios-view { max-width: 1200px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
h1 { margin: 0; font-size: 1.8rem; }
.subtitle { margin: 0.25rem 0 0; color: #6b7280; font-size: 0.9rem; }

/* --- TABLA RESPONSIVA --- */
.table-container { background: white; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto; }
table { width: 100%; border-collapse: collapse; min-width: 800px; }
th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
th { background: #f9fafb; font-weight: 600; color: #374151; font-size: 0.9rem; }
tr.inactivo { opacity: 0.6; background: #fef2f2; }

.contacto-info { display: flex; flex-direction: column; font-size: 0.85rem; color: #4b5563; }

/* --- BOTONES Y BADGES --- */
.btn-primary { background: #2563eb; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
.btn-primary:hover { background: #1d4ed8; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: #e5e7eb; color: #374151; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
.btn-secondary:hover { background: #d1d5db; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0.2rem 0.5rem; }

.badge { padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600; text-transform: capitalize; }
.badge-success { background: #d1fae5; color: #065f46; }
.badge-danger { background: #fee2e2; color: #991b1b; }
.badge-rol { background: #e0f2fe; color: #0369a1; }

/* --- MODAL --- */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
.modal { background: white; border-radius: 12px; width: 100%; max-width: 800px; max-height: 95vh; display: flex; flex-direction: column; overflow: hidden; }
.modal-header { padding: 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
.modal-header h2 { margin: 0; font-size: 1.3rem; }
.btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280; }
.modal-body { padding: 1.5rem; overflow-y: auto; background: #f8fafc; }
.modal-footer { padding: 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 1rem; background: white; }

/* --- FORMULARIO --- */
.form-sections {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 1.5rem;
}

.section-card {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.section-card h3 { margin-top: 0; margin-bottom: 1.5rem; font-size: 1.1rem; color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; }
.section-card h3 small { font-size: 0.8rem; color: #64748b; font-weight: normal; }

.form-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.2rem; }
.form-group label { font-weight: 600; font-size: 0.9rem; color: #374151; }
.form-group input, .custom-input { padding: 0.65rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; width: 100%; box-sizing: border-box; }
.form-group input:focus, .custom-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }

/* --- NUEVOS ESTILOS PARA EL INPUT DE CONTRASEÑA --- */
.password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.password-wrapper input {
  padding-right: 2.5rem; /* Espacio para el ícono */
}
.toggle-password {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem;
  border-radius: 4px;
}
.toggle-password:hover {
  color: #374151;
  background-color: #f3f4f6;
}

.grid-2-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

.error-msg { color: #dc2626; background: #fef2f2; padding: 0.75rem; border-radius: 6px; font-size: 0.9rem; margin-bottom: 1rem; }
.text-muted { color: #9ca3af; font-style: italic; font-size: 0.9rem; }
.text-center { text-align: center; color: #6b7280; padding: 2rem !important; }

/* --- RESPONSIVE --- */
@media (max-width: 768px) {
  .header { flex-direction: column; align-items: flex-start; }
  .header .btn-primary { width: 100%; text-align: center; }
  
  .form-sections { grid-template-columns: 1fr; gap: 1rem; }
  .grid-2-col { grid-template-columns: 1fr; }
  
  .modal-footer { flex-direction: column; }
  .modal-footer button { width: 100%; }
}
</style>