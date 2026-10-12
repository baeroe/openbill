<?php

use App\Actions\RenderPreview;
use App\Actions\StoreUpload;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Models\FieldDefinition;
use Illuminate\Http\UploadedFile;

it('puts uploaded images of image fields into the template as data URL and nothing else (review focus)', function () {
    FieldDefinition::factory()->create(['key' => 'stamp', 'label' => 'Stamp', 'type' => FieldType::Image]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Position, 'key' => 'photo', 'label' => 'Photo', 'type' => FieldType::Image]);
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    $path = app(StoreUpload::class)->handle(systemActor(), UploadedFile::fake()->createWithContent('stamp.png', $png))['path'];
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', extra: ['custom' => ['photo' => $path]])], ['custom' => ['stamp' => $path]]);

    $body = app(RenderPreview::class)->handle(systemActor(), [
        'document_id' => $document->id,
        'template' => ['body' => '<img id="a" src="{{ document.stamp }}">{% for p in positions %}<img id="b" src="{{ p.photo }}">{% endfor %}'],
    ])->render->body;

    expect($body)->toContain('id="a" src="data:image/png;base64,'.base64_encode($png).'"')
        ->and($body)->toContain('id="b" src="data:image/png;base64,');

    // a value that did not come through the upload (old data, written past the validation) renders empty
    $document->forceFill(['custom' => ['stamp' => 'https://example.com/stamp.png']])->saveQuietly();
    $body = app(RenderPreview::class)->handle(systemActor(), ['document_id' => $document->id, 'template' => ['body' => '<img id="a" src="{{ document.stamp }}">']])->render->body;
    expect($body)->toContain('id="a" src=""');
});
