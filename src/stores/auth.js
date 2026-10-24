// src/stores/auth.js
// ============================================================================
// STORE DE AUTENTICACIÓN
// ============================================================================
// Estado global de la sesión. Cualquier componente puede importar useAuth()
// y acceder al usuario, permisos, y acciones (login, logout, restore).
//
// No usamos Pinia (aún) para mantenerlo simple. Un objeto 'reactive'
// exportado funciona igual para este tamaño de app.
// ============================================================================

import { reactive, computed } from 'vue';
import { api, getToken, setToken, removeToken, setUnauthorizedHandler } from '../services/api';

const state = reactive({
  user: null,           // { id_usuario, usuario, rol: { id_rol, rol } }
  permissions: [],      // ['usuarios.listar', 'roles.crear', ...]
  ready: false,         // true cuando ya intentamos restaurar la sesión
  loading: false,       // true mientras hay una petición en curso
  error: null,          // mensaje de error del último login
});

// Si el backend responde 401 en cualquier petición, el api helper nos avisa
// y limpiamos la sesión. Así el usuario vuelve al login automáticamente.
setUnauthorizedHandler(() => {
  state.user = null;
  state.permissions = [];
  state.ready = true;
});

// --- Getters ---
const isAuthenticated = computed(() => !!state.user);

// Comprueba si el usuario actual tiene un permiso concreto
const hasPermission = (code) => state.permissions.includes(code);

// --- Acciones ---

// Login: llama al backend, guarda el token y los datos del usuario
async function login(usuario, contrasenia) {
  state.loading = true;
  state.error = null;
  try {
    const data = await api.post('/auth/login', { usuario, contrasenia });
    setToken(data.token);
    state.user = data.usuario;
    state.permissions = data.permisos;
    return true;
  } catch (err) {
    state.error = err.message;
    return false;
  } finally {
    state.loading = false;
  }
}

// Restore: al recargar la página, intenta rehidratar la sesión con /me.
// Si no hay token o el token expiró, deja al usuario deslogueado.
async function restore() {
  state.loading = true;
  const token = getToken();

  if (!token) {
    state.ready = true;
    state.loading = false;
    return;
  }

  try {
    const data = await api.get('/auth/me');
    state.user = data.usuario;
    state.permissions = data.permisos;
  } catch (_) {
    // Token inválido/expirado → limpiar
    removeToken();
    state.user = null;
    state.permissions = [];
  } finally {
    state.ready = true;
    state.loading = false;
  }
}

// Logout: borra el token y limpia el estado
function logout() {
  removeToken();
  state.user = null;
  state.permissions = [];
  state.ready = true;
}

// --- API pública del store ---
export const useAuth = () => ({
  state,
  isAuthenticated,
  hasPermission,
  login,
  restore,
  logout,
});