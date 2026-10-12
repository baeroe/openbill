<?php

use App\Rendering\PdfPageCount;

it('reads the page count from the root of the page tree', function (string $pdf, ?int $pages) {
    expect(PdfPageCount::of($pdf))->toBe($pages);
})->with([
    'one tree' => ["%PDF-1.7\n2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>\nendobj\n", 3],
    'count before type, no spaces' => ["%PDF-1.4\n2 0 obj\n<</Count 2/Kids[3 0 R 4 0 R]/Type/Pages>>\nendobj\n", 2],
    'nested tree' => ["%PDF-1.7\n1 0 obj\n<< /Type /Pages /Kids [2 0 R 3 0 R] /Count 5 >>\nendobj\n2 0 obj\n<< /Type /Pages /Parent 1 0 R /Kids [4 0 R 5 0 R] /Count 2 >>\nendobj\n", 5],
    'single pages only' => ["%PDF-1.7\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n", null],
    'compressed object streams' => ["%PDF-1.7\n5 0 obj\n<< /Type /ObjStm /N 4 /First 20 /Filter /FlateDecode >>\nstream\nxx\nendstream\n", null],
    'no pdf at all' => ['<html>proxy error page</html>', null],
]);
