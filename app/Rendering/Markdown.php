<?php

namespace App\Rendering;

use League\CommonMark\Environment\Environment;
use League\CommonMark\Extension\CommonMark\CommonMarkCoreExtension;
use League\CommonMark\Extension\CommonMark\Node\Inline\Image;
use League\CommonMark\MarkdownConverter;
use League\CommonMark\Node\Node;
use League\CommonMark\Renderer\ChildNodeRendererInterface;
use League\CommonMark\Renderer\NodeRendererInterface;

/**
 * Markdown of text documents to HTML for the PDF. Raw HTML is escaped, links with unsafe schemes (javascript:,
 * data:, vbscript:, file:) lose their target, images become their alt text: the PDF loads nothing from outside
 * (the CSP would block it, and a broken image is a defect, not a feature).
 */
final class Markdown
{
    public static function toHtml(string $markdown): string
    {
        $environment = new Environment(['html_input' => 'escape', 'allow_unsafe_links' => false]);
        $environment->addExtension(new CommonMarkCoreExtension);
        $environment->addRenderer(Image::class, new class implements NodeRendererInterface
        {
            public function render(Node $node, ChildNodeRendererInterface $childRenderer): string
            {
                return $childRenderer->renderNodes($node->children());
            }
        }, 10);

        return trim((new MarkdownConverter($environment))->convert($markdown)->getContent());
    }
}
