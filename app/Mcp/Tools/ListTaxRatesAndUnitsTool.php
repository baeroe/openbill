<?php

namespace App\Mcp\Tools;

use App\ApiResource\TaxRateResource;
use App\ApiResource\UnitResource;
use App\Mcp\Output;
use App\Models\TaxRate;
use App\Models\Unit;
use App\Support\Actor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-tax-rates-and-units')]
#[Title('Tax rates and units')]
#[Description('Tax rates (percent as string, category) and units (code, symbol, decimals) – their ids go into tax_rate_id and unit_id of positions. Archived ones only with include_archived; use active ones for new positions.')]
#[IsReadOnly]
#[IsOpenWorld(false)]
final class ListTaxRatesAndUnitsTool extends OpenbillTool
{
    protected function run(Request $request, Actor $actor): Response
    {
        $data = $request->validate(['include_archived' => ['sometimes', 'boolean']]);
        $archived = (bool) ($data['include_archived'] ?? false);

        return Output::json([
            // same order as GET /api/tax-rates and GET /api/units
            'tax_rates' => TaxRate::query()->when(! $archived, fn ($query) => $query->whereNull('archived_at'))
                ->orderBy('sort')->orderBy('label')->get()
                ->map(fn (TaxRate $rate): array => Output::resource(TaxRateResource::fromModel($rate)))->values()->all(),
            'units' => Unit::query()->when(! $archived, fn ($query) => $query->whereNull('archived_at'))
                ->orderBy('sort')->orderBy('name')->get()
                ->map(fn (Unit $unit): array => Output::resource(UnitResource::fromModel($unit)))->values()->all(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return ['include_archived' => $schema->boolean()->description('Also archived rates and units (default false)')];
    }
}
