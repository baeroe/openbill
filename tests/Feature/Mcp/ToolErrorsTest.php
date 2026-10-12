<?php

use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ComplianceFailedException;
use App\Mcp\ToolErrors;
use Illuminate\Validation\ValidationException;

it('lists every invalid field with its path', function () {
    $message = ToolErrors::validation(ValidationException::withMessages([
        'groups.0.positions.1.custom.ticket' => 'Unknown field.',
        'date' => 'The date field is required.',
    ]));

    expect($message)->toBe("Invalid input:\n- groups.0.positions.1.custom.ticket: Unknown field.\n- date: The date field is required.");
});

it('names the reason of a refusal', function () {
    $refusal = ActionNotAllowedException::templateBuiltIn();

    expect(ToolErrors::domain($refusal))->toBe($refusal->getMessage().' (reason: '.$refusal->reason().')');
});

it('adds the extra members of a refusal as JSON', function () {
    // the issue list (violations) is what an agent needs to fix the document; Task 6 checks a real one
    $refusal = new ComplianceFailedException([]);

    expect(ToolErrors::domain($refusal))->toBe($refusal->getMessage()." (reason: compliance_failed)\n{\"violations\":[]}");
});
