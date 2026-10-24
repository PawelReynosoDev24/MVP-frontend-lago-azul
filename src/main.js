import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from './router'; // <-- Importamos el router

createApp(App).use(router).mount('#app'); // <-- Lo usamos