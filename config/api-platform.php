<?php

use ApiPlatform\Metadata\Operation\DashPathSegmentNameGenerator;
use ApiPlatform\Metadata\UrlGeneratorInterface;

return [
    'title' => 'openbill API',
    'description' => 'REST API of openbill: customers, documents, custom fields, templates and rendering. Guide: docs page "REST API".',
    'version' => '1.0.0',
    'show_webby' => false,

    'routes' => [
        'domain' => null,
        // Sanctum's stateful session check for the own UI, rate limit and response language (bootstrap/app.php)
        'middleware' => ['api'],
    ],

    // DTO resources only: Eloquent models are never exposed, every write goes through app/Actions
    'resources' => [
        app_path('ApiResource'),
    ],

    'formats' => [
        'jsonld' => ['application/ld+json'],
        'json' => ['application/json'],
    ],

    'patch_formats' => [
        'json' => ['application/merge-patch+json', 'application/json'],
    ],

    'partial_patch_validation' => false,

    'enable_head_request_optimization' => true,

    'docs_formats' => [
        'jsonld' => ['application/ld+json'],
        'jsonopenapi' => ['application/vnd.openapi+json'],
        'html' => ['text/html'],
    ],

    'error_formats' => [
        'jsonproblem' => ['application/problem+json'],
    ],

    'defaults' => [
        'pagination_enabled' => true,
        'pagination_partial' => false,
        'pagination_client_enabled' => false,
        'pagination_client_items_per_page' => true,
        'pagination_client_partial' => false,
        'pagination_items_per_page' => 30,
        'pagination_maximum_items_per_page' => 100,
        'route_prefix' => '/api',
        'middleware' => [],
        // null stays in the answer ("number": null): clients get every field of the documented shape
        'normalization_context' => ['skip_null_values' => false],
    ],

    'pagination' => [
        'page_parameter_name' => 'page',
        'enabled_parameter_name' => 'pagination',
        'items_per_page_parameter_name' => 'itemsPerPage',
        'partial_parameter_name' => 'partial',
    ],

    'jsonapi' => [
        'use_iri_as_id' => false,
        'allow_client_generated_id' => false,
    ],

    'graphql' => [
        'enabled' => false,
        'nesting_separator' => '__',
        'introspection' => ['enabled' => false],
        'max_query_complexity' => 500,
        'max_query_depth' => 200,
    ],

    'graphiql' => [
        'enabled' => false,
    ],

    // JSON keys stay snake_case, exactly like the action input and the error paths
    'name_converter' => null,

    'exception_to_status' => [],

    'redoc' => [
        'enabled' => false,
    ],

    'scalar' => [
        'enabled' => false,
        'extra_configuration' => [],
    ],

    'swagger_ui' => [
        'enabled' => true,
        'http_auth' => [
            'Sanctum token' => [
                'scheme' => 'bearer',
                'bearerFormat' => 'Sanctum',
            ],
        ],
    ],

    'url_generation_strategy' => UrlGeneratorInterface::ABS_PATH,

    'path_segment_name_generator' => DashPathSegmentNameGenerator::class,

    'serializer' => [
        'hydra_prefix' => false,
    ],

    'cache' => 'file',

    'metadata_dump' => null,

    // /mcp belongs to laravel/mcp (phase 8)
    'mcp' => [
        'enabled' => false,
    ],

    // every /api error is rendered by App\Http\Api\ProblemResponse (bootstrap/app.php): one format for all routes
    'error_handler' => [
        'extend_laravel_handler' => false,
    ],
];
