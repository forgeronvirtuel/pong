import {
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtWsGuard, UserPayload } from 'src/auth/jwt-ws.guard';
import { ChatService } from './chat.service';
import { UsersService } from 'src/user/user.service';
import { ROUTES_BASE } from 'shared/websocketRoutes/routes';
import { User } from 'src/user/user.entity';
import CreateChannel from '../../shared/interfaces/CreateChannel';
import SearchChannel from '../../shared/interfaces/SearchChannel';

import * as bcrypt from 'bcrypt';
import JoinChannel from 'shared/interfaces/JoinChannel';

async function crypt(password: string): Promise<string> {
  return bcrypt.genSalt(10).then((s) => bcrypt.hash(password, s));
}

async function passwordCompare(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

@WebSocketGateway({
  transport: ['websocket'],
  cors: '*/*',
})
export class ChatGateway {
  private channelLobby = 'channelLobby';
  constructor(
    private readonly chatService: ChatService,
    private readonly userService: UsersService,
  ) {}

  @WebSocketServer()
  server: Server;

  /* JOIN CHANNEL LOBBY */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.JOIN_CHANNEL_LOBBY_REQUEST)
  async joinChannelLobby(@ConnectedSocket() client: Socket) {
    client.join(this.channelLobby);
    this.server
      .in(this.channelLobby)
      .emit(
        ROUTES_BASE.CHAT.LIST_ALL_CHANNELS,
        await this.chatService.getAllPublicRooms(),
      );
  }

  /* CREATE ROOM */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.CREATE_CHANNEL_REQUEST)
  async createRoom(
    @MessageBody() data: CreateChannel,
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    if (data.channelName === '') {
      throw new BadRequestException({
        error: 'You must input a channel name',
      });
    }
    /*  We first check if the channel name is already taken, if it is 
        we throw a Bad Request exception */
    const duplicateRoomCheck =
      await this.chatService.getRoomByNameWithRelations(data.channelName);

    if (duplicateRoomCheck) {
      throw new BadRequestException({
        error: 'Channel name is already taken',
      });
    }
    /*  Then we check if the channel will be password protected, if it's not
        then the password will be an empty string, if it is we hash the 
        password */
    let hashedPassword = '';

    if (data.password !== '') hashedPassword = await crypt(data.password);

    /*  Then we create the room in the db and then enter the channel we 
        just created */
    const newRoom = await this.chatService.saveRoom({
      roomName: data.channelName,
      userId: payload.userId,
      isChannelPrivate: data.isChannelPrivate,
      password: hashedPassword,
    });

    await client.join(newRoom.roomName);

    this.server.in(client.id).emit(ROUTES_BASE.CHAT.CONFIRM_CHANNEL_CREATION, {
      channelId: newRoom.id,
      channelName: newRoom.channelName,
    });

    if (newRoom.isChannelPrivate === false) {
      this.server
        .in(this.channelLobby)
        .emit(ROUTES_BASE.CHAT.NEW_CHANNEL_CREATED, {
          channelId: newRoom.id,
          channelName: newRoom.channelName,
        });
    }

    const connectedUserIdList: number[] =
      this.chatService.updateUserConnectedToRooms(
        newRoom.roomName,
        payload.userId,
      );
    this.server
      .in(newRoom.roomName)
      .emit(ROUTES_BASE.CHAT.UPDATE_CONNECTED_USERS, connectedUserIdList);
  }

  /* CREATE DM ROOM*/
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.CREATE_DM)
  async createDM(
    @MessageBody() friendId: number,
    @UserPayload() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    const receiver = await this.userService.getById(friendId);

    if (payload.userId === friendId) {
      console.log('Dm yourself');
      throw new BadRequestException({
        error: "You're trying to send a DM to yourself",
      });
    }

    const newDMRoom = await this.chatService.saveDMRoom(
      friendId,
      payload.userId,
    );

    await client.join(newDMRoom.roomName);

    this.server
      .in(client.id)
      .emit(ROUTES_BASE.CHAT.CONFIRM_DM_CHANNEL_CREATION, {
        channelId: newDMRoom.id,
        channelName: newDMRoom.channelName,
      });

    const connectedUserIdList: number[] =
      this.chatService.updateUserConnectedToRooms(
        newDMRoom.roomName,
        payload.userId,
      );
    this.server
      .in(newDMRoom.roomName)
      .emit(ROUTES_BASE.CHAT.UPDATE_CONNECTED_USERS, connectedUserIdList);
  }

  /* JOIN ROOM */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.JOIN_CHANNEL_REQUEST)
  async joinRoom(
    @MessageBody() data: JoinChannel,
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    const room = await this.chatService.getRoomsById(
      {
        id: data.roomId /*, isDM: false */,
      },
      {
        members: true,
        messages: {
          author: true,
        },
      },
    );

    if (room.password !== '') {
      const isGoodPassword = await passwordCompare(
        data.inputPassword,
        room.password,
      );
      if (!isGoodPassword)
        throw new UnauthorizedException({
          error:
            'A password has been set for this channel. Please enter the correct password.',
        });
    }

    client.join(room.roomName);
    await this.chatService.addMemberToChannel(payload.userId, room);
    this.server.in(client.id).emit(ROUTES_BASE.CHAT.CONFIRM_CHANNEL_ENTRY, {
      channelId: room.id,
      channelName: room.channelName,
    });

    const connectedUserIdList: number[] =
      this.chatService.updateUserConnectedToRooms(
        room.roomName,
        payload.userId,
      );
    this.server
      .in(room.roomName)
      .emit('updateConnectedUsers', connectedUserIdList);
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.SEARCH_CHANNEL_REQUEST)
  async searchARoom(
    @MessageBody() data: SearchChannel,
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    const room = await this.chatService.getRoomByNameWithRelations(
      data.channelName,
    );
    if (!room) {
      throw new BadRequestException({
        error: 'You must specify which channel you want to join',
      });
    }

    if (room.password !== '') {
      const isGoodPassword = await passwordCompare(
        data.inputPassword,
        room.password,
      );
      if (!isGoodPassword)
        throw new UnauthorizedException({
          error:
            'A password has been set for this channel. Please enter the correct password.',
        });
    }

    client.join(room.roomName);
    if (room.isDM === false)
      await this.chatService.addMemberToChannel(payload.userId, room);
    this.server.in(client.id).emit(ROUTES_BASE.CHAT.CONFIRM_CHANNEL_ENTRY, {
      channelId: room.id,
      channelName: room.channelName,
    });

    this.server.in(client.id).emit(
      'messageHistory',
      room.messages.map((message) => {
        return {
          id: message.id,
          author: this.userService.getFrontUsername(message.author),
          time: message.createdAt,
          content: message.content,
        };
      }),
    );
    const connectedUserIdList: number[] =
      this.chatService.updateUserConnectedToRooms(
        room.roomName,
        payload.userId,
      );
    this.server
      .in(room.roomName)
      .emit(ROUTES_BASE.CHAT.UPDATE_CONNECTED_USERS, connectedUserIdList);
  }

  /* JOIN DM ROOM*/
  /** Leaving these comments right now, don't think I'll need it but
   * I want to make sure */

  // @UseGuards(JwtWsGuard)
  // @SubscribeMessage(ROUTES_BASE.CHAT.JOIN_DM_CHANNEL_REQUEST)
  // async joinDMRoom(
  //   @MessageBody() roomId: number,
  //   @ConnectedSocket() client: Socket,
  //   @UserPayload() payload: any,
  // ) {
  //   const room = await this.chatService.getRoomsById(
  //     { id: roomId, isDM: true },
  //     {
  //       members: true,
  //     },
  //   );
  //   client.join(room.roomName);
  //   this.server.in(client.id).emit(ROUTES_BASE.CHAT.CONFIRM_DM_CHANNEL_ENTRY, {
  //     channelId: room.id,
  //     channelName: room.channelName,
  //   });

  //   const connectedUserIdList: number[] =
  //     this.chatService.updateUserConnectedToRooms(
  //       room.roomName,
  //       payload.userId,
  //     );
  //   this.server
  //     .in(room.roomName)
  //     .emit(ROUTES_BASE.CHAT.UPDATE_CONNECTED_USERS, connectedUserIdList);
  // }

  /* GET USERS IN CHANNEL */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.GET_CONNECTED_USER_LIST_REQUEST)
  async getUsersInChannel(
    @MessageBody() roomId: number,
    @UserPayload() payload: any,
  ) {
    const room = await this.chatService.getRoomsById(
      { id: roomId },
      { members: true },
    );
    const caller = await this.userService.getById(payload.userId);

    this.server.in(room.roomName).emit(
      ROUTES_BASE.CHAT.CONNECTED_USER_LIST,
      room.members.map((user: User) => {
        return {
          id: user.id,
          pongUsername: this.userService.getFrontUsername(user),
        };
      }),
    );
  }

  /* DISCONNECT FROM CHANNEL */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.DISCONNECT_FROM_CHANNEL_REQUEST)
  async disconnectFromChannel(
    @MessageBody() roomId: number,
    @UserPayload() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.chatService.getRoomsById({ id: roomId });
    client.leave(room.roomName);
    this.server
      .in(client.id)
      .emit(ROUTES_BASE.CHAT.CONFIRM_CHANNEL_DISCONNECTION, {
        channelId: room.id,
        channelName: room.channelName,
      });

    const connectedUserIdList: number[] =
      this.chatService.removeUserConnectedToRooms(
        room.roomName,
        payload.userId,
      );
    this.server
      .in(room.roomName)
      .emit(ROUTES_BASE.CHAT.UPDATE_CONNECTED_USERS, connectedUserIdList);
  }

  /*MESSAGE LISTENER */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.SEND_MESSAGE)
  async messageListener(
    @MessageBody() data: { message: string; channelId: number },
    @UserPayload() payload: any,
  ) {
    if (data.message === '') return;
    const room = await this.chatService.getRoomsById(
      { id: data.channelId },
      { messages: true },
    );
    const author = await this.userService.getUserByIdWithMessages(
      payload.userId,
    );

    const newMessage = await this.chatService.saveMessage(
      data.message,
      author,
      room,
    );

    if (room)
      this.server.in(room.roomName).emit(ROUTES_BASE.CHAT.RECEIVE_MESSAGE, {
        id: newMessage.id,
        author: this.userService.getFrontUsername(newMessage.author),
        time: newMessage.createdAt,
        content: newMessage.content,
      });
  }
}
