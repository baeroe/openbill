<?php

namespace Tests;

use Illuminate\Support\Facades\Storage;
use Tests\Support\GotenbergFake;

/** Feature suite: no real files, no real Gotenberg. */
abstract class FeatureTestCase extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('archive');
        Storage::fake('local');
        GotenbergFake::install();
    }
}
