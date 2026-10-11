<?php

namespace App\Actions;

use App\Exceptions\ActionNotAllowedException;
use App\Models\Document;
use App\Models\Template;
use App\Support\Actor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Deletes an imported template with its assets and bound toolkit tokens (foreign keys). Document types
 * that used it fall back to the default template. Built-in templates and templates of documents stay.
 */
final class DeleteTemplate
{
    /**
     * @throws ActionNotAllowedException
     */
    public function handle(Actor $actor, Template $template): void
    {
        if ($template->built_in) {
            throw ActionNotAllowedException::templateBuiltIn();
        }

        DB::transaction(function () use ($template): void {
            if (Document::query()->where('template_id', $template->id)->exists()) {
                throw ActionNotAllowedException::templateInUse();
            }
            $folder = "templates/{$template->id}";
            $template->delete();
            DB::afterCommit(fn () => Storage::disk('local')->deleteDirectory($folder));
        });
    }
}
