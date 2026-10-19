import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthenticatedRequest, JwtAuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(100) password!: string;
  @IsString() @MinLength(8) @MaxLength(30) phone!: string;
}
class LoginDto { @IsEmail() email!: string; @IsString() @MinLength(8) password!: string; }
class GoogleDto { @IsString() @MinLength(20) @MaxLength(12000) idToken!: string; }
class LinkGoogleDto extends GoogleDto { @IsString() @MinLength(8) @MaxLength(100) currentPassword!: string; }
class UpdateProfileDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @MinLength(8) @MaxLength(30) phone!: string;
  @IsOptional() @IsString() @MinLength(8) currentPassword?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(100) newPassword?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get('google/config') googleConfig() { return this.auth.googleConfig(); }
  @Post('google') google(@Body() dto: GoogleDto) { return this.auth.googleLogin(dto.idToken); }
  @Post('google/link') @UseGuards(JwtAuthGuard) linkGoogle(@Req() request: AuthenticatedRequest, @Body() dto: LinkGoogleDto) { return this.auth.linkGoogle(request.user.sub, dto.idToken, dto.currentPassword); }
  @Post('register') register(@Body() dto: RegisterDto) { return this.auth.register(dto); }
  @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); }
  @Get('me') @UseGuards(JwtAuthGuard) me(@Req() request: AuthenticatedRequest) { return this.auth.me(request.user.sub); }
  @Patch('me') @UseGuards(JwtAuthGuard) updateMe(@Req() request: AuthenticatedRequest, @Body() dto: UpdateProfileDto) { return this.auth.updateProfile(request.user.sub, dto, request.user.authProvider); }
}
