import type { Template, TemplateManifest } from '@/domain/types'
import kanteFooter from './kante/footer.liquid?raw'
import kanteHeader from './kante/header.liquid?raw'
import kanteManifest from './kante/manifest.json'
import kanteCss from './kante/styles.css?raw'
import kanteLiquid from './kante/template.liquid?raw'
import klarFooter from './klar/footer.liquid?raw'
import klarHeader from './klar/header.liquid?raw'
import klarManifest from './klar/manifest.json'
import klarCss from './klar/styles.css?raw'
import klarLiquid from './klar/template.liquid?raw'
import leiseFooter from './leise/footer.liquid?raw'
import leiseHeader from './leise/header.liquid?raw'
import leiseManifest from './leise/manifest.json'
import leiseCss from './leise/styles.css?raw'
import leiseLiquid from './leise/template.liquid?raw'

const tpl = (id: string, manifest: unknown, header: string, liquid: string, footer: string, css: string): Template =>
  ({ id, builtIn: true, manifest: manifest as TemplateManifest, header, liquid, footer, css })

export const builtInTemplates: Template[] = [
  tpl('tpl-klar', klarManifest, klarHeader, klarLiquid, klarFooter, klarCss),
  tpl('tpl-kante', kanteManifest, kanteHeader, kanteLiquid, kanteFooter, kanteCss),
  tpl('tpl-leise', leiseManifest, leiseHeader, leiseLiquid, leiseFooter, leiseCss),
]
