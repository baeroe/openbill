<?php

use App\Models\TextBlock;

beforeEach(fn () => $this->withToken(apiToken()));

it('creates, filters, changes and deletes text blocks', function () {
    $id = $this->postJson('/api/text-blocks', ['name' => 'Thanks', 'kind' => 'closing', 'body' => 'Thank you, {{ customer.name }}.'])
        ->assertCreated()
        ->assertJsonPath('kind', 'closing')
        ->json('id');
    TextBlock::factory()->create(['kind' => 'intro']);

    $this->getJson('/api/text-blocks?kind=closing')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $id);
    $this->patchJson("/api/text-blocks/{$id}", ['body' => 'Many thanks.'])->assertOk()->assertJsonPath('name', 'Thanks')->assertJsonPath('body', 'Many thanks.');
    $this->deleteJson("/api/text-blocks/{$id}")->assertNoContent();
    $this->getJson("/api/text-blocks/{$id}")->assertNotFound();
});

it('validates the kind', function () {
    $this->postJson('/api/text-blocks', ['name' => 'X', 'kind' => 'poem'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'kind');
});
