import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../stores/auth';

import LoginView from '../views/LoginView.vue';
import MainLayout from '../layouts/MainLayout.vue';
import UsuariosView from '../views/UsuariosView.vue';
import ProductosView from '../views/ProductosView.vue';
import CatalogoView from '../views/CatalogoView.vue';
import HomeView from '../views/HomeView.vue';
import MovimientosView from '../views/MovimientosView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresAuth: false }
    },
    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        // CAMBIO AQUÍ: En vez de redirigir a productos, mostramos el Home
        { path: '', name: 'home', component: HomeView }, 
        { path: 'usuarios', name: 'usuarios', component: UsuariosView },
        { path: 'productos', name: 'productos', component: ProductosView },
        { path: 'catalogo/:id', name: 'catalogo', component: CatalogoView },
        { path: 'movimientos', name: 'movimientos', component: MovimientosView },
      ]
    }
  ]
});

// GUARDIA DE NAVEGACIÓN (Se mantiene igual)
router.beforeEach(async (to, from, next) => {
  const auth = useAuth();
  
  if (!auth.state.ready) {
    await auth.restore();
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);

  if (requiresAuth && !auth.isAuthenticated.value) {
    next('/login'); 
  } else if (to.path === '/login' && auth.isAuthenticated.value) {
    next('/'); 
  } else {
    next(); 
  }
});

export default router;