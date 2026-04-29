<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'

const loading = ref(false)
const openAtLogin = ref(true)
const minimizeToTray = ref(true)

async function refresh() {
  loading.value = true
  try {
    const s = await window.api.getSettings()
    openAtLogin.value = s.openAtLogin
    minimizeToTray.value = s.minimizeToTray
  } finally {
    loading.value = false
  }
}

async function save() {
  loading.value = true
  try {
    await window.api.setSettings({ openAtLogin: openAtLogin.value, minimizeToTray: minimizeToTray.value })
  } finally {
    loading.value = false
  }
}

onMounted(refresh)
</script>

<template>
  <div class="page">
    <PageHeader title="设置" subtitle="随开机启动、托盘常驻、日志策略等。" />

    <el-card class="card">
      <el-form label-position="top" @change="save">
        <el-form-item label="随开机启动（可选）">
          <div class="row">
            <el-switch v-model="openAtLogin" :loading="loading" />
            <el-text class="hint">开启后，Windows 登录后自动启动本软件以保证定时任务不漏跑。</el-text>
          </div>
        </el-form-item>

        <el-form-item label="关闭窗口最小化到托盘">
          <div class="row">
            <el-switch v-model="minimizeToTray" :loading="loading" />
            <el-text class="hint">推荐开启：关闭按钮不会退出进程，任务调度仍持续运行。</el-text>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button @click="refresh">重新读取</el-button>
          <el-button type="primary" :loading="loading" @click="save">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.page {
  max-width: 1180px;
}
.row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.hint {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}
</style>

