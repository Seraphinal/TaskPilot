import { createRouter, createWebHashHistory } from 'vue-router'

const Dashboard = () => import('../views/Dashboard.vue')
const Tasks = () => import('../views/Tasks.vue')
const Logs = () => import('../views/Logs.vue')
const Settings = () => import('../views/Settings.vue')

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: Dashboard },
    { path: '/tasks', component: Tasks },
    { path: '/logs', component: Logs },
    { path: '/settings', component: Settings },
  ],
})

