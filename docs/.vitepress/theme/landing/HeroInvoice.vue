<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { formatCents, lineCents, percentOf, toCents } from './money';

interface Item {
    name: string;
    quantity: string;
    unit: string;
    price: string;
}
export interface InvoiceCopy {
    locale: string;
    label: string;
    sender: string;
    senderLine: string;
    recipient: string[];
    title: string;
    subject: string;
    draft: string;
    number: string;
    date: string;
    groups: { title: string; items: Item[] }[];
    subtotal: string;
    net: string;
    vat: string;
    vatRate: number;
    total: string;
    stamp: string;
    badges: string[];
}

const props = defineProps<{ invoice: InvoiceCopy; replay: string }>();

const money = (cents: number) => formatCents(cents, props.invoice.locale);

// positions are numbered across groups like in the built-in templates
const groups = computed(() => {
    let position = 0;
    return props.invoice.groups.map((g) => {
        const items = g.items.map((item) => ({ ...item, position: ++position, cents: lineCents(item.quantity, item.price) }));
        return { title: g.title, items, cents: items.reduce((sum, i) => sum + i.cents, 0) };
    });
});
const net = computed(() => groups.value.reduce((sum, g) => sum + g.cents, 0));
const vat = computed(() => percentOf(net.value, props.invoice.vatRate));
const gross = computed(() => net.value + vat.value);

// the server-rendered page shows the final state; the animation (if any) starts from the draft
const finalized = ref(true);
const progress = ref(1);
const ready = ref(false);
const shown = (cents: number) => money(Math.round(cents * progress.value));

const root = ref<HTMLElement>();
const timers: number[] = [];
let frame = 0;
let animations: Animation[] = [];

const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

function stop() {
    timers.splice(0).forEach((t) => window.clearTimeout(t));
    cancelAnimationFrame(frame);
    animations.forEach((a) => a.cancel());
    animations = [];
}

function at(ms: number, fn: () => void) {
    timers.push(window.setTimeout(fn, ms));
}

function animate(el: Element | null | undefined, keyframes: Keyframe[], delay: number, duration: number, easing = EASE, fill: FillMode = 'backwards') {
    if (!el) return;
    animations.push(el.animate(keyframes, { delay, duration, easing, fill }));
}

function countUp(start: number, duration: number) {
    at(start, () => {
        const begin = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - begin) / duration);
            progress.value = 1 - Math.pow(1 - t, 3);
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
    });
}

function play() {
    const el = root.value;
    if (!el) return;
    stop();
    finalized.value = false;
    progress.value = 0;
    ready.value = true;

    const q = (s: string) => Array.from(el.querySelectorAll(s));
    animate(el.querySelector('.inv-paper'), [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], 0, 520);
    q('.inv-intro').forEach((n, i) => animate(n, [{ opacity: 0 }, { opacity: 1 }], 160 + i * 70, 380));

    const rows = q('.inv-row');
    const rowsStart = 520;
    rows.forEach((n, i) =>
        animate(n, [{ opacity: 0, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'none' }], rowsStart + i * 120, 420),
    );
    const totalsAt = rowsStart + rows.length * 120 + 80;
    animate(el.querySelector('.inv-totals'), [{ opacity: 0 }, { opacity: 1 }], totalsAt, 300);
    countUp(totalsAt + 120, 900);

    const finalAt = totalsAt + 120 + 900 + 280;
    at(finalAt, () => {
        finalized.value = true;
    });
    animate(el.querySelector('.inv-number'), [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], finalAt, 260, EASE, 'none');
    animate(
        el.querySelector('.inv-stamp'),
        [
            { opacity: 0, transform: 'rotate(-16deg) scale(1.7)' },
            { opacity: 1, transform: 'rotate(-7deg) scale(0.96)', offset: 0.75 },
            { opacity: 1, transform: 'rotate(-7deg) scale(1)' },
        ],
        finalAt,
        320,
        'cubic-bezier(0.3, 0, 0.6, 1)',
    );
    // the paper takes the stamp's weight for a moment
    animations.push(
        el
            .querySelector('.inv-paper')!
            .animate([{ transform: 'none' }, { transform: 'translateY(2px) scale(0.997)' }, { transform: 'none' }], {
                delay: finalAt + 230,
                duration: 220,
                easing: 'ease-out',
            }),
    );
    q('.inv-badge').forEach((n, i) =>
        animate(n, [{ opacity: 0, transform: 'translateY(-130%)' }, { opacity: 1, transform: 'none' }], finalAt + 420 + i * 160, 520),
    );
}

