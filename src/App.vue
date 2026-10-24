<!-- src/App.vue -->
<script setup>
// Ya no necesitas importar nada aquí ni hacer la lógica de onMounted.
// Vue Router se encarga de restaurar la sesión y decidir qué mostrar.
</script>

<template>
  <!-- El router-view es el "hueco" donde se inyectan las vistas 
       (LoginView o MainLayout) dependiendo de la URL -->
  <router-view></router-view>
</template>

<style>
/* Estilos base globales */
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  color: #111827;
  background-color: #f3f4f6; /* Un fondo gris suave global */
}
</style>