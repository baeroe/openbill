<?php

use App\Domain\Lifecycle\StatusMachine;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;

it('allows the transitions of the concept per document type', function (DocumentType $type, DocumentStatus $from, array $to) {
    expect(StatusMachine::nextStatuses($type, $from))->toBe($to);
})->with([
    [DocumentType::Offer, DocumentStatus::Draft, [DocumentStatus::Open]],
    [DocumentType::Offer, DocumentStatus::Open, [DocumentStatus::Accepted, DocumentStatus::Rejected]],
    [DocumentType::Offer, DocumentStatus::Accepted, []],
    [DocumentType::Confirmation, DocumentStatus::Open, [DocumentStatus::Done]],
    [DocumentType::Invoice, DocumentStatus::Open, [DocumentStatus::Paid]],
    [DocumentType::Invoice, DocumentStatus::Paid, []],
    [DocumentType::Cancellation, DocumentStatus::Draft, [DocumentStatus::Closed]],
]);

it('never sets a status manually out of draft (that is finalizing)', function () {
    expect(StatusMachine::canTransition(DocumentType::Invoice, DocumentStatus::Draft, DocumentStatus::Open))->toBeTrue()
        ->and(StatusMachine::canSetManually(DocumentType::Invoice, DocumentStatus::Draft, DocumentStatus::Open))->toBeFalse()
        ->and(StatusMachine::canSetManually(DocumentType::Invoice, DocumentStatus::Open, DocumentStatus::Paid))->toBeTrue()
        ->and(StatusMachine::canSetManually(DocumentType::Invoice, DocumentStatus::Open, DocumentStatus::Cancelled))->toBeFalse();
});

it('knows the status after finalizing and what is locked', function () {
    expect(StatusMachine::finalizedStatus(DocumentType::Offer))->toBe(DocumentStatus::Open)
        ->and(StatusMachine::finalizedStatus(DocumentType::Cancellation))->toBe(DocumentStatus::Closed)
        ->and(StatusMachine::isLocked(DocumentStatus::Draft))->toBeFalse()
        ->and(StatusMachine::isLocked(DocumentStatus::Paid))->toBeTrue();
});

it('derives overdue only for open invoices past their due date', function () {
    expect(StatusMachine::isOverdue(DocumentType::Invoice, DocumentStatus::Open, '2026-10-10', '2026-10-11'))->toBeTrue()
        ->and(StatusMachine::isOverdue(DocumentType::Invoice, DocumentStatus::Open, '2026-10-11', '2026-10-11'))->toBeFalse()
        ->and(StatusMachine::isOverdue(DocumentType::Invoice, DocumentStatus::Paid, '2026-10-01', '2026-10-11'))->toBeFalse()
        ->and(StatusMachine::isOverdue(DocumentType::Invoice, DocumentStatus::Open, null, '2026-10-11'))->toBeFalse()
        ->and(StatusMachine::isOverdue(DocumentType::Offer, DocumentStatus::Open, '2026-10-01', '2026-10-11'))->toBeFalse();
});
