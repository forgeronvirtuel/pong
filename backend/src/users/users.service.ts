import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './user.entity';
import { UserDto } from './user.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from 'src/auth/jwt.strategy';
import { AuthUserIdDto } from 'src/auth/auth-user.dto';
import { LocalFilesService } from 'src/localFiles/localFiles.service';

// This should be a real class/interface representing a user entity
export type UserLocal = { userId: number; username: string; password: string };

async function crypt(password: string): Promise<string> {
  return bcrypt.genSalt(10).then((s) => bcrypt.hash(password, s));
}

async function passwordCompare(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private localFilesService: LocalFilesService
  ) {}

  async findOne(username: string): Promise<User | undefined> {
    return await this.usersRepository.findOneBy({
      username: username,
    });
  }


  async signup (dto: UserDto) {
    if (!UserDto.passwordScheme.validate(dto.password)) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: 'Password should contains 8 character minimum, it should had uppercase, lowercase and minimum 2 digits to be valid',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const hash = await crypt(dto.password);

    // database operation
    const user = User.create({
        username: dto.username,
        password: hash,
        email: dto.email,
    });
    try {
      await user.save();
    } catch (e) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: 'Username or Email already used',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return;
  }

  async signin(dto: Omit<UserDto, 'email'>) {
    const user = await this.findOne(dto.username);

    if (await passwordCompare(dto.password, user.password)) {
      const user = await this.findOne(dto.username)
      
      const payload: JwtPayload = { username: user.username, sub: user.id };
      return {
        access_token: this.jwtService.sign(payload),
      };
    }
    // password did not match
    throw new HttpException(
      {
        status: HttpStatus.BAD_REQUEST,
        error: 'Username and Password did not match',
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  async signout() {
    // destroy session
  }

  async get_picture(dto: AuthUserIdDto ) {
    // const user = await this.findOne(dto.username);
    const user = await this.usersRepository.findOne(
      {
        where: { username: dto.username },
        relations: { avatar: true }
      }
    )

    return user.avatar.path;
  }
  
  async add_avatar(userId: number, fileData: LocalFileDto) {
    const avatar = await this.localFilesService.saveLocalFileData(fileData);
    await this.usersRepository.update(userId, {
      avatarId: avatar.id
    })
  }
}
