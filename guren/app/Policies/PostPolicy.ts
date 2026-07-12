import { Policy, type AuthUser } from '@guren/core'

interface PostLike {
  userId?: string | number
}

export class PostPolicy extends Policy {
  viewAny(_user: AuthUser | null): boolean {
    return true
  }

  view(_user: AuthUser | null, _post: PostLike): boolean {
    return true
  }

  create(user: AuthUser | null): boolean {
    return user !== null
  }

  update(user: AuthUser | null, post: PostLike): boolean {
    return user !== null && user.id === post.userId
  }

  delete(user: AuthUser | null, post: PostLike): boolean {
    return user !== null && user.id === post.userId
  }
}
