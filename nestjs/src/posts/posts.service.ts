import { Inject, Injectable } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Drizzle } from '../database/database';
import { comments, posts } from '../database/schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

const PER_PAGE = 10;

const authorColumns = { columns: { id: true, name: true } } as const;

@Injectable()
export class PostsService {
  constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

  async findAll(page: number) {
    const current = Math.max(1, page);
    const [items, total] = await Promise.all([
      this.db.query.posts.findMany({
        columns: { id: true, title: true, body: true, createdAt: true },
        with: { author: authorColumns },
        orderBy: [desc(posts.createdAt), desc(posts.id)],
        limit: PER_PAGE,
        offset: (current - 1) * PER_PAGE,
      }),
      this.db.$count(posts),
    ]);
    return {
      posts: items,
      pagination: {
        page: current,
        perPage: PER_PAGE,
        total,
        totalPages: Math.ceil(total / PER_PAGE),
      },
    };
  }

  findOne(id: number) {
    return this.db.query.posts.findFirst({
      where: eq(posts.id, id),
      columns: { id: true, title: true, body: true, createdAt: true },
      with: {
        author: authorColumns,
        comments: {
          columns: { id: true, body: true, createdAt: true },
          with: { author: authorColumns },
          orderBy: [asc(comments.createdAt), asc(comments.id)],
        },
      },
    });
  }

  async create(dto: CreatePostDto, authorId: number) {
    const [post] = await this.db
      .insert(posts)
      .values({ title: dto.title, body: dto.body, authorId })
      .returning();
    return post;
  }

  async update(id: number, dto: UpdatePostDto) {
    const [post] = await this.db
      .update(posts)
      .set({ title: dto.title, body: dto.body })
      .where(eq(posts.id, id))
      .returning();
    return post;
  }

  async remove(id: number): Promise<void> {
    await this.db.delete(posts).where(eq(posts.id, id));
  }
}
