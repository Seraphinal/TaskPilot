<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  extra?: string
}>()
</script>

<template>
  <div class="pageHeader">
    <div class="left">
      <div class="title">{{ title }}</div>
      <div v-if="subtitle" class="subtitle">{{ subtitle }}</div>
    </div>
    <div class="right">
      <slot name="extra" />
    </div>
  </div>
</template>

<style scoped>
.pageHeader {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 16px;
  padding: 4px 0;
}
.left {
  display: grid;
  gap: 6px;
}
.title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.2px;
}
.subtitle {
  font-size: 12px;
  color: var(--app-text-muted);
}
.right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>

