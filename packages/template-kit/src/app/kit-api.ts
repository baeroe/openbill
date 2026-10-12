import { KIT_API, type KitState, type RenderEvent, type Source } from '../shared/protocol';

async function json<T>(response: Response): Promise<T> {
    if (!response.ok) throw new Error(`The dev server answered ${response.status}.`);
    return (await response.json()) as T;
}

export async function fetchState(): Promise<KitState> {
    return json(await fetch(`${KIT_API}/state`, { headers: { Accept: 'application/json' } }));
}

export async function chooseSource(source: Source): Promise<RenderEvent> {
    return json(await fetch(`${KIT_API}/source`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(source) }));
}
