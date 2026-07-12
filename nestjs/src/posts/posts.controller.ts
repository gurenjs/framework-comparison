import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { parseIdPipe } from '../common/parse-id.pipe';
import type { SessionUser } from '../users/users.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostAuthorGuard } from './post-author.guard';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {
    return this.postsService.findAll(page);
  }

  @Get(':id')
  async findOne(@Param('id', parseIdPipe('Post')) id: number) {
    const post = await this.postsService.findOne(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return { post };
  }

  @UseGuards(AuthenticatedGuard)
  @Post()
  async create(@Body() dto: CreatePostDto, @CurrentUser() user: SessionUser) {
    return { post: await this.postsService.create(dto, user.id) };
  }

  @UseGuards(AuthenticatedGuard, PostAuthorGuard)
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ) {
    return { post: await this.postsService.update(id, dto) };
  }

  @UseGuards(AuthenticatedGuard, PostAuthorGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.postsService.remove(id);
  }
}
