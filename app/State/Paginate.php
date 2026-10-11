<?php

namespace App\State;

use ApiPlatform\Laravel\Eloquent\Paginator;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

/** Pages of an ordered Eloquent query as API Platform paginator (JSON-LD: totalItems, view) with DTO items. */
final class Paginate
{
    public const PER_PAGE = 30;

    public const MAX_PER_PAGE = 100;

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @param  Closure(TModel): object  $map
     */
    public static function query(Builder $query, Request $request, Closure $map): Paginator
    {
        $perPage = min(max((int) $request->query('itemsPerPage', (string) self::PER_PAGE), 1), self::MAX_PER_PAGE);
        $page = max((int) $request->query('page', '1'), 1);

        /** @var LengthAwarePaginator<int, TModel> $models */
        $models = $query->paginate(perPage: $perPage, page: $page);

        return new Paginator($models->through($map));
    }
}
