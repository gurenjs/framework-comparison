import User from '#models/user'
import { events } from '#generated/events'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup', {})
  }

  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(signupValidator)
    const user = await User.create({ ...payload })

    await auth.use('web').login(user)

    /**
     * The welcome notification is recorded by a listener, outside
     * the request/response critical path
     */
    events.UserRegistered.dispatch(user)

    response.redirect().toRoute('posts.index')
  }
}
