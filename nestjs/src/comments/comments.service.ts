import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Drizzle } from '../database/database';
import { comments, posts } from '../database/schema';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

  async create(postId: number, dto: CreateCommentDto, authorId: number) {
    const post = await this.db.query.posts.findFirst({
      where: eq(posts.id, postId),
      columns: { id: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    const [comment] = await this.db
      .insert(comments)
      .values({ body: dto.body, postId, authorId })
      .returning();
    return comment;
  }

  findOneWithPost(id: number) {
    return this.db.query.comments.findFirst({
      where: eq(comments.id, id),
      with: { post: { columns: { authorId: true } } },
    });
  }

  async remove(id: number): Promise<void> {
    await this.db.delete(comments).where(eq(comments.id, id));
  }
}
