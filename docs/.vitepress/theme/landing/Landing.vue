<script setup lang="ts">
import { useData } from 'vitepress';
import { computed, onBeforeUnmount, ref } from 'vue';
import AgentTerminal, { type Line } from './AgentTerminal.vue';
import HeroInvoice, { type InvoiceCopy } from './HeroInvoice.vue';
import { href, isExternal } from './links';
import ScrollStory, { type Step } from './ScrollStory.vue';
import './landing.css';

interface Action {
    text: string;
    link: string;
}
interface Copy {
    hero: { title: string; tagline: string; primary: Action; secondary: Action; replay: string };
    invoice: InvoiceCopy;
    story: { title: string; intro: string; steps: Step[] };
    agents: { title: string; text: string; links: Action[]; terminalLabel: string; lines: Line[] };
    hosting: {
        title: string;
        text: string;
        code: string;
        copy: string;
        copied: string;
        facts: { title: string; text: string }[];
        more: Action;
    };
    features: { title: string; items: { title: string; text: string; link: string }[] };
    closing: { title: string; primary: Action; secondary: Action };
}

// all copy comes from the frontmatter of docs/{en,de}/index.md
const { frontmatter } = useData();
const c = computed(() => frontmatter.value.landing as Copy);

const target = (link: string) => (isExternal(link) ? '_blank' : undefined);
const rel = (link: string) => (isExternal(link) ? 'noopener' : undefined);

const copied = ref(false);
let copiedTimer = 0;
async function copyCode() {
    try {
        await navigator.clipboard.writeText(c.value.hosting.code.trimEnd() + '\n');
        copied.value = true;
        window.clearTimeout(copiedTimer);
        copiedTimer = window.setTimeout(() => (copied.value = false), 2000);
    } catch {
        // clipboard blocked (insecure context): the text stays selectable
    }
}
onBeforeUnmount(() => window.clearTimeout(copiedTimer));
</script>

<template>
    <div class="ob-landing">
        <section class="ob-hero ob-wrap">
            <div class="ob-hero-copy">
                <h1>{{ c.hero.title }}</h1>
                <p class="ob-lead">{{ c.hero.tagline }}</p>
                <div class="ob-actions">
                    <a class="ob-button is-primary" :href="href(c.hero.primary.link)">{{ c.hero.primary.text }}</a>
                    <a class="ob-button" :href="href(c.hero.secondary.link)" :target="target(c.hero.secondary.link)" :rel="rel(c.hero.secondary.link)">
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="is-filled">
                            <path
                                d="M12 2C6.48 2 2 6.58 2 12.22c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.21-3.37-1.21-.46-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.56 2.35 1.11 2.92.85.09-.66.35-1.11.64-1.37-2.22-.26-4.56-1.13-4.56-5.02 0-1.11.39-2.02 1.03-2.73-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.04a9.4 9.4 0 0 1 5 0c1.91-1.32 2.75-1.04 2.75-1.04.55 1.4.2 2.44.1 2.7.64.71 1.03 1.62 1.03 2.73 0 3.9-2.34 4.76-4.57 5.01.36.32.68.94.68 1.9v2.81c0 .27.18.6.69.49A10.1 10.1 0 0 0 22 12.22C22 6.58 17.52 2 12 2Z"
                            />
                        </svg>
                        {{ c.hero.secondary.text }}
                    </a>
                </div>
            </div>
            <HeroInvoice class="ob-hero-doc" :invoice="c.invoice" :replay="c.hero.replay" />
        </section>

        <section class="ob-section ob-wrap" aria-labelledby="ob-story">
            <header class="ob-section-head">
                <h2 id="ob-story">{{ c.story.title }}</h2>
                <p>{{ c.story.intro }}</p>
            </header>
            <ScrollStory :steps="c.story.steps" />
        </section>

        <section class="ob-band" aria-labelledby="ob-agents">
            <div class="ob-wrap ob-agents">
                <div class="ob-agents-copy">
                    <h2 id="ob-agents">{{ c.agents.title }}</h2>
                    <p>{{ c.agents.text }}</p>
                    <p class="ob-links">
                        <a v-for="l in c.agents.links" :key="l.link" class="ob-link" :href="href(l.link)">{{ l.text }}</a>
                    </p>
                </div>
                <AgentTerminal :lines="c.agents.lines" :label="c.agents.terminalLabel" />
            </div>
        </section>

        <section class="ob-section ob-wrap ob-hosting" aria-labelledby="ob-hosting">
            <div class="ob-hosting-copy">
                <h2 id="ob-hosting">{{ c.hosting.title }}</h2>
                <p>{{ c.hosting.text }}</p>
                <div class="ob-code">
                    <pre><code>{{ c.hosting.code.trimEnd() }}</code></pre>
                    <button type="button" class="ob-copy" @click="copyCode">
                        <svg v-if="!copied" viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="9" y="9" width="12" height="12" rx="2.5" />
                            <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
                        </svg>
                        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                        <span>{{ copied ? c.hosting.copied : c.hosting.copy }}</span>
                    </button>
                    <span class="ob-sr-only" aria-live="polite">{{ copied ? c.hosting.copied : '' }}</span>
                </div>
            </div>
            <div class="ob-facts">
                <dl>
                    <div v-for="f in c.hosting.facts" :key="f.title">
                        <dt>{{ f.title }}</dt>
                        <dd>{{ f.text }}</dd>
                    </div>
                </dl>
                <a class="ob-link" :href="href(c.hosting.more.link)">{{ c.hosting.more.text }}</a>
            </div>
        </section>

        <section class="ob-section ob-wrap" aria-labelledby="ob-features">
            <header class="ob-section-head">
                <h2 id="ob-features">{{ c.features.title }}</h2>
            </header>
            <ul class="ob-features">
                <li v-for="f in c.features.items" :key="f.title">
                    <a :href="href(f.link)">
                        <strong>{{ f.title }}</strong>
                        <span>{{ f.text }}</span>
                    </a>
                </li>
            </ul>
        </section>

        <section class="ob-closing ob-wrap">
            <h2>{{ c.closing.title }}</h2>
            <div class="ob-actions">
                <a class="ob-button is-primary" :href="href(c.closing.primary.link)">{{ c.closing.primary.text }}</a>
                <a class="ob-button" :href="href(c.closing.secondary.link)" :target="target(c.closing.secondary.link)" :rel="rel(c.closing.secondary.link)">{{
                    c.closing.secondary.text
                }}</a>
            </div>
        </section>
    </div>
</template>
