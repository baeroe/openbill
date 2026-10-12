import { Building2, FileStack, KeyRound, Percent, TextQuote, UsersRound, type LucideIcon } from 'lucide-react';

/** Same list as App\Http\Controllers\SettingsController::SECTIONS. */
export const SETTINGS_SECTIONS = ['organization', 'document-types', 'taxes-units', 'text-blocks', 'users', 'api'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const SECTION_ICONS: Record<SettingsSection, LucideIcon> = {
    organization: Building2,
    'document-types': FileStack,
    'taxes-units': Percent,
    'text-blocks': TextQuote,
    users: UsersRound,
    api: KeyRound,
};

/** Translation key of a section title: settings.section.organization, settings.section.document_types, … */
export const sectionKey = (section: SettingsSection): string => `settings.section.${section.replace('-', '_')}`;
