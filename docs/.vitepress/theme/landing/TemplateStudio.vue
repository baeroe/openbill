<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { InvoiceCopy } from './HeroInvoice.vue';
import { formatCents, lineCents, percentOf } from './money';

type Effect = 'serif' | 'rule' | 'box';
export interface StudioDemo {
    label: string;
    prompt: string;
    file: string;
    edits: { op: '+' | '-'; text: string; effect?: Effect }[];
    status: string;
}

const props = defineProps<{ demo: StudioDemo; invoice: InvoiceCopy }>();

// the preview reuses the hero invoice (same demo data, same exact arithmetic)
const money = (cents: number) => formatCents(cents, props.invoice.locale);
const rows = computed(() => props.invoice.groups.flatMap((g) => g.items.map((i) => ({ name: i.name, cents: lineCents(i.quantity, i.price) }))));
const net = computed(() => rows.value.reduce((sum, r) => sum + r.cents, 0));
const gross = computed(() => net.value + percentOf(net.value, props.invoice.vatRate));

// steps shown: 0 = only the prompt, n = n edits applied, edits.length + 1 = rendered. The server renders the end state.
const total = computed(() => props.demo.edits.length + 1);
const step = ref(total.value);
const typed = ref(props.demo.prompt.length);
const effects = computed(() => {
    const on = new Set<Effect>();
    props.demo.edits.slice(0, Math.min(step.value, props.demo.edits.length)).forEach((e) => e.effect && on.add(e.effect));
    return on;
});

const root = ref<HTMLElement>();
let observer: IntersectionObserver | undefined;
const timers: number[] = [];
const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

function play() {
    step.value = 0;
    typed.value = 0;
    const prompt = props.demo.prompt;
    const perChar = 24;
    for (let i = 1; i <= prompt.length; i += 2) at(200 + i * (perChar / 2), () => (typed.value = Math.min(prompt.length, i + 1)));
    const editsAt = 200 + prompt.length * (perChar / 2) + 600;
    for (let n = 1; n <= total.value; n++) at(editsAt + (n - 1) * 900, () => (step.value = n));
}

onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined' || !root.value) return;
    const rect = root.value.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;
    step.value = 0;
    typed.value = 0;
    observer = new IntersectionObserver(
        (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                observer?.disconnect();
                play();
            }
        },
        { threshold: 0.4 },
    );
    observer.observe(root.value);
});
onBeforeUnmount(() => {
    observer?.disconnect();
    timers.forEach((t) => window.clearTimeout(t));
});
</script>

<template>
    <figure ref="root" class="studio" role="img" :aria-label="demo.label">
        <div class="studio-code" aria-hidden="true">
            <div class="studio-prompt">
                <span class="studio-mark">&gt;</span>
                <span
                    ><span>{{ demo.prompt.slice(0, typed) }}</span><span class="term-ghost">{{ demo.prompt.slice(typed) }}</span></span
                >
            </div>
            <div class="studio-file">{{ demo.file }}</div>
            <ol class="studio-diff">
                <li v-for="(edit, i) in demo.edits" :key="edit.text" :class="[edit.op === '+' ? 'is-add' : 'is-del', { 'is-shown': step > i }]">
                    <span class="studio-op">{{ edit.op }}</span><code>{{ edit.text }}</code>
                </li>
            </ol>
            <div class="studio-status" :class="{ 'is-shown': step >= total }">
                <svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                {{ demo.status }}
            </div>
        </div>
        <div class="studio-preview" aria-hidden="true">
            <div class="studio-page" :class="{ 'fx-serif': effects.has('serif'), 'fx-rule': effects.has('rule'), 'fx-box': effects.has('box') }">
                <div class="studio-sender">{{ invoice.sender }}</div>
                <div class="studio-address">
                    <span>{{ invoice.recipient[0] }}</span>
                    <span>{{ invoice.recipient[2] }}, {{ invoice.recipient[3] }}</span>
                </div>
                <div class="studio-title">{{ invoice.title }} {{ invoice.number }}</div>
                <div v-for="row in rows" :key="row.name" class="studio-row">
                    <span>{{ row.name }}</span>
                    <span>{{ money(row.cents) }}</span>
                </div>
                <div class="studio-total">
                    <span>{{ invoice.total }}</span>
                    <span>{{ money(gross) }}</span>
                </div>
            </div>
        </div>
    </figure>
</template>
