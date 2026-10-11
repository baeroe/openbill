import useSWR from 'swr';
import { apiPage, type Page } from '@/lib/api';
import { keys } from './keys';
import type { Customer, PositionSuggestion, TaxRate, TextBlock, Unit } from './types';

const STATIC = { revalidateOnFocus: false };

export function useTaxRates() {
    return useSWR<TaxRate[]>(keys.taxRates(), STATIC);
}

export function useUnits() {
    return useSWR<Unit[]>(keys.units(), STATIC);
}

export function useTextBlocks() {
    return useSWR<TextBlock[]>(keys.textBlocks(), STATIC);
}

export function useCustomerChoices() {
    return useSWR<Page<Customer>>(keys.customerChoices(), (url: string) => apiPage<Customer>(url), STATIC);
}

/** Up to six earlier positions whose title contains the (debounced) input. */
export function usePositionSuggestions(q: string) {
    return useSWR<PositionSuggestion[]>(keys.suggestions(q), { revalidateOnFocus: false, keepPreviousData: false });
}
