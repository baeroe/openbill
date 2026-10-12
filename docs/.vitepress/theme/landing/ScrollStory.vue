<script setup lang="ts">
import { withBase } from 'vitepress';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { href, isExternal } from './links';

export interface Step {
    title: string;
    text: string;
    image: string;
    alt: string;
    more: { text: string; link: string };
}

defineProps<{ steps: Step[] }>();

const active = ref(0);
const list = ref<HTMLElement>();
let observer: IntersectionObserver | undefined;

onMounted(() => {
    if (!list.value || typeof IntersectionObserver === 'undefined') return;
    // the step crossing the middle band of the viewport is the active one
    observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) active.value = Number((entry.target as HTMLElement).dataset.step);
            }
        },
        { rootMargin: '-45% 0px -45% 0px' },
    );
    list.value.querySelectorAll('[data-step]').forEach((el) => observer!.observe(el));
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
    <div class="story">
        <ol ref="list" class="story-steps">
            <li v-for="(step, i) in steps" :key="step.title" class="story-step" :class="{ 'is-active': active === i }" :data-step="i">
                <span class="story-index" aria-hidden="true">{{ i + 1 }}</span>
                <div class="story-copy">
                    <h3>{{ step.title }}</h3>
                    <p>{{ step.text }}</p>
                    <a class="ob-link" :href="href(step.more.link)" :target="isExternal(step.more.link) ? '_blank' : undefined">{{ step.more.text }}</a>
                </div>
                <img class="story-inline" :src="withBase(step.image)" :alt="step.alt" width="1440" height="900" loading="lazy" decoding="async" />
            </li>
        </ol>
        <div class="story-frame" aria-hidden="true">
            <div class="story-window">
                <img
                    v-for="(step, i) in steps"
                    :key="step.image"
                    :src="withBase(step.image)"
                    alt=""
                    width="1440"
                    height="900"
                    :loading="i === 0 ? 'eager' : 'lazy'"
                    decoding="async"
                    :class="{ 'is-active': active === i }"
                />
            </div>
        </div>
    </div>
</template>
