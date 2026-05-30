import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from './env';

@Injectable()
export class EnvService {
  constructor(protected readonly configService: ConfigService<Env>) {}

  get<Key extends keyof Env>(key: Key): Env[Key] {
    return this.configService.get(key, { infer: true })!;
  }
}
