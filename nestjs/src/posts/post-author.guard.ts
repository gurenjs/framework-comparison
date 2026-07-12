import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PostsService } from './posts.service';

/** Allows only the post's author through; use behind `AuthenticatedGuard`. */
@Injectable()
export class PostAuthorGuard implements CanActivate {
  constructor(private readonly postsService: PostsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const id = Number(request.params.id);
    const post = Number.isInteger(id)
      ? await this.postsService.findOne(id)
      : undefined;
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.author.id !== request.user?.id) {
      throw new ForbiddenException('Only the author can modify this post');
    }
    return true;
  }
}
