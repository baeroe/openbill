<?php

namespace App\Enums;

/** Where a template error happened: a template part, its manifest, or the document's intro/closing text. */
enum RenderPart: string
{
    case Header = 'header';
    case Body = 'body';
    case Footer = 'footer';
    case Css = 'css';
    case Manifest = 'manifest';
    case Intro = 'intro';
    case Closing = 'closing';

    /** File of a template package (toolkit error overlay); intro and closing come from the document. */
    public function file(): ?string
    {
        return match ($this) {
            self::Header => 'header.liquid',
            self::Body => 'template.liquid',
            self::Footer => 'footer.liquid',
            self::Css => 'styles.css',
            self::Manifest => 'manifest.json',
            self::Intro, self::Closing => null,
        };
    }
}
