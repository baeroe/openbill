<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
 * Feature tests boot Laravel and run against the MariaDB database `testing`.
 * Unit tests are plain PHP (architecture, file consistency) and don't boot the app.
 */
pest()->extend(TestCase::class)->use(RefreshDatabase::class)->in('Feature');
