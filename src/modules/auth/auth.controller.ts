import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern('auth.login')
  login(@Payload() payload: { email: string; password: string }) {
    return this.auth.login(payload?.email, payload?.password);
  }
}
