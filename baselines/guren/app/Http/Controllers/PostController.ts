import { Controller, paginate, type PaginatedPageProps } from '@guren/core'
import { pages } from '../../../.guren/pages.gen.js'
import { Post } from '../../Models/Post.js'
import { PostResource, type PostResourceData } from '../Resources/PostResource.js'
import { PostIdParamSchema, PostPayloadSchema, ListPostsQuerySchema } from '../Validators/PostValidator.js'

type PostsIndexProps = PaginatedPageProps<PostResourceData>

export default class PostController extends Controller {
  async index(): Promise<Response> {
    const { page } = this.validateQuery(ListPostsQuerySchema)
    const result = await Post.paginate({ page, perPage: 10, orderBy: ['id', 'desc'] })
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
    const post = await Post.findOrFail(id)

    return this.inertia(pages.posts.Show, {
      post: new PostResource(post).toJSON(),
    })
  }

  async create(): Promise<Response> {
    return this.inertia(pages.posts.New, {})
  }

  async store(): Promise<Response> {
    await this.auth.userOrFail()
    await this.authorize('create', Post)
    const data = await this.validateBody(PostPayloadSchema)
    const post = await Post.create(data)
    return this.redirect('/posts/' + post?.id)
  }

  async edit(): Promise<Response> {
    const { id } = this.validateParams(PostIdParamSchema)
    const post = await Post.findOrFail(id)
    return this.inertia(pages.posts.Edit, {
      post: new PostResource(post).toJSON(),
      errors: {},
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
}
