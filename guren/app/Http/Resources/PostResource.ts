import { Resource } from '@guren/core'
import type { PostAuthor, PostRecord } from '../../Models/Post.js'

type PostWithAuthor = PostRecord & { author?: PostAuthor | null }

export interface PostResourceData extends Record<string, unknown> {
  id: number
  title: string
  body: string
  createdAt: string
  userId: number
  author: { id: number; name: string } | null
}

export class PostResource extends Resource<PostWithAuthor> {
  toArray(): PostResourceData {
    return {
      id: this.resource.id,
      title: this.resource.title,
      body: this.resource.body,
      createdAt: this.resource.createdAt,
      userId: this.resource.userId,
      author: this.resource.author ? { id: this.resource.author.id, name: this.resource.author.name } : null,
    }
  }

  override toJSON(): PostResourceData {
    return super.toJSON() as PostResourceData
  }
}
