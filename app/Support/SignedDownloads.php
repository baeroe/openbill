<?php

namespace App\Support;

use App\Enums\DocumentFileKind;
use App\Models\Document;
use App\Models\Position;
use App\Models\PositionGroup;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\URL;

/**
 * Time-limited download links for PDF/XML that work without a token (MCP tool get-document-pdf-url
 * in phase 8). Signed relative to the host, so they survive a reverse proxy.
 *
 * Finalized documents hand out the archived file. Drafts are rendered live (watermark, one Gotenberg
 * render per call, throttled). A draft link carries "version", a hash over the draft's own content: every
 * column of the document (texts, dates, custom fields, customer_id, contact_id, template_id, …) and its
 * groups and positions in their order. Any change of these makes the link answer 403. Master data that
 * is read live (customer address, organization, the template itself) is not part of the version. Once the
 * draft is finalized, the link delivers the archived file.
 */
final class SignedDownloads
{
    public const MINUTES = 15;

    /**
     * @return array{url: string, expires_at: string}
     */
    public function link(Document $document, DocumentFileKind $kind, int $minutes = self::MINUTES): array
    {
        $expires = now()->addMinutes($minutes);
        $parameters = ['id' => $document->id, 'kind' => $kind->value];
        if (! $document->isFinalized()) {
            $parameters['version'] = self::version($document);
        }
        $path = URL::temporarySignedRoute('api.downloads', $expires, $parameters, absolute: false);

        return ['url' => url($path), 'expires_at' => $expires->toAtomString()];
    }

    /** A draft link is valid only for the state it was made for; finalized documents never change. */
    public static function isCurrent(Document $document, ?string $version): bool
    {
        return $document->isFinalized() || $version === self::version($document);
    }

    private static function version(Document $document): string
    {
        $draft = Document::query()->with('groups.positions')->findOrFail($document->id);
        $state = [
            'document' => self::columns($draft),
            'groups' => $draft->groups->map(fn (PositionGroup $group): array => [
                ...self::columns($group),
                'positions' => $group->positions->map(fn (Position $position): array => self::columns($position))->all(),
            ])->all(),
        ];

        return hash('sha256', json_encode($state, JSON_THROW_ON_ERROR));
    }

    /**
     * Stored columns without the timestamps (they would not change for changes within one second, and
     * not at all for changes of groups or positions).
     *
     * @return array<string, mixed>
     */
    private static function columns(Model $model): array
    {
        return Arr::except($model->getAttributes(), ['created_at', 'updated_at']);
    }
}
