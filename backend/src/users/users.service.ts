import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './user.entity';
import { Game } from 'src/game/game.entity';
import { CreateUserDto } from './create-user.dto';
import * as bcrypt from 'bcrypt';

import * as PasswordValidator from 'password-validator';

// const passwordValidator = require('password-validator');

// This should be a real class/interface representing a user entity
export type UserLocal = { userId: number; username: string; password: string };

async function crypt(pass: string): Promise<string> {
  return bcrypt.genSalt(10).then((s) => bcrypt.hash(pass, s));
}
@Injectable()
export class UsersService {

  private readonly logger = new Logger(UsersService.name);
  private static readonly passwordScheme = new PasswordValidator();
  static {
    UsersService.passwordScheme
      .is()
      .min(8)
      .has()
      .uppercase()
      .has()
      .lowercase()
      .has()
      .digits(2);
  }

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,

    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
  ) {}

  async findOne(username: string): Promise<User | undefined> {
    return this.usersRepository.findOneBy({
      username: username,
    });
  }

  async createUser(user: CreateUserDto) {
    const userEntity = new User();
    userEntity.username = user.username;
    //should validate email either by checking that it containt [anything]@[anything].[anything]
    //or by trying to send email to it, hence, using this occasion to 2FA ?
    // if (!validateEmail(user.email)) {
    //   throw new HttpException(
    //     {
    //       status: HttpStatus.BAD_REQUEST,
    //       error: 'Bad mail format',
    //     },
    //     HttpStatus.BAD_REQUEST,
    //   );
    // }
    userEntity.email = user.email;
    if (!UsersService.passwordScheme.validate(user.password)) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error:
            'Password should contains 8 character minimum, it should had uppercase, lowercase and minimum 2 digits to be valid',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    userEntity.user_rank = user.user_rank;
    userEntity.password = await crypt(user.password);

    // TODO check constraint
    try {
      await this.usersRepository.save(userEntity);
    } catch (e: unknown) {
      if (e instanceof QueryFailedError) {
        this.logger.error(JSON.stringify(e));
        throw new HttpException(
          {
            status: HttpStatus.BAD_REQUEST,
            error: 'Username already exists', // most likely, but not necessarily (constraint)
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw e;
    }
  }

  async get_user_rank(dto: CreateUserDto) {
    const user = await this.findOne(dto.username);
    
    return user.user_rank;
  }

  async get_user_history(dto: CreateUserDto) {
    
    /*  Get calling user's object */
    const user = await this.usersRepository.findOne({
      where: { username: dto.username }
    })

    /*  Get a games object where player 1 and player 2 exist and the calling user
        is either one or the other (where: ...) */
    const games = await this.gameRepository.find( {
      relations: {
        player1: true,
        player2: true,
      },
      where: [ 
        {player1_id: user.id},
        {player2_id: user.id},
      ]
    })
    
    return {
      user,
      games,
    };
  }
}
