import {
  Controller,
  Get,
  Logger,
  Post,
  Request,
  UseGuards,
  StreamableFile,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import { Game } from 'src/game/game.entity';
import { UserDto } from './user.dto';
import { UsersService } from './user.service';
import { GetFriendsListDto } from './get-friends-list.dto';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AddFriendDto } from './add-friend.dto';
import { NicknameDto } from './set-nickname.dto';
import { createReadStream } from 'fs';
import { join } from 'path';
import { Express } from 'express';
import LocalFilesInterceptor from 'src/localFiles/localFiles.interceptor';

@Controller('/user/')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get('get_user_rank')
  @UseGuards(JwtAuthGuard)
  async get_user_rank(@Body() user: Omit<UserDto, 'password'>) {
    const user_rank = await this.usersService.get_user_rank(user);

    return user_rank;
  }

  @Post('get_user_history')
  @UseGuards(JwtAuthGuard)
  async get_user_history(@Body() user: Omit<UserDto, 'password'>) {
    const userHistory = await this.usersService.get_user_history(user);

    if (!userHistory) return {};

    /*  Manipulating userHistory array so we get exactly what we want */

    const nbGames = userHistory.games.length;
    const nbWins = userHistory.games.filter((game) => {
      return game.winner == userHistory.user.id;
    }).length;
    return {
      nbGames,
      nbWins,
      games: userHistory.games.map((game) => {
        return {
          id: game.id,
          player1: this.usersService.getFrontUsername(game.player1),
          player2: this.usersService.getFrontUsername(game.player2),
          winner:
            game.winner === game.player1.id
              ? this.usersService.getFrontUsername(game.player1)
              : this.usersService.getFrontUsername(game.player2),
        };
      }),
    };
  }

  @Post('add_friend')
  @UseGuards(JwtAuthGuard)
  async add_friend(@Body() friend: AddFriendDto) {
    await this.usersService.add_friend(friend);
  }

  @Get('get_friends_list')
  @UseGuards(JwtAuthGuard)
  async get_friends_list(@Body() friend: GetFriendsListDto) {
    const friendList = await this.usersService.get_friends_list(friend);

    console.log(friendList);

    return friendList.map((friend) => {
      return {
        login42: this.usersService.getFrontUsername(friend.user),
      };
    });
  }

  @Get('get_nickname')
  @UseGuards(JwtAuthGuard)
  async get_username(@Body() user: UserDto) {
    return await this.usersService.get_nickname(user);
  }

  @Post('set_nickname')
  @UseGuards(JwtAuthGuard)
  async set_username(@Body() user: NicknameDto) {
    await this.usersService.set_nickname(user);
  }
  @Get('get_picture')
  @UseGuards(JwtAuthGuard)
  async get_picture(@Request() req): Promise<StreamableFile> {
    const picture_path = await this.usersService.get_picture(req.user);

    // https://docs.nestjs.com/techniques/streaming-files
    const file = createReadStream(join(process.cwd(), `${picture_path}`));
    return new StreamableFile(file);
  }

  @Post('set_picture')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    LocalFilesInterceptor({
      fieldName: 'file',
      path: '/avatars',
    }),
  )
  async uploadFile(@Request() req, @UploadedFile() file: Express.Multer.File) {
    console.log(req.user);
    return this.usersService.set_picture(req.user, {
      path: file.path,
      filename: file.originalname,
      mimetype: file.mimetype,
    });
  }
}
