<?php

namespace App\Actions;

use App\Enums\TokenAbility;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ToolkitUnavailableException;
use App\Models\Template;
use App\Models\User;
use App\Rendering\TemplatePackage;
use App\Rendering\ToolkitPackage;
use App\Support\Actor;
use App\Support\DownloadFile;
use App\Support\Text;
use Illuminate\Support\Facades\DB;

/**
 * Template editor "Download toolkit" (spec 7): a new token for $user that previews documents (templates:render) and
 * reads and writes only this template (templates:write + template_id), and the ZIP with the built kit, the saved
 * template under template/ and .env.local. Built-in templates are read-only: duplicate first. Every download makes
 * a new token; older ones stay until revoked (settings "API & MCP") or until the template is deleted.
 */
final class DownloadTemplateToolkit
{
    public function __construct(private readonly IssueApiToken $tokens) {}

    /**
     * @throws ActionNotAllowedException|ToolkitUnavailableException
     */
    public function handle(Actor $actor, User $user, Template $template, string $instanceUrl): DownloadFile
    {
        if ($template->built_in) {
            throw ActionNotAllowedException::templateBuiltIn();
        }
        // before the token: a missing kit must not leave a token behind
        $kit = ToolkitPackage::readKit((string) config('openbill.toolkit.path'));
        $package = TemplatePackage::fromTemplate($template->loadMissing('assets'));

        return DB::transaction(function () use ($actor, $user, $template, $instanceUrl, $kit, $package): DownloadFile {
            $token = $this->tokens->handle($actor, $user, [
                'name' => self::tokenName($template),
                'abilities' => [TokenAbility::TemplatesRender->value, TokenAbility::TemplatesWrite->value],
                'template_id' => $template->id,
            ]);
            $zip = (new ToolkitPackage($kit, $package, [
                'OPENBILL_URL' => rtrim($instanceUrl, '/'),
                'OPENBILL_TOKEN' => $token->plainTextToken,
                'OPENBILL_TEMPLATE_ID' => $template->id,
            ]))->toZip("openbill-{$template->slug}");

            return new DownloadFile("openbill-toolkit-{$template->slug}.zip", 'application/zip', $zip);
        });
    }

    /** "Toolkit: Fjord Brief (2026-10-12 14:03)" – template names have at most 100 characters, tokens 255. */
    public static function tokenName(Template $template): string
    {
        return Text::t('toolkit.token_name', ['template' => $template->name, 'date' => now()->format('Y-m-d H:i')]);
    }
}
