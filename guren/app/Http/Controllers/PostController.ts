import { Controller, paginate, type PaginatedPageProps } from '@guren/core'
import { pages } from '../../../.guren/pages.gen.js'
import { Comment } from '../../Models/Comment.js'
import { Post } from '../../Models/Post.js'
import type { UserRecord } from '../../Models/User.js'
import { PostResource, type PostResourceData } from '../Resources/PostResource.js'
import { PostIdParamSchema, PostPayloadSchema, ListPostsQuerySchema } from '../Validators/PostValidator.js'

type PostsIndexProps = PaginatedPageProps<PostResourceData>

export default class PostController extends Controller {
  async index(): Promise<Response> {
    const { page } = this.validateQuery(ListPostsQuerySchema)
    const result = await Post.paginate({ page, perPage: 10, orderBy: ['createdAt', 'desc'] })
    const paginator = paginate(result, { path: this.request.path ?? '/posts' })

    return this.inertia(pages.posts.Index, {
      data: result.data.map((post) => new PostResource(post).toJSON()),
      pagination: {
        meta: paginator.meta(),
        links: paginator.links(),
      },
    } satisfies PostsIndexProps)
  }

  async show(): Promise<Response> {
    const { id } = this.validateParams(PostIdParamSchema)
    const post = await Post.findWithOrFail(id, 'author')
    const comments = (await Comment.where('postId', id).with('author').orderBy('createdAt', 'desc').get()) as Array<
      import('../../Models/Comment.js').CommentRecord & { author?: { id: number; name: string } | null }
    >

    return this.inertia(pages.posts.Show, {
      post: new PostResource(post).toJSON(),
      comments: comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        userId: comment.userId,
        author: comment.author ? { name: comment.author.name } : null,
        createdAt: comment.createdAt,
      })),
    })
  }

  async create(): Promise<Response> {
    return this.inertia(pages.posts.New, {})
  }

  async store(): Promise<Response> {
    const user = await this.auth.userOrFail<UserRecord>()
    await this.authorize('create', Post)
    const data = await this.validateBody(PostPayloadSchema)
    const post = await Post.create({ ...data, userId: user.id })
    return this.redirect('/posts/' + post?.id)
  }

  async edit(): Promise<Response> {
    const { id } = this.validateParams(PostIdParamSchema)
    const post = await Post.findOrFail(id)
    await this.authorize('update', [Post, post])
    return this.inertia(pages.posts.Edit, {
      post: new PostResource(post).toJSON(),
    })
  }

  async update(): Promise<Response> {
    await this.auth.userOrFail()
    const { id } = this.validateParams(PostIdParamSchema)
    await this.authorize('update', [Post, await Post.findOrFail(id)])
    const data = await this.validateBody(PostPayloadSchema)
    await Post.update({ id }, data)
    return this.redirect('/posts/' + id)
  }

  async destroy(): Promise<Response> {
    await this.auth.userOrFail()
    const { id } = this.validateParams(PostIdParamSchema)
    await this.authorize('delete', [Post, await Post.findOrFail(id)])
    await Comment.where('postId', id).delete()
    await Post.delete({ id })
    return this.redirect('/posts')
  }
}
