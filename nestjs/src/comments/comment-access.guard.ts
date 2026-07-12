import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CommentsService } from './comments.service';

/**
 * Allows a comment's author or the post's author to delete the comment;
 * use behind `AuthenticatedGuard`.
 */
@Injectable()
export class CommentAccessGuard implements CanActivate {
  constructor(private readonly commentsService: CommentsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const id = Number(request.params.id);
    const comment = Number.isInteger(id)
      ? await this.commentsService.findOneWithPost(id)
      : undefined;
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    const userId = request.user?.id;
    if (comment.authorId !== userId && comment.post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the comment author or the post author can delete this comment',
      );
    }
    return true;
  }
}
