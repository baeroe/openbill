export type Locale = 'en' | 'de';

export type UserRole = 'owner' | 'member';

export type AuthUser = {
    id: string;
    name: string;
    email: string;
    role: UserRole;
};

/** Props every Inertia page receives (app/Http/Middleware/HandleInertiaRequests.php). */
export type SharedProps = {
    locale: Locale;
    translations: Record<string, string>;
    auth: { user: AuthUser | null };
};
