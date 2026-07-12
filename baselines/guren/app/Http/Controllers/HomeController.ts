import { Controller } from '@guren/core'
import { pages } from '../../../.guren/pages.gen.js'

export default class HomeController extends Controller {
  async index(): Promise<Response> {
    const props = {
      message: 'Welcome to Guren!',
    }

    return this.inertia(pages.Home, props, { url: this.request.path, title: 'Guren' })
  }
}
