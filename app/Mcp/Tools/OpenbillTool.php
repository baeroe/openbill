<?php

namespace App\Mcp\Tools;

use App\Exceptions\DomainActionException;
use App\Http\Api\CurrentActor;
use App\Mcp\ToolErrors;
use App\Support\Actor;
use App\Support\Text;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tool;

/**
 * Base of every openbill tool: a thin layer over app/Actions. run() validates at most paging and ids, calls one
 * action (reading tools: the query of the REST provider) and answers like the REST API. Validation errors keep
 * their field paths, refusals of the actions their reason – agents fix their input from these messages.
 */
abstract class OpenbillTool extends Tool
{
    /**
     * @throws AuthenticationException
     */
    final public function handle(Request $request): Response
    {
        try {
            return $this->run($request, CurrentActor::forUser($request->user()));
        } catch (ValidationException $e) {
            return Response::error(ToolErrors::validation($e));
        } catch (DomainActionException $e) {
            return Response::error(ToolErrors::domain($e));
        } catch (ModelNotFoundException) {
            return Response::error(Text::t('mcp.not_found_any'));
        }
    }

    abstract protected function run(Request $request, Actor $actor): Response;

    /**
     * The model whose id is in argument $key, or a readable error.
     *
     * @template TModel of Model
     *
     * @param  class-string<TModel>  $class
     * @param  string  $what  customer, document, template or field (translation mcp.what.<what>)
     * @return TModel
     *
     * @throws ValidationException
     */
    protected static function find(Request $request, string $class, string $what, string $key = 'id'): Model
    {
        $id = (string) $request->validate([$key => ['required', 'string', 'max:64']])[$key];

        return $class::query()->find($id) ?? throw ValidationException::withMessages([
            $key => Text::t('mcp.not_found', ['what' => Text::t("mcp.what.{$what}"), 'id' => $id]),
        ]);
    }

    /**
     * page and per_page from the arguments (default 1 and 30, at most 100 per page).
     *
     * @return array{0: int, 1: int}
     *
     * @throws ValidationException
     */
    protected static function paging(Request $request): array
    {
        $data = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        return [(int) ($data['page'] ?? 1), (int) ($data['per_page'] ?? 30)];
    }
}
