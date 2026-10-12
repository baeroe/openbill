<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

export interface Line {
    kind: 'you' | 'call' | 'result' | 'agent';
    text: string;
}

const props = defineProps<{ lines: Line[]; label: string }>();

const prompts: Record<Line['kind'], string> = { you: '>', call: '→', result: '←', agent: '◆' };

// characters shown per line; the server renders everything (no motion, no script)
const typed = ref<number[]>(props.lines.map((l) => l.text.length));
const root = ref<HTMLElement>();
let observer: IntersectionObserver | undefined;
let timer = 0;

function run() {
    typed.value = props.lines.map(() => 0);
    let line = 0;
    const step = () => {
        if (line >= props.lines.length) return;
        const current = props.lines[line];
        // what you and the agent write is typed, tool output arrives at once
        const chunk = current.kind === 'result' ? current.text.length : current.kind === 'call' ? 4 : 3;
        const next = Math.min(current.text.length, typed.value[line] + chunk);
        typed.value[line] = next;
        if (next < current.text.length) {
            timer = window.setTimeout(step, 22);
        } else {
            line++;
            timer = window.setTimeout(step, current.kind === 'call' ? 420 : 650);
        }
    };
    timer = window.setTimeout(step, 300);
}

onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined' || !root.value) return;
    const rect = root.value.getBoundingClientRect();
    // already on screen (deep link, short viewport): leave it complete instead of wiping visible text
    if (rect.top < window.innerHeight && rect.bottom > 0) return;
    typed.value = props.lines.map(() => 0);
    observer = new IntersectionObserver(
        (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                observer?.disconnect();
                run();
            }
        },
        { threshold: 0.45 },
    );
    observer.observe(root.value);
});
onBeforeUnmount(() => {
    observer?.disconnect();
    window.clearTimeout(timer);
});
</script>

<template>
    <figure ref="root" class="term">
        <div class="term-bar" aria-hidden="true">
            <span /><span /><span />
            <em>MCP</em>
        </div>
        <figcaption class="ob-sr-only">{{ label }}</figcaption>
        <!-- the full dialogue for screen readers; the typed copy is decoration -->
        <ol class="ob-sr-only">
            <li v-for="line in lines" :key="line.text">{{ line.text }}</li>
        </ol>
        <pre class="term-body" aria-hidden="true"><code><span
            v-for="(line, i) in lines"
            :key="line.text"
            class="term-line"
            :class="[`is-${line.kind}`, { 'is-typing': typed[i] > 0 && typed[i] < line.text.length, 'is-waiting': typed[i] === 0 }]"
        ><span class="term-prompt">{{ prompts[line.kind] }}</span><span class="term-text"><span>{{ line.text.slice(0, typed[i]) }}</span><span class="term-ghost">{{ line.text.slice(typed[i]) }}</span></span></span></code></pre>
    </figure>
</template>
