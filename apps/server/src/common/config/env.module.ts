import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ENV, type Env, getEnv, validateEnv } from './env.schema';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
  providers: [
    {
      provide: ENV,
      useFactory: (): Env => getEnv(),
    },
  ],
  exports: [ENV],
})
export class EnvModule {}