let motion: MediaQueryList | undefined;
let observer: IntersectionObserver | undefined;
const onMotionChange = () => {
    if (motion?.matches) {
        stop();
        observer?.disconnect();
        finalized.value = true;
        progress.value = 1;
        ready.value = true;
    }
};

onMounted(() => {
    motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener('change', onMotionChange);
    if (motion.matches || typeof Element.prototype.animate !== 'function') {
        ready.value = true;
        return;
    }
    // on small screens the invoice sits below the fold: play once it is in view
    if (typeof IntersectionObserver === 'undefined') return play();
    observer = new IntersectionObserver(
        (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                observer?.disconnect();
                play();
            }
        },
        { threshold: 0.3 },
    );
    observer.observe(root.value!);
});
onBeforeUnmount(() => {
    observer?.disconnect();
    stop();
    motion?.removeEventListener('change', onMotionChange);
});

const canReplay = ref(false);
onMounted(() => {
    canReplay.value = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
});
</script>

<template>
    <div ref="root" class="inv" :class="{ 'is-ready': ready }">
        <div class="inv-desk">
            <figure class="inv-figure" role="img" :aria-label="invoice.label">
                <div class="inv-paper" aria-hidden="true">
                    <div class="inv-head inv-intro">
                        <strong>{{ invoice.sender }}</strong>
                        <span>{{ invoice.date }}</span>
                    </div>
                    <div class="inv-return inv-intro">{{ invoice.senderLine }}</div>
                    <div class="inv-to inv-intro">
                        <span v-for="line in invoice.recipient" :key="line">{{ line }}</span>
                    </div>
                    <div class="inv-titlerow inv-intro">
                        <span class="inv-title">{{ invoice.title }}</span>
                        <span class="inv-number" :class="{ 'is-draft': !finalized }">{{ finalized ? invoice.number : invoice.draft }}</span>
                    </div>
                    <div class="inv-subject inv-intro">{{ invoice.subject }}</div>

                    <div v-for="group in groups" :key="group.title" class="inv-group">
                        <div class="inv-row inv-grouphead">{{ group.title }}</div>
                        <div v-for="item in group.items" :key="item.position" class="inv-row inv-item">
                            <span class="inv-pos">{{ item.position }}</span>
                            <span class="inv-name">
                                {{ item.name }}
                                <small>{{ item.quantity }} {{ item.unit }} × {{ money(toCents(item.price)) }}</small>
                            </span>
                            <span class="inv-amount">{{ money(item.cents) }}</span>
                        </div>
                        <div class="inv-row inv-sub">
                            <span>{{ invoice.subtotal }} {{ group.title }}</span>
                            <span class="inv-amount">{{ money(group.cents) }}</span>
                        </div>
                    </div>

                    <div class="inv-foot">
                        <div class="inv-stamp" :class="{ 'is-hidden': !finalized }">
                            <strong>{{ invoice.stamp }}</strong>
                            <span>{{ invoice.number }}</span>
                        </div>
                        <dl class="inv-totals">
                            <div>
                                <dt>{{ invoice.net }}</dt>
                                <dd>{{ shown(net) }}</dd>
                            </div>
                            <div>
                                <dt>{{ invoice.vat }}</dt>
                                <dd>{{ shown(vat) }}</dd>
                            </div>
                            <div class="inv-gross">
                                <dt>{{ invoice.total }}</dt>
                                <dd>{{ shown(gross) }}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </figure>
            <div class="inv-badges" aria-hidden="true">
                <span v-for="(badge, i) in invoice.badges" :key="badge" class="inv-badge">
                    <svg v-if="i === 0" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                        <path d="M14 3v5h5M9 13h6M9 17h4" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12" />
                    </svg>
                    {{ badge }}
                </span>
            </div>
        </div>
        <button v-if="canReplay" type="button" class="inv-replay" @click="play">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>
            {{ replay }}
        </button>
    </div>
</template>
