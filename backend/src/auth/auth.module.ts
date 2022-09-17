import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UsersModule } from '../user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { WsGuard } from './jwt-ws.guard';
import { FortyTwoModule } from './fortytwo.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    FortyTwoModule,
    UsersModule,
    PassportModule,
    JwtModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthStrategy /*JwtWebsocketStrategy*/, WsGuard],
  exports: [AuthService, WsGuard],
})
export class AuthModule {}
