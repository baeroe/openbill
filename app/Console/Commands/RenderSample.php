<?php

namespace App\Console\Commands;

use App\Actions\RenderPreview;
use App\Models\Template;
use App\Rendering\GotenbergClient;
use App\Support\Actor;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/** For template authors and reviews: a template with sample data as PDF, without creating documents. */
class RenderSample extends Command
{
    protected $signature = 'app:render-sample
        {template=klar : template slug}
        {scenario=short_invoice : short_invoice, long_invoice, small_business, reverse_charge or offer_with_options}
        {--locale=de : en or de}
        {--out= : PDF path (default storage/app/private/samples/<template>-<scenario>-<locale>.pdf)}';

    protected $description = 'Render a template with sample data to a PDF (via Gotenberg)';

    public function handle(RenderPreview $preview, GotenbergClient $gotenberg): int
    {
        $slug = (string) $this->argument('template');
        $scenario = (string) $this->argument('scenario');
        $locale = (string) $this->option('locale');
        $template = Template::query()->where('slug', $slug)->first();
        if ($template === null) {
            $this->error("No template with the slug {$slug}.");

            return self::FAILURE;
        }

        $result = $preview->handle(Actor::system(), ['template_id' => $template->id, 'scenario' => $scenario, 'locale' => $locale]);
        foreach ($result->render->errors as $error) {
            $this->warn("{$error->part->value}".($error->line === null ? '' : ":{$error->line}").": {$error->message}");
        }

        $out = (string) ($this->option('out') ?: storage_path("app/private/samples/{$slug}-{$scenario}-{$locale}.pdf"));
        File::ensureDirectoryExists(dirname($out));
        File::put($out, $gotenberg->pdf($result->render));
        $this->info("PDF written to {$out}");

        return self::SUCCESS;
    }
}
