// Autorizare pe roluri (§12.8): singurul loc care citeste rolurile dintr-un
// token deja verificat de hook-ul `authenticate('jwt')` (trebuie sa ruleze
// inainte, in acelasi lant `around`). Nu citeste niciodata `data`/payload-ul
// cererii - un REFID sau rol trimis de client nu poate schimba identitatea.
import { Forbidden } from '@feathersjs/errors'

export function requireRole (role) {
  return async (context, next) => {
    const proceed = () => (typeof next === 'function' ? next() : context)
    // Apel intern (fara `provider`) = server-side, deja de incredere - la fel
    // ca hook-ul `authenticate` insusi, care nu cere token pe acest tip de apel.
    if (!context.params.provider) return proceed()

    const payload = context.params.authentication && context.params.authentication.payload
    const roles = (payload && Array.isArray(payload.roles)) ? payload.roles : []
    if (!roles.includes(role)) {
      throw new Forbidden(`Rol lipsa pentru aceasta operatie: ${role}.`)
    }
    return proceed()
  }
}
