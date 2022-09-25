import { UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtWsGuard, UserPayload } from 'src/auth/jwt-ws.guard';
import { GameService } from './game.service';

import { ROUTES_BASE } from 'shared/websocketRoutes/routes';
import { UsersService } from 'src/user/user.service';
import { User } from 'src/user/user.entity';
import GameRoom from 'shared/interfaces/game/GameRoom';
import PlayerInput from 'shared/interfaces/game/PlayerInput';


@WebSocketGateway({
  transport: ['websocket'],
  cors: '*/*',
})
export class GameGateway {
  private gameLobby = 'gameLobby';

  constructor(
    private userService: UsersService,
    private gameService: GameService,
  ) {}

  @WebSocketServer()
  server: Server;

  // @UseGuards(JwtWsGuard)
  // @SubscribeMessage(ROUTES_BASE.GAME.JOIN_GAME_LOBBY_REQUEST)
  // async joinGameLobby(@ConnectedSocket() client: Socket) {
  //   client.join(this.gameLobby);
  //   this.server
  //     .in(this.gameLobby)
  //     .emit(
  //       ROUTES_BASE.GAME.UPDATE_SPECTABLE_GAMES,
  //       await this.gameService.getSpectableGames(),
  //     );
  // }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.GAME.SEND_INPUT)
  async receiveInput(
    @MessageBody() playerInput: PlayerInput,
    @UserPayload() payload: any,
  ) {
    this.gameService.updatePlayerPosition(playerInput, payload.userId);
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.GAME.CREATE_GAME_REQUEST)
  async createGame(
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    const user: User = await this.userService.getById(payload.userId);
    const gameRoom: GameRoom = this.gameService.createGame(user);

    client.join(gameRoom.roomName);

    this.server.in(gameRoom.roomName).emit(ROUTES_BASE.GAME.CONFIRM_GAME_JOINED, gameRoom);
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.GAME.JOIN_GAME_REQUEST)
  async joinGame(
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    const user: User = await this.userService.getById(payload.userId);
    const gameRoom: GameRoom = this.gameService.matchMaking(user);

    client.join(gameRoom.roomName);

    this.server.in(gameRoom.roomName).emit(ROUTES_BASE.GAME.CONFIRM_GAME_JOINED, gameRoom);

    if (gameRoom.started === true) {
      this.server.emit(
        ROUTES_BASE.GAME.UPDATE_SPECTABLE_GAMES,
        this.gameService.getSpectableGames(),
      );
      GameService.gameIntervalList[gameRoom.roomName] = setInterval(
        () => {
          const newGameRoom = this.gameService.gameLoop(gameRoom.roomName);

          if (this.gameService.isGameFinished(newGameRoom))
          {
            clearInterval(GameService.gameIntervalList[gameRoom.roomName])
          }
          this.server.in(gameRoom.roomName).emit(ROUTES_BASE.GAME.UPDATE_GAME, newGameRoom);
        }, 10);
    }
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.GAME.GET_SPECTABLE_GAMES_REQUEST)
  async getSpectableGames(
    // @MessageBody() roomName: any,
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    this.server.in(client.id).emit(
      ROUTES_BASE.GAME.UPDATE_SPECTABLE_GAMES,
      this.gameService.getSpectableGames(),
    );
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.GAME.JOIN_SPECTATE_REQUEST)
  async joinSpectateRequest(
    @MessageBody() roomName: string,
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    const gameRoom: GameRoom = this.gameService.findByRoomName(roomName);

    if (gameRoom === undefined) {
      // error
      return;
    }

    client.join(gameRoom.roomName);
  }
}