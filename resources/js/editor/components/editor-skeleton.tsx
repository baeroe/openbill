import { Skeleton } from '@/components/ui';
import { t } from '@/lib/i18n';

export function EditorSkeleton() {
    return (
        <div className="ed ed--with-preview" aria-busy="true" aria-label={t('common.loading')}>
            <div className="ed-main">
                <div className="flex items-center gap-4">
                    <div className="grid gap-2">
                        <Skeleton w={260} h={30} />
                        <Skeleton w={200} h={14} />
                    </div>
                    <span className="flex-1" />
                    <Skeleton w={130} h={38} r={999} />
                </div>
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr))]">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="grid gap-2">
                            <Skeleton w={90} h={12} />
                            <Skeleton h={38} r={12} />
                        </div>
                    ))}
                </div>
                <div className="grid gap-3">
                    {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} h={44} r={12} />
                    ))}
                </div>
            </div>
            <div className="ed-preview">
                <Skeleton h={560} r={4} />
            </div>
        </div>
    );
}
