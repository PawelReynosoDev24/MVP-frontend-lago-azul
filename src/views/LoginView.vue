<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';
import logoUrl from '../assets/logo.jpg'; // Asegúrate de que el archivo se llame así

const auth = useAuth();
const router = useRouter();
const usuario = ref('');
const contrasenia = ref('');

// --- NUEVOS ESTADOS ---
const showPassword = ref(false);
const localError = ref('');
let errorTimeout = null;

// Escuchar cuando el store de auth arroje un error
watch(() => auth.state.error, (newError) => {
  if (newError) {
    localError.value = newError;
    
    // Limpiamos el temporizador anterior si es que había uno
    if (errorTimeout) clearTimeout(errorTimeout);
    
    // Ocultamos el mensaje después de 3 segundos (3000 ms)
    errorTimeout = setTimeout(() => {
      localError.value = '';
    }, 3000);
  }
});

// Limpiamos el temporizador si el componente se destruye
onUnmounted(() => {
  if (errorTimeout) clearTimeout(errorTimeout);
});

const enviar = async () => {
  localError.value = ''; // Limpiar error visual al intentar de nuevo
  
  const exito = await auth.login(usuario.value.trim(), contrasenia.value);
  
  if (exito) {
    router.push('/'); 
  }
};
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      
      <!-- LOGO -->
      <div class="logo-container">
        <img :src="logoUrl" alt="Logo Lago Azul" class="logo" />
      </div>

      <h1>Hilos Lago Azul</h1>
      <p class="subtitle">Ingresa tus credenciales para acceder al sistema</p>

      <form @submit.prevent="enviar">
        <div class="field">
          <label for="usuario">Usuario</label>
          <div class="input-wrapper">
            <!-- Icono de Usuario -->
            <span class="input-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </span>
            <input
              id="usuario"
              v-model="usuario"
              type="text"
              autocomplete="username"
              placeholder="Tu nombre de usuario"
              required
              :disabled="auth.state.loading"
            />
          </div>
        </div>

        <div class="field">
          <label for="contrasenia">Contraseña</label>
          <div class="input-wrapper">
            <!-- Icono de Candado -->
            <span class="input-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </span>
            <input
              id="contrasenia"
              v-model="contrasenia"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
              required
              :disabled="auth.state.loading"
            />
            
            <!-- BOTÓN DEL OJO -->
            <button 
              type="button" 
              class="toggle-password" 
              @click="showPassword = !showPassword"
              tabindex="-1"
              :title="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            >
              <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            </button>
          </div>
        </div>

        <!-- MENSAJE DE ERROR (Desaparece a los 3 segundos) -->
        <div class="error-container">
          <transition name="fade">
            <p v-if="localError" class="error">❌ {{ localError }}</p>
          </transition>
        </div>

        <button type="submit" class="btn-login" :disabled="auth.state.loading">
          {{ auth.state.loading ? 'Entrando...' : 'Iniciar Sesión' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  /* Fondo con un sutil degradado azul muy claro */
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  padding: 1.5rem;
}

.login-card {
  background: white;
  padding: 2.5rem 2rem;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05), 0 4px 10px rgba(0, 0, 0, 0.03);
  width: 100%;
  max-width: 400px;
  border: 1px solid #f1f5f9;
}

.logo-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.logo {
  width: 120px;
  height: 120px;
  object-fit: contain;
  /* Si el logo no tiene fondo transparente, puedes descomentar esto para hacerlo circular */
  /* border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.1); */
}

h1 {
  margin: 0 0 0.5rem;
  color: #1e3a8a; /* Azul más oscuro */
  text-align: center;
  font-size: 1.6rem;
}

.subtitle {
  margin: 0 0 2rem;
  color: #64748b;
  text-align: center;
  font-size: 0.95rem;
}

.field {
  margin-bottom: 1.2rem;
}

label {
  display: block;
  margin-bottom: 0.4rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: #334155;
}

/* --- ESTILOS DEL INPUT CON ICONOS --- */
.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 0.8rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
}

input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem; /* Espacio para el icono de la izquierda */
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 1rem;
  color: #1e293b;
  transition: all 0.2s;
  box-sizing: border-box;
}

input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

input:focus + .input-icon {
  color: #3b82f6;
}

/* --- BOTÓN DEL OJO --- */
.toggle-password {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
}

.toggle-password:hover {
  color: #1e293b;
  background-color: #f1f5f9;
}

/* --- MENSAJE DE ERROR --- */
.error-container {
  min-height: 24px; /* Mantiene el espacio para que no baile el botón */
  margin-bottom: 0.5rem;
}

.error {
  color: #dc2626;
  background-color: #fef2f2;
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 0.85rem;
  margin: 0;
  text-align: center;
  border: 1px solid #fecaca;
}

/* Animación para que el error aparezca y desaparezca suavemente */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* --- BOTÓN DE LOGIN --- */
.btn-login {
  width: 100%;
  padding: 0.85rem;
  margin-top: 0.5rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
}

.btn-login:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-login:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>