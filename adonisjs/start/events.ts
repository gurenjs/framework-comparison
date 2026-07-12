/*
|--------------------------------------------------------------------------
| Events file
|--------------------------------------------------------------------------
|
| Bindings between application events and their listeners.
|
*/

import { events } from '#generated/events'
import { listeners } from '#generated/listeners'
import emitter from '@adonisjs/core/services/emitter'

emitter.listen(events.UserRegistered, [listeners.SendWelcomeNotification])
