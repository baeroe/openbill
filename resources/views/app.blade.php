<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <meta name="theme-color" content="#f4f4f2" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#16171a" media="(prefers-color-scheme: dark)">
    <script>
        // theme before the first paint, same key and rule as resources/js/lib/theme.ts (no flash of the wrong theme)
        (function () {
            var pref = 'system';
            try { pref = localStorage.getItem('openbill:theme') || 'system'; } catch (e) {}
            var dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        })();
    </script>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    <title>openbill</title>
    @inertiaHead
</head>
<body>
    @inertia
</body>
</html>
