import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/tokens.css'
import './styles/base.css'
import './styles/utilities.css'
import App from './App.vue'
import { router } from './router'
import { setRouter } from './platform/navigation'
import { useUserStore } from './stores/user'

const app = createApp(App)
app.use(createPinia())

// 先把会话恢复好再装路由并挂载：否则直访 /me 时守卫会因为没有 token 而误判为未登录
const userStore = useUserStore()

void userStore.hydrate().finally(() => {
  setRouter(router)
  app.use(router)
  app.mount('#app')
})