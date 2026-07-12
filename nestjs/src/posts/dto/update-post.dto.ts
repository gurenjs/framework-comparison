import { CreatePostDto } from './create-post.dto';

/** PUT replaces the whole post, so updates share the create rules. */
export class UpdatePostDto extends CreatePostDto {}
