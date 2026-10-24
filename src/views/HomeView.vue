<script setup>
import { computed } from 'vue';
import { useAuth } from '../stores/auth';
import { useRouter } from 'vue-router';

const auth = useAuth();
const router = useRouter();

// Saludo según la hora del día
const saludo = computed(() => {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 18) return 'Buenas tardes';
  return 'Buenas noches';
});

const usuarioActual = computed(() => auth.state.user?.usuario || 'Usuario');
const rolActual = computed(() => auth.state.user?.rol?.rol || 'Sin Rol');
</script>

<template>
  <div class="home-view">
    <div class="welcome-section">
      <div class="welcome-text">
        <h1>{{ saludo }}, {{ usuarioActual }} 👋</h1>
        <p>Qué bueno verte de nuevo. ¿Qué deseas hacer hoy?</p>
        <span class="role-badge">{{ rolActual }}</span>
      </div>
      <div class="welcome-image">
        <!-- Un toque visual para la derecha -->
        <div class="decorative-circle"></div>
      </div>
    </div>

    <h2 class="section-title">Accesos Rápidos</h2>
    
    <div class="cards-grid">
      <!-- Tarjeta: Productos -->
      <div 
        v-if="auth.hasPermission('productos.listar')" 
        class="action-card"
        @click="router.push('/productos')"
      >
        <div class="icon-wrapper bg-blue">📦</div>
        <div class="card-info">
          <h3>Productos</h3>
          <p>Gestiona el catálogo de hilos, fotos y colores.</p>
        </div>
      </div>

      <!-- Tarjeta: Usuarios -->
      <div 
        v-if="auth.hasPermission('usuarios.listar')" 
        class="action-card"
        @click="router.push('/usuarios')"
      >
        <div class="icon-wrapper bg-purple">👥</div>
        <div class="card-info">
          <h3>Usuarios</h3>
          <p>Administra al personal y sus roles en el sistema.</p>
        </div>
      </div>

      <!-- Tarjeta: Bodega (Catálogos) -->
      <div 
        v-if="auth.hasPermission('bodega.ver')" 
        class="action-card"
        @click="router.push('/catalogo/2')"
      >
        <div class="icon-wrapper bg-green">🏭</div>
        <div class="card-info">
          <h3>Bodega</h3>
          <p>Visualiza el mapeo físico de las estanterías y el stock.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-view {
  max-width: 1000px;
  margin: 0 auto;
  padding-top: 1rem;
}

/* --- SECCIÓN DE BIENVENIDA --- */
.welcome-section {
  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
  border-radius: 16px;
  padding: 2.5rem;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  overflow: hidden;
  margin-bottom: 2.5rem;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.15);
}

.welcome-text {
  position: relative;
  z-index: 2;
}

.welcome-text h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
}

.welcome-text p {
  margin: 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

.role-badge {
  display: inline-block;
  margin-top: 1rem;
  background: rgba(255, 255, 255, 0.2);
  padding: 0.3rem 0.8rem;
  border-radius: 99px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: capitalize;
  backdrop-filter: blur(4px);
}

/* Un círculo decorativo de fondo */
.welcome-image {
  position: absolute;
  right: -20px;
  top: -20px;
  bottom: -20px;
  width: 300px;
  overflow: hidden;
}
.decorative-circle {
  width: 300px;
  height: 300px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

/* --- TARJETAS DE ACCESO --- */
.section-title {
  font-size: 1.3rem;
  color: #334155;
  margin-bottom: 1.5rem;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.action-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: flex-start;
  gap: 1.2rem;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  transition: all 0.2s ease;
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.06);
  border-color: #cbd5e1;
}

.icon-wrapper {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

/* Colores de los iconos */
.bg-blue { background: #eff6ff; color: #2563eb; }
.bg-purple { background: #f5f3ff; color: #7c3aed; }
.bg-green { background: #ecfdf5; color: #10b981; }

.card-info h3 {
  margin: 0 0 0.4rem 0;
  color: #1e293b;
  font-size: 1.1rem;
}

.card-info p {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .welcome-section {
    padding: 1.5rem;
  }
  .welcome-text h1 {
    font-size: 1.5rem;
  }
  .welcome-text p {
    font-size: 0.95rem;
  }
}
</style>