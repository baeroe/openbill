<?php

namespace App\Mcp\Tools;

use App\Mcp\Output;
use App\Support\Actor;
use App\Support\Overview;
use Carbon\CarbonImmutable;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get-overview')]
#[Title('Overview')]
#[Description('Key figures of the overview page – open and overdue invoices, open offers, paid this month and this year (gross amounts as strings, with counts) – plus the documents that need attention and the recently edited ones. Start here.')]
#[IsReadOnly]
#[IsOpenWorld(false)]
final class GetOverviewTool extends OpenbillTool
{
    protected function run(Request $request, Actor $actor): Response
    {
        return Output::json(Overview::build(CarbonImmutable::today()));
    }
}
