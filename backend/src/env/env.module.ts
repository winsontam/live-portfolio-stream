import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigModuleOptions } from '@nestjs/config';
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvService } from './env.service';
import { Env } from './env';

@Module({
  imports: [ConfigModule],
  providers: [EnvService],
  exports: [EnvService],
})
export class EnvModule {
  static forRoot(options?: Omit<ConfigModuleOptions, 'validate'>): DynamicModule {
    return {
      module: EnvModule,
      imports: [
        ConfigModule.forRoot({
          ...options,
          validate: (config: Record<string, unknown>) => {
            const validatedConfig = plainToClass(Env, config);
            const errors = validateSync(validatedConfig);

            if (errors.length > 0) {
              throw new Error(errors.toString());
            }

            return validatedConfig;
          },
        }),
      ],
      providers: [EnvService],
      exports: [EnvService],
    };
  }
}
