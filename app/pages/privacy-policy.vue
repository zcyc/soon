<script setup lang="ts">
import type { Translations } from '~/utils/translations'

const { t } = useI18n()
const sections = computed(() => Object.entries(t.value.privacy).filter(([key]) => key.endsWith('Title') || key === 'introduction'))
function contentFor(titleKey: string) {
  const key = titleKey === 'introduction' ? '' : titleKey.replace(/Title$/, 'Content')
  return key ? t.value.privacy[key as keyof Translations['privacy']] : ''
}
</script>

<template>
  <article class="prose prose-slate mx-auto max-w-4xl px-4 py-10 dark:prose-invert sm:px-6">
    <h1>{{ t.privacy.title }}</h1>
    <p>{{ t.privacy.lastUpdated }}</p>
    <section v-for="[key, heading] in sections" :key="key">
      <h2 v-if="key !== 'introduction'">{{ heading }}</h2>
      <p>{{ contentFor(key) }}</p>
    </section>
  </article>
</template>
