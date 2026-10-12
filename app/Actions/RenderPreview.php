<?php

namespace App\Actions;

use App\Enums\RenderScenario;
use App\Exceptions\DocumentLockedException;
use App\Models\Document;
use App\Models\Template;
use App\Rendering\ContextBuilder;
use App\Rendering\LiquidRenderer;
use App\Rendering\PreviewResult;
use App\Rendering\RenderOptions;
use App\Rendering\SampleDataFactory;
use App\Rendering\TemplateSource;
use App\Support\Actor;
use App\Support\DocumentInspector;
use App\Support\DraftInput;
use App\Support\DraftOverlay;
use App\Support\TemplateResolver;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Live preview behind POST /api/render (phase 4) for the document editor (6), the template editor (7)
 * and the toolkit (9). Sources: a saved document (draft: live master data, optionally with unsaved
 * changes in "draft"; finalized: its snapshot) or a sample scenario. Template: unsaved parts in
 * "template" over template_id, else the document's template. Template problems are part of the
 * result (errors) – nothing here writes.
 */
final class RenderPreview
{
    public function __construct(
        private readonly ContextBuilder $contexts,
        private readonly LiquidRenderer $renderer,
        private readonly DocumentInspector $inspector,
        private readonly SampleDataFactory $samples,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException|DocumentLockedException
     */
    public function handle(Actor $actor, array $input): PreviewResult
    {
        $text = ['sometimes', 'nullable', 'string', 'max:1048576'];
        $data = Validator::make($input, [
            'template_id' => ['sometimes', 'nullable', 'string', Rule::exists('templates', 'id')],
            'template' => ['sometimes', 'array'],
            'template.header' => $text,
            'template.body' => $text,
            'template.footer' => $text,
            'template.css' => $text,
            'template.manifest' => ['sometimes', 'array'],
            'document_id' => ['required_without:scenario', 'prohibits:scenario', 'string', Rule::exists('documents', 'id')],
            'draft' => ['sometimes', 'array', 'prohibits:scenario'],
            'scenario' => ['required_without:document_id', Rule::enum(RenderScenario::class)],
            'locale' => ['sometimes', Rule::in(['en', 'de'])],
        ])->validate();

        $issues = [];
        if (isset($data['scenario'])) {
            $sample = $this->samples->make(RenderScenario::from($data['scenario']), $data['locale'] ?? app()->getLocale());
            [$document, $sources] = [$sample->document, $sample->sources];
            $fallback = TemplateResolver::fallback();
            $base = $fallback === null ? new TemplateSource('', '', '', '') : TemplateSource::fromModel($fallback);
        } else {
            $document = Document::query()->with('groups.positions')->findOrFail($data['document_id']);
            if (isset($data['draft'])) {
                if ($document->isFinalized()) {
                    throw DocumentLockedException::for($document);
                }
                $document = DraftOverlay::apply($document, self::draftInput($document, $data['draft']));
            }
            $sources = $this->inspector->sources($document);
            $issues = $document->isFinalized() ? [] : $this->inspector->issues($document, $sources);
            $base = TemplateSource::fromSnapshot(is_array($sources['template'] ?? null) ? $sources['template'] : []);
        }

        if (isset($data['template_id'])) {
            $base = TemplateSource::fromModel(Template::query()->with('assets')->findOrFail($data['template_id']));
        }
        $template = isset($data['template']) ? $base->with($data['template']) : $base;

        $context = $this->contexts->build($document, $sources);
        $result = $this->renderer->render($template, $context->data, new RenderOptions($document->locale));

        return new PreviewResult($result, $context->totals, $issues, $template->manifest);
    }

    /**
     * @param  array<string, mixed>  $draft
     * @return array<string, mixed>
     *
     * @throws ValidationException paths prefixed with "draft."
     */
    private static function draftInput(Document $document, array $draft): array
    {
        try {
            return DraftInput::validate($document, $draft);
        } catch (ValidationException $e) {
            $messages = [];
            foreach ($e->errors() as $path => $list) {
                $messages["draft.{$path}"] = $list;
            }
            throw ValidationException::withMessages($messages);
        }
    }
}
