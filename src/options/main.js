import { ScryOptionsApp } from './app.js'

const app = new ScryOptionsApp({ document, chromeApi: globalThis.chrome })
void app.start()
