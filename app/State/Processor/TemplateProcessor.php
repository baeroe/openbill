<?php

namespace App\State\Processor;

use ApiPlatform\Metadata\DeleteOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\Actions\DeleteTemplate;
use App\Actions\DuplicateTemplate;
use App\Actions\ImportTemplatePackage;
use App\Actions\UpdateTemplateFiles;
use App\ApiResource\TemplateResource;
use App\Models\Template;
use App\State\ApiContext;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;

/**
 * POST = ImportTemplatePackage (multipart "package"), POST …/duplicate = DuplicateTemplate,
 * PUT …/files = UpdateTemplateFiles, DELETE = DeleteTemplate.
 *
 * @implements ProcessorInterface<mixed, TemplateResource|null>
 */
final class TemplateProcessor implements ProcessorInterface
{
    public function __construct(
        private readonly ImportTemplatePackage $import,
        private readonly UpdateTemplateFiles $files,
        private readonly DeleteTemplate $delete,
        private readonly DuplicateTemplate $duplicate,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): ?TemplateResource
    {
        $actor = ApiContext::actor($context);

        if ($operation->getName() === 'template_duplicate') {
            $source = Template::query()->with('assets')->findOrFail((string) $uriVariables['id']);

            return TemplateResource::fromModel($this->duplicate->handle($actor, $source));
        }

        if ($operation instanceof Post) {
            /** @var UploadedFile $package */
            $package = Validator::make(ApiContext::request($context)->allFiles(), ['package' => ['required', 'file']])->validate()['package'];

            return TemplateResource::fromModel($this->import->handle($actor, (string) $package->getRealPath()));
        }

        $template = Template::query()->with('assets')->findOrFail((string) $uriVariables['id']);
        if ($operation instanceof DeleteOperationInterface) {
            $this->delete->handle($actor, $template);

            return null;
        }

        return TemplateResource::fromModel($this->files->handle($actor, $template, ApiContext::body($context)));
    }
}
