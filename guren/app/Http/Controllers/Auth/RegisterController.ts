import { Controller, ScryptHasher, ValidationException } from '@guren/core'
import { pages } from '../../../../.guren/pages.gen.js'
import { SendWelcomeNotificationJob } from '../../../Jobs/SendWelcomeNotificationJob.js'
import { User } from '../../../Models/User.js'
import { RegisterSchema } from '../../Validators/RegisterValidator.js'

export default class RegisterController extends Controller {
  async show(): Promise<Response> {
    return this.inertia(pages.auth.Register, {}, { url: this.request.path, title: 'Register' })
  }

  async store(): Promise<Response> {
    const { name, email, password } = await this.validateBody(RegisterSchema)

    if (await User.where('email', email).first()) {
      throw ValidationException.withMessages({ email: 'This email address is already registered.' })
    }

    const passwordHash = await new ScryptHasher().hash(password)
    const user = await User.create({ name, email, passwordHash })

    await SendWelcomeNotificationJob.dispatch({ userId: user?.id as number, name })

    this.auth.session()?.regenerate()
    await this.auth.attempt({ email, password })

    return this.redirect('/posts')
  }
}
