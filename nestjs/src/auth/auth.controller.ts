import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SessionUser } from '../users/users.service';
import { AuthService } from './auth.service';
import { AuthenticatedGuard } from './authenticated.guard';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const user = await this.authService.register(dto);
    await logIn(req, user);
    return { user };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Req() req: Request) {
    return { user: req.user };
  }

  @UseGuards(AuthenticatedGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request) {
    await logOut(req);
  }

  @Get('me')
  me(@Req() req: Request) {
    return { user: req.user ?? null };
  }
}

function logIn(req: Request, user: SessionUser): Promise<void> {
  return new Promise((resolve, reject) => {
    req.logIn(user, (err) => (err ? reject(err as Error) : resolve()));
  });
}

function logOut(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.logOut((err) => (err ? reject(err as Error) : resolve()));
  });
}
