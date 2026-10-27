/**
 * 应用入口
 * 创建 Vue 应用，注册 Pinia 与路由，并加载全局样式。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import './styles/base.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
