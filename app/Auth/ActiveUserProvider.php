<?php

namespace App\Auth;

use Illuminate\Auth\EloquentUserProvider;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Eloquent user provider that never returns disabled accounts: sessions and remember cookies of a disabled user
 * resolve to a guest, and logging in fails (LoginRequest explains why when the password was right).
 */
final class ActiveUserProvider extends EloquentUserProvider
{
    /**
     * @param  Model|null  $model
     * @return Builder<Model>
     */
    protected function newModelQuery($model = null): Builder
    {
        return parent::newModelQuery($model)->whereNull('disabled_at');
    }
}
