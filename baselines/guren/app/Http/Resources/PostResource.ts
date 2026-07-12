import { Resource } from '@guren/core'
import type { PostRecord } from '../../Models/Post.js'

export interface PostResourceData extends Record<string, unknown> {
  id: number
  title: string
  body: string
}

export class PostResource extends Resource<PostRecord> {
  toArray(): PostResourceData {
    return {
      id: this.resource.id as number,
      title: this.resource.title as string,
      body: this.resource.body as string,
    }
  }

  override toJSON(): PostResourceData {
    return super.toJSON() as PostResourceData
  }
}
