import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCommentDto {
  @Transform(trim)
  @IsString({ message: 'Comment is required' })
  @IsNotEmpty({ message: 'Comment is required' })
  @MaxLength(1_000, { message: 'Comment must be at most 1,000 characters' })
  body!: string;
}
