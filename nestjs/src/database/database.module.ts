import { Global, Module } from '@nestjs/common';
import { createDatabase, DRIZZLE } from './database';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: () =>
        createDatabase(process.env.DATABASE_PATH ?? 'minilog.db'),
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
