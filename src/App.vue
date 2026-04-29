<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { Bell, Document, Expand, Fold, List, Odometer, Setting } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const active = computed(() => {
  const p = route.path
  if (p.startsWith('/dashboard')) return '/dashboard'
  if (p.startsWith('/tasks')) return '/tasks'
  if (p.startsWith('/logs')) return '/logs'
  if (p.startsWith('/settings')) return '/settings'
  return '/dashboard'
})

function go(index: string) {
  router.push(index)
}

const collapsed = ref(false)

const pageTitle = computed(() => {
  const p = active.value
  if (p === '/dashboard') return '概览'
  if (p === '/tasks') return '任务'
  if (p === '/logs') return '日志'
  return '设置'
})
</script>

<template>
  <el-config-provider :locale="zhCn">
    <div class="appShell">
      <aside class="sidebar" :class="{ collapsed }">
        <div class="brand" :class="{ collapsed }">
          <div class="logoMark">T</div>
          <div v-if="!collapsed" class="brandText">
            <div class="brandTitle">任务调度台</div>
            <div class="brandSub">Cron · Python · 日志</div>
          </div>
        </div>
        <el-menu :default-active="active" class="menu" :collapse="collapsed" @select="go">
          <el-menu-item index="/dashboard">
            <el-icon><Odometer /></el-icon>
            <span>概览</span>
          </el-menu-item>
          <el-menu-item index="/tasks">
            <el-icon><List /></el-icon>
            <span>任务</span>
          </el-menu-item>
          <el-menu-item index="/logs">
            <el-icon><Document /></el-icon>
            <span>日志</span>
          </el-menu-item>
          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <span>设置</span>
          </el-menu-item>
        </el-menu>
      </aside>

      <main class="main">
        <div class="topbar">
          <div class="topbarLeft">
            <el-button text class="collapseBtn" @click="collapsed = !collapsed">
              <el-icon>
                <Fold v-if="!collapsed" />
                <Expand v-else />
              </el-icon>
            </el-button>
            <div class="crumb">
              <span class="crumbCur">{{ pageTitle }}</span>
            </div>
          </div>
          <div class="topbarRight">
            <el-button circle>
              <el-icon><Bell /></el-icon>
            </el-button>
          </div>
        </div>

        <div class="content">
          <div class="pageContainer">
            <router-view />
          </div>
        </div>
      </main>
    </div>
  </el-config-provider>
</template>

<style scoped>
.appShell {
  display: grid;
  grid-template-columns: auto 1fr;
  height: 100vh;
  background: var(--app-bg);
  color: var(--app-text);
}

.sidebar {
  padding: 16px 12px;
  border-right: 1px solid var(--app-border);
  background: #ffffff;
  transition: width 160ms ease;
  width: var(--layout-sider-width);
  overflow: hidden;
}

.sidebar.collapsed {
  width: var(--layout-sider-collapsed-width);
  padding: 16px 10px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.12), rgba(22, 119, 255, 0.02));
  border: 1px solid rgba(22, 119, 255, 0.18);
  margin-bottom: 14px;
}

.brand.collapsed {
  justify-content: center;
  padding: 10px 0;
}

.logoMark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #ffffff;
  font-weight: 900;
  background: linear-gradient(135deg, #1677ff, #69b1ff);
  box-shadow: 0 10px 22px rgba(22, 119, 255, 0.28);
}

.brandText {
  display: grid;
}

.brandTitle {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.2px;
}

.brandSub {
  font-size: 12px;
  color: var(--app-text-muted);
  margin-top: 4px;
}

.menu {
  border-right: none;
  background: transparent;
  --el-menu-bg-color: transparent;
  --el-menu-text-color: rgba(15, 23, 42, 0.72);
  --el-menu-hover-bg-color: rgba(22, 119, 255, 0.08);
  --el-menu-active-color: var(--el-color-primary);
  --el-menu-item-height: 42px;
  --el-menu-level-padding: 14px;
}

.main {
  display: grid;
  grid-template-rows: var(--layout-header-height) 1fr;
  overflow: hidden;
  background: var(--app-bg);
}

.topbar {
  height: var(--layout-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid var(--app-border);
}

.topbarLeft {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbarRight {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapseBtn {
  padding: 8px;
  border-radius: 8px;
}

.crumbCur {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}

.content {
  overflow: auto;
  padding: var(--layout-content-padding);
}

.content :deep(.page) {
  max-width: 1200px;
}

.pageContainer {
  margin: 0 auto;
  max-width: 1200px;
}
</style>

