/** Brand mark: a sheet with a folded corner and a check. */
export function LogoMark() {
    return (
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent text-accent-ink">
            <svg viewBox="0 0 24 24" className="size-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h8l4 4v14H6z" />
                <path d="M9.5 13.5l2 2 3.5-4" />
            </svg>
        </span>
    );
}
