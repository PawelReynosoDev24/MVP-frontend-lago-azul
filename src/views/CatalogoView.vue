<script setup>
import { useRoute } from 'vue-router';
import Stand1DragDrop from './bodega/Stand1DragDrop.vue';
import Stand2Cubiculos from './bodega/Stand2Cubiculos.vue';
import Stand3Colas from './bodega/Stand3Colas.vue'; // <-- Importamos el nuevo componente

const route = useRoute();
</script>

<template>
  <div>
    <!-- Si la URL es /catalogo/1, muestra el Drag & Drop -->
    <Stand1DragDrop v-if="route.params.id === '1'" />
    
    <!-- Si la URL es /catalogo/2, muestra los cubículos numerados -->
    <Stand2Cubiculos v-else-if="route.params.id === '2'" />
    
    <!-- Si la URL es /catalogo/3, muestra las Colas y Flechas -->
    <Stand3Colas v-else-if="route.params.id === '3'" />
    
    <!-- Fallback por si escriben otro número -->
    <div v-else class="text-center" style="padding: 4rem;">
      <h1>Stand {{ route.params.id }}</h1>
      <p>Este prototipo no existe.</p>
    </div>
  </div>
</template>