import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePostDto {
  @Transform(trim)
  @IsString({ message: 'Title is required' })
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(120, { message: 'Title must be at most 120 characters' })
  title!: string;

  @Transform(trim)
  @IsString({ message: 'Body is required' })
  @IsNotEmpty({ message: 'Body is required' })
  @MaxLength(10_000, { message: 'Body must be at most 10,000 characters' })
  body!: string;
}
