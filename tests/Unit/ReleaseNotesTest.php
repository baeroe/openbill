<?php

use Symfony\Component\Process\Process;

function releaseNotes(string $version): Process
{
    $process = new Process([dirname(__DIR__, 2).'/scripts/release-notes.sh', $version]);
    $process->run();

    return $process;
}

it('prints the notes of a version from docs/en/upgrading.md', function () {
    $process = releaseNotes('0.1.0');

    expect($process->getExitCode())->toBe(0, $process->getErrorOutput())
        ->and($process->getOutput())->toStartWith('- First release')
        ->not->toContain('##')
        ->and(trim($process->getOutput()))->toBe(rtrim($process->getOutput(), "\n"));
});

it('uses the notes of the final version for a pre-release tag', function () {
    expect(releaseNotes('0.1.0-rc.1')->getOutput())->toBe(releaseNotes('0.1.0')->getOutput());
});

it('refuses a version without notes, before anything is published', function () {
    $process = releaseNotes('9.9.9');

    expect($process->getExitCode())->toBe(1)
        ->and($process->getErrorOutput())->toContain('docs/en/upgrading.md has no section "### 9.9.9"');
});

it('has only absolute links, which also work in the GitHub release', function () {
    expect(releaseNotes('0.1.0')->getOutput())->not->toContain('](/')
        ->toContain('](https://github.com/baeroe/openbill/blob/main/docs/en/setup.md)');
});

it('has notes for the version in config/openbill.php (MCP serverInfo.version)', function () {
    // Unit suite: no app, so the config file is read as text
    preg_match("/'version' => '([^']+)'/", (string) file_get_contents(dirname(__DIR__, 2).'/config/openbill.php'), $match);
    $version = $match[1] ?? '';

    expect($version)->not->toBe('')
        ->and(releaseNotes($version)->getExitCode())->toBe(0)
        ->and(file_get_contents(dirname(__DIR__, 2).'/docs/de/upgrading.md'))->toContain("### {$version}");
});
