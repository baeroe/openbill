<?php

namespace App\Actions;

use App\Exceptions\ActionNotAllowedException;
use App\Models\Customer;
use App\Models\Document;
use App\Support\Actor;
use Illuminate\Support\Facades\DB;

/** Soft-deletes a customer and deletes its drafts; refused when finalized documents exist. */
final class DeleteCustomer
{
    public function __construct(private readonly DeleteDraft $deleteDraft) {}

    /**
     * @throws ActionNotAllowedException
     */
    public function handle(Actor $actor, Customer $customer): void
    {
        if (Document::query()->where('customer_id', $customer->id)->whereNotNull('finalized_at')->exists()) {
            throw ActionNotAllowedException::customerHasFinalizedDocuments();
        }

        DB::transaction(function () use ($actor, $customer): void {
            foreach (Document::query()->where('customer_id', $customer->id)->get() as $draft) {
                $this->deleteDraft->handle($actor, $draft);
            }
            $customer->delete();
        });
    }
}
