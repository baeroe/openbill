import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient, describeFailure, networkFailure, OpenbillError, renderRequest } from './client';
import { SAMPLE_RESULT, startFakeOpenbill, type FakeOpenbill } from './test-support/fake-openbill';

let fake: FakeOpenbill;
beforeEach(async () => {
    fake = await startFakeOpenbill();
});
afterEach(() => fake.close());

const failureOf = async (promise: Promise<unknown>) => {
    try {
        await promise;
    } catch (error) {
        if (error instanceof OpenbillError) return error.failure;
        throw error;
    }
    throw new Error('expected a failure');
};

describe('createClient', () => {
    it('renders with the bearer token and JSON', async () => {
        const client = createClient({ url: fake.url, token: '1|openbill_test' });

        const result = await client.render(renderRequest('01kfjord', { kind: 'scenario', key: 'long_invoice', locale: 'de' }, { body: '<h1>Fjord</h1>' }));

        expect(result.body).toBe(SAMPLE_RESULT.body);
        expect(fake.requests[0].headers.authorization).toBe('Bearer 1|openbill_test');
        expect(fake.requests[0].headers['content-type']).toBe('application/json');
        expect(JSON.parse(fake.requests[0].body)).toEqual({ template_id: '01kfjord', template: { body: '<h1>Fjord</h1>' }, scenario: 'long_invoice', locale: 'de' });
    });

    it('renders a document by id', () => {
        expect(renderRequest('01kfjord', { kind: 'document', id: '01kdoc' }, {})).toEqual({ template_id: '01kfjord', template: {}, document_id: '01kdoc' });
    });

    it('explains a revoked token', async () => {
        fake.on('POST', '/api/render', () => ({ status: 401, json: { status: 401, title: 'Unauthorized', detail: 'Unauthenticated.', reason: 'unauthenticated' } }));

        const failure = await failureOf(createClient({ url: fake.url, token: '1|gone' }).render(renderRequest('01k', { kind: 'document', id: '01kdoc' }, {})));

        expect(failure.kind).toBe('unauthorized');
        expect(failure.message).toContain('download the toolkit again');
    });

    it('lists the violations of a 422', async () => {
        fake.on('PUT', '/api/templates/01kfjord/files', () => ({
            status: 422,
            json: { status: 422, title: 'Unprocessable', detail: 'The manifest is invalid.', reason: 'validation_failed', violations: [{ path: 'manifest.version', message: 'Use a version like 1.0.0.' }] },
        }));

        const failure = await failureOf(createClient({ url: fake.url, token: '1|x' }).putFiles('01kfjord', { header: '', body: '', footer: '', css: '', manifest: {}, assets: {} }));

        expect(failure).toEqual({ kind: 'validation', status: 422, message: 'The manifest is invalid.', details: ['manifest.version: Use a version like 1.0.0.'] });
    });

    it('reads the package ZIP as bytes', async () => {
        fake.on('GET', '/api/templates/01kfjord/package', () => ({ body: new Uint8Array([80, 75, 3, 4]), contentType: 'application/zip' }));

        expect([...(await createClient({ url: fake.url, token: '1|x' }).packageZip('01kfjord'))]).toEqual([80, 75, 3, 4]);
    });

    it('says when the instance cannot be reached', async () => {
        const url = fake.url;
        await fake.close();

        const failure = await failureOf(createClient({ url, token: '1|x' }).sources());

        expect(failure.kind).toBe('network');
        expect(failure.message).toContain(`Cannot reach ${url}`);
        fake = await startFakeOpenbill(); // afterEach closes it again
    });
});

describe('describeFailure', () => {
    it.each([
        [403, { detail: 'This token is missing the rule template-write.' }, 'forbidden', 'writes only its own template'],
        [404, null, 'not_found', 'OPENBILL_TEMPLATE_ID'],
        [409, { reason: 'template_built_in', detail: 'x' }, 'conflict', 'Duplicate it in openbill'],
        [413, { detail: 'The request is too large.' }, 'too_large', 'The request is too large.'],
        [503, { detail: 'Gotenberg is down.' }, 'server', 'openbill answered 503: Gotenberg is down.'],
    ] as const)('%i → %s', (status, problem, kind, text) => {
        const failure = describeFailure(status, problem, 'https://openbill.example/api/templates/01k/files');

        expect(failure.kind).toBe(kind);
        expect(failure.message).toContain(text);
    });
});

describe('networkFailure', () => {
    it('points to --use-system-ca when Node does not trust the certificate', () => {
        const cause = Object.assign(new TypeError('fetch failed'), { cause: { code: 'SELF_SIGNED_CERT_IN_CHAIN' } });

        expect(networkFailure('https://openbill.ddev.site/api/render', cause).message).toContain('NODE_OPTIONS=--use-system-ca');
    });
});
