import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { parseIdPipe } from '../common/parse-id.pipe';
import type { SessionUser } from '../users/users.service';
import { CommentAccessGuard } from './comment-access.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @UseGuards(AuthenticatedGuard)
  @Post('posts/:postId/comments')
  async create(
    @Param('postId', parseIdPipe('Post')) postId: number,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: SessionUser,
  ) {
    return { comment: await this.commentsService.create(postId, dto, user.id) };
  }

  @UseGuards(AuthenticatedGuard, CommentAccessGuard)
  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.commentsService.remove(id);
  }
}
