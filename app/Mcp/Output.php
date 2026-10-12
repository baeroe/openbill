<?php

namespace App\Mcp;

use Closure;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Laravel\Mcp\Response;
use ReflectionProperty;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Tool answers in the format of the REST API (Accept: application/json): the DTOs of app/ApiResource with
 * snake_case keys, null values kept and empty maps as {} (ArrayObject encodes as an object).
 */
final class Output
{
    public static function json(mixed $data): Response
    {
        return Response::json($data);
    }

    /**
     * Public properties of an API DTO; with $group only those in that serializer group (the list form).
     *
     * @return array<string, mixed>
     */
    public static function resource(object $resource, ?string $group = null): array
    {
        $values = get_object_vars($resource);
        if ($group === null) {
            return $values;
        }

        return array_filter($values, function (string $property) use ($resource, $group): bool {
            foreach ((new ReflectionProperty($resource, $property))->getAttributes(Groups::class) as $attribute) {
                $arguments = $attribute->getArguments();
                if (in_array($group, (array) ($arguments[0] ?? $arguments['groups'] ?? []), true)) {
                    return true;
                }
            }

            return false;
        }, ARRAY_FILTER_USE_KEY);
    }

    /**
     * One page of a list.
     *
     * @template TItem
     *
     * @param  LengthAwarePaginator<int, TItem>  $page
     * @param  Closure(TItem): array<string, mixed>  $map
     * @return array{items: list<array<string, mixed>>, page: int, per_page: int, total: int, has_more: bool}
     */
    public static function page(LengthAwarePaginator $page, Closure $map): array
    {
        return [
            'items' => array_values(array_map($map, $page->items())),
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'has_more' => $page->hasMorePages(),
        ];
    }
}
