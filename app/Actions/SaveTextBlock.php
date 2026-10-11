<?php

namespace App\Actions;

use App\Enums\TextBlockKind;
use App\Models\TextBlock;
use App\Support\Actor;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Text blocks may contain Liquid placeholders; they are rendered with the document in phase 3. */
final class SaveTextBlock
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input, ?TextBlock $block = null): TextBlock
    {
        $required = $block === null ? 'required' : 'sometimes';
        $data = Validator::make($input, [
            'name' => [$required, 'string', 'max:255'],
            'kind' => [$required, Rule::enum(TextBlockKind::class)],
            'body' => ['sometimes', 'nullable', 'string', 'max:20000'],
        ])->validate();

        $block ??= new TextBlock(['body' => '']);
        $block->fill([...$data, ...(array_key_exists('body', $data) ? ['body' => (string) ($data['body'] ?? '')] : [])]);
        $block->save();

        return $block;
    }
}
