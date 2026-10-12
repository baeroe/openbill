<?php

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

beforeEach(fn () => $this->withToken(apiToken()));

it('stores an image and serves it sandboxed', function () {
    $response = $this->post('/api/uploads', ['file' => UploadedFile::fake()->createWithContent('stamp.png', base64_decode(TINY_PNG))], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('mime', 'image/png')
        ->assertJsonPath('size', strlen(base64_decode(TINY_PNG)));
    $path = $response->json('path');

    expect($path)->toMatch('#^uploads/[0-9a-z]{26}\.png$#')
        ->and(Storage::disk('local')->get($path))->toBe(base64_decode(TINY_PNG));

    $file = $this->get('/api/'.$path)->assertOk();
    expect($file->headers->get('Content-Type'))->toBe('image/png')
        ->and($file->headers->get('Content-Security-Policy'))->toContain('sandbox')
        ->and($file->headers->get('X-Content-Type-Options'))->toBe('nosniff');
});

it('refuses files that are no images or too large (review focus)', function (string $name, string $contents) {
    $this->post('/api/uploads', ['file' => UploadedFile::fake()->createWithContent($name, $contents)], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'file');
})->with([
    'program renamed to png' => ['stamp.png', "MZ\x90\x00binary"],
    'pdf' => ['stamp.pdf', '%PDF-1.7'],
    'too large' => ['big.png', base64_decode(TINY_PNG).str_repeat('0', 1024 * 1024)],
]);

it('answers 422 without a file and 404 for unknown or odd names', function () {
    $this->post('/api/uploads', [], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonPath('violations.0.path', 'file');
    $this->get('/api/uploads/01k9x2m3n4p5q6r7s8t9v0w1y2.png')->assertNotFound();
    $this->get('/api/uploads/..%2F.env')->assertNotFound();
});
