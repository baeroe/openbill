import useSWR, { mutate } from 'swr';
import { api, apiPage, type Page } from '@/lib/api';
import { keys } from './keys';
import { usePagedList, type PagedList } from './paged';
import type { Customer, CustomerInput } from './types';

export function useCustomerList(q: string): PagedList<Customer> {
    return usePagedList<Customer>((page) => keys.customers(q, page));
}

/** First 20 matches for pickers (new document dialog); `enabled = false` fetches nothing (dialog closed). */
export function useCustomerOptions(q: string, enabled = true) {
    return useSWR<Page<Customer>>(enabled ? keys.customerOptions(q) : null, (url: string) => apiPage<Customer>(url));
}

export function useCustomer(id: string | null) {
    return useSWR<Customer>(id ? keys.customer(id) : null);
}

/** POST (new) or PATCH (existing); the answer goes straight into the cache of the detail. */
export async function saveCustomer(input: CustomerInput, id?: string): Promise<Customer> {
    const saved = id
        ? await api<Customer>(keys.customer(id), { method: 'PATCH', body: input })
        : await api<Customer>('/api/customers', { method: 'POST', body: input });
    await mutate(keys.customer(saved.id), saved, { revalidate: false });
    return saved;
}

export async function deleteCustomer(id: string): Promise<void> {
    await api<void>(keys.customer(id), { method: 'DELETE' });
    await mutate(keys.customer(id), undefined, { revalidate: false });
}
