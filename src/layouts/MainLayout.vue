<script setup>
import { ref } from 'vue';
import { useAuth } from '../stores/auth';
import { useRouter } from 'vue-router';

const auth = useAuth();
const router = useRouter();

// Estado para controlar el menú en móviles
const isSidebarOpen = ref(false);

const cerrarSesion = () => {
  auth.logout();
  router.push('/login');
};

// Cierra el sidebar al hacer clic en un enlace (útil en móviles)
const closeSidebar = () => {
  isSidebarOpen.value = false;
};
</script>

<template>
  <div class="app-layout">
    <!-- OVERLAY OSCURO PARA MÓVILES -->
    <div 
      v-if="isSidebarOpen" 
      class="sidebar-overlay" 
      @click="isSidebarOpen = false"
    ></div>

    <!-- SIDEBAR -->
    <aside class="sidebar" :class="{ 'is-open': isSidebarOpen }">
      <div class="brand">
        <h2>Lago Azul</h2>
        <button class="close-mobile-btn" @click="isSidebarOpen = false">✖</button>
      </div>

      <nav class="menu">
        <!-- NUEVO: Enlace de Inicio (Siempre visible para todos los logueados) -->
        <router-link @click="closeSidebar" to="/" class="menu-item">
          🏠 Inicio
        </router-link>

        <!-- Separador visual (opcional) -->
        <div class="menu-divider"></div>

        <router-link @click="closeSidebar" v-if="auth.hasPermission('usuarios.listar')" to="/usuarios" class="menu-item">
          👥 Usuarios
        </router-link>

        <router-link @click="closeSidebar" v-if="auth.hasPermission('productos.listar')" to="/productos" class="menu-item">
          📦 Productos
        </router-link>

        <template v-if="auth.hasPermission('bodega.ver')">
          <div class="menu-label">Bodega / Catálogos</div>
          <router-link @click="closeSidebar" to="/catalogo/1" class="menu-item sub-item">🎨 Catálogo 1</router-link>
          <router-link @click="closeSidebar" to="/catalogo/2" class="menu-item sub-item">🎨 Catálogo 2</router-link>
          <router-link @click={closeSidebar} to="/catalogo/3" class="menu-item sub-item">🎨 Catálogo 3</router-link>
        </template>

        <!-- NUEVO: Movimientos -->
        <router-link @click="closeSidebar" v-if="auth.hasPermission('movimientos.listar')" to="/movimientos" class="menu-item">
          🔄 Movimientos
        </router-link>
      </nav>

      <div class="user-section">
        <div class="user-info">
          <span class="user-name">{{ auth.state.user?.usuario }}</span>
          <span class="user-role">{{ auth.state.user?.rol?.rol }}</span>
        </div>
        <button class="logout-btn" @click="cerrarSesion">Cerrar Sesión</button>
      </div>
    </aside>

    <!-- CONTENIDO PRINCIPAL -->
    <div class="main-wrapper">
      <!-- BARRA SUPERIOR SOLO PARA MÓVILES -->
      <header class="mobile-header">
        <button class="hamburger-btn" @click="isSidebarOpen = true">☰</button>
        <span class="mobile-brand">Lago Azul</span>
        <div style="width: 40px;"></div> <!-- Espaciador para centrar -->
      </header>

      <main class="main-content">
        <router-view></router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  background: #f3f4f6;
  overflow: hidden;
}

/* --- SIDEBAR --- */
.sidebar {
  width: 260px;
  background: #1e293b;
  color: white;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
  z-index: 100;
}

.brand {
  padding: 1.5rem;
  border-bottom: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.brand h2 { margin: 0; color: #38bdf8; }
.close-mobile-btn { display: none; background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer; }

.menu { flex: 1; padding: 1rem 0; overflow-y: auto; }
.menu-item {
  display: block;
  padding: 0.75rem 1.5rem;
  color: #cbd5e1;
  text-decoration: none;
  transition: background 0.2s;
  font-weight: 500;
}
.menu-item:hover, .menu-item.router-link-active { background: #334155; color: white; }
.menu-label { padding: 1rem 1.5rem 0.5rem; font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
.sub-item { padding-left: 2.5rem; font-size: 0.9rem; }

.user-section { padding: 1.5rem; border-top: 1px solid #334155; background: #0f172a; }
.user-info { margin-bottom: 1rem; display: flex; flex-direction: column; }
.user-name { font-weight: bold; }
.user-role { font-size: 0.8rem; color: #94a3b8; }
.logout-btn { width: 100%; padding: 0.5rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; }
.logout-btn:hover { background: #dc2626; }

/* --- MAIN WRAPPER --- */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.main-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* --- RESPONSIVE (MÓVILES Y TABLETS) --- */
.sidebar-overlay {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 99;
}

.mobile-header {
  display: none;
  background: #1e293b;
  color: white;
  padding: 1rem;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}
.hamburger-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  width: 40px;
  text-align: left;
}
.mobile-brand { font-weight: bold; font-size: 1.2rem; color: #38bdf8; }

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0; left: 0; bottom: 0;
    transform: translateX(-100%);
  }
  .sidebar.is-open {
    transform: translateX(0);
  }
  .sidebar-overlay {
    display: block;
  }
  .mobile-header {
    display: flex;
  }
  .close-mobile-btn {
    display: block;
  }
  .main-content {
    padding: 1rem;
  }
}

.menu-divider {
  height: 1px;
  background: #334155;
  margin: 0.5rem 1.5rem;
}
</style>