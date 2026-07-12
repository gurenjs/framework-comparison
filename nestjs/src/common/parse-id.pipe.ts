import { NotFoundException, ParseIntPipe } from '@nestjs/common';

/** ParseIntPipe that 404s (instead of 400) when the id is not a number. */
export const parseIdPipe = (entity: string): ParseIntPipe =>
  new ParseIntPipe({
    exceptionFactory: () => new NotFoundException(`${entity} not found`),
  });
