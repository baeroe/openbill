import type { Template, TemplateManifest } from '@/domain/types'
import klarLiquid from './klar/template.liquid?raw'
import klarCss from './klar/styles.css?raw'
import klarManifest from './klar/manifest.json'

export const builtInTemplates: Template[] = [
  { id: 'tpl-klar', builtIn: true, manifest: klarManifest as TemplateManifest, liquid: klarLiquid, css: klarCss },
]
