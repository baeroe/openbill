import type { Template, TemplateManifest } from '@/domain/types'
import kanteManifest from './kante/manifest.json'
import kanteCss from './kante/styles.css?raw'
import kanteLiquid from './kante/template.liquid?raw'
import klarManifest from './klar/manifest.json'
import klarCss from './klar/styles.css?raw'
import klarLiquid from './klar/template.liquid?raw'
import leiseManifest from './leise/manifest.json'
import leiseCss from './leise/styles.css?raw'
import leiseLiquid from './leise/template.liquid?raw'

export const builtInTemplates: Template[] = [
  { id: 'tpl-klar', builtIn: true, manifest: klarManifest as TemplateManifest, liquid: klarLiquid, css: klarCss },
  { id: 'tpl-kante', builtIn: true, manifest: kanteManifest as TemplateManifest, liquid: kanteLiquid, css: kanteCss },
  { id: 'tpl-leise', builtIn: true, manifest: leiseManifest as TemplateManifest, liquid: leiseLiquid, css: leiseCss },
]
