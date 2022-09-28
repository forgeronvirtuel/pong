import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtWsGuard, UserPayload } from 'src/auth/jwt-ws.guard';
import { ChatService } from './chat.service';
import { UsersService } from 'src/user/user.service';
import { ROUTES_BASE } from 'shared/websocketRoutes/routes';
import CreateChannel from '../../shared/interfaces/CreateChannel';
import SearchChannel from '../../shared/interfaces/SearchChannel';
import { UserInterface } from 'shared/interfaces/User';

import * as bcrypt from 'bcrypt';
import JoinChannel from 'shared/interfaces/JoinChannel';
import ChannelData from 'shared/interfaces/ChannelData';
import UserPrivileges from 'shared/interfaces/UserPrivileges';
import Message from 'shared/interfaces/Message';
import ActionOnUser from 'shared/interfaces/ActionOnUser';
import UnattachFromChannel from 'shared/interfaces/UnattachFromChannel';
import roomId from 'shared/interfaces/JoinChannel';
import RoomId from 'shared/interfaces/JoinChannel';

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
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private channelLobby = 'channelLobby';
  constructor(
    private readonly chatService: ChatService,
    private readonly userService: UsersService,
  ) {}

  @WebSocketServer()
  server: Server;
  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const user = await this.chatService.getUserFromSocket(client);

      if (!user) return;
      const isRegistered = ChatService.userWebsockets.find(
        (element) => element.userId === user.id,
      );

      if (!isRegistered) {
        const newWebsocket = { userId: user.id, socketId: client.id };
        ChatService.userWebsockets = [
          ...ChatService.userWebsockets,
          newWebsocket,
        ];
      }
    } catch (e) {
      console.error(e.message);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    ChatService.userWebsockets = ChatService.userWebsockets.filter(
      (websocket) => websocket.socketId !== client.id,
    );
  }
  /* JOIN CHANNEL LOBBY */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.JOIN_CHANNEL_LOBBY_REQUEST)
  async joinChannelLobby(
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    client.join(this.channelLobby);
    this.server.in(this.channelLobby).emit(
      ROUTES_BASE.CHAT.LIST_ALL_CHANNELS,
      await this.chatService.getAllPublicRooms(),
      /** Either we send all 3 objects in 1 call from JOIN_CHANNEL_LOBBY_REQUEST, or we
       * use the below 2 routes along with this one individually.
       * I don't know what Matthieu will need so I'm keeping it like this for now,
       * will adapt when he's done.
       */
    );
  }

  /** JOIN ATTACHED CHANNELS LOBBY -- SHOWS ONLY THE CHANNELS THE USER
   * IS ATTACHED TO
   */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.JOIN_ATTACHED_CHANNEL_LOBBY_REQUEST)
  async joinAttachedChannelLobby(
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    this.server
      .in(client.id)
      .emit(
        ROUTES_BASE.CHAT.LIST_ALL_ATTACHED_CHANNELS,
        await this.chatService.getAllAttachedRooms(payload.userId),
      );
  }

  /** JOIN DM CHANNELS LOBBY -- SHOWS ONLY THE DMs THE CURRENT USER HAS */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.JOIN_DM_CHANNEL_LOBBY_REQUEST)
  async joinDMChannelLobby(
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    this.server
      .in(client.id)
      .emit(
        ROUTES_BASE.CHAT.LIST_ALL_DM_CHANNELS,
        await this.chatService.getAllDMRooms(payload.userId),
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
    this.joinAttachedChannelLobby(client, payload);
  }

  /* CREATE DM ROOM*/
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.CREATE_DM)
  async createDM(
    @MessageBody() friendId: number,
    @UserPayload() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    const newDMRoom = await this.chatService.saveDMRoom(
      friendId,
      payload.userId,
    );

    await client.join(newDMRoom.roomName);

    const receiverSocketId = this.chatService.getUserIdWebsocket(friendId);

    if (receiverSocketId) {
      /** Retrieve receiver's socket with the socket ID
       * https://stackoverflow.com/questions/67361211/socket-io-4-0-1-get-socket-by-id
       */

      const receiverSocket = this.server.sockets.sockets.get(
        receiverSocketId.socketId,
      );

      await receiverSocket.join(newDMRoom.roomName);
    }

    this.server
      .in(newDMRoom.roomName)
      .emit(ROUTES_BASE.CHAT.CONFIRM_DM_CHANNEL_CREATION, {
        channelId: newDMRoom.id,
        channelName: newDMRoom.channelName,
      });
    this.joinDMChannelLobby(client, payload);
  }

  /* ATTACH USER TO CHANNEL */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.ATTACH_TO_CHANNEL_REQUEST)
  async attachUserToChannel(
    @MessageBody() data: SearchChannel,
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    const room = await this.chatService.getRoomWithRelations(
      { channelName: data.channelName },
      {
        members: true,
        messages: { author: true },
      },
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
    await this.chatService.attachMemberToChannel(payload.userId, room);
    await this.joinAttachedChannelLobby(client, payload);
    await this.joinRoom({ roomId: room.id }, client, payload);
  }

  /** UNATTACH USER TO CHANNEL */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.UNATTACH_TO_CHANNEL_REQUEST)
  async unattachUserToChannel(
    @MessageBody() data: UnattachFromChannel,
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    const room = await this.chatService.getRoomWithRelations(
      { channelName: data.channelName },
      {
        members: true,
        messages: { author: true },
      },
    );
    if (!room) {
      throw new BadRequestException({
        error: 'You must specify which channel you want to leave',
      });
    }

    await this.chatService.unattachMemberToChannel(payload.userId, room);
    this.disconnectFromChannel(room.id, client);
  }

  /* JOIN ROOM */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.JOIN_CHANNEL_REQUEST)
  async joinRoom(
    @MessageBody() { roomId }: RoomId,
    @ConnectedSocket() client: Socket,
    @UserPayload() payload: any,
  ) {
    const room = await this.chatService.getRoomWithRelations(
      { id: roomId },
      {
        members: true,
        messages: { author: true },
      },
    );

    client.join(room.roomName);

    const channelData: ChannelData = {
      channelId: room.id,
      channelName: room.channelName,
    };
    this.server
      .in(client.id)
      .emit(ROUTES_BASE.CHAT.CONFIRM_CHANNEL_ENTRY, channelData);

    this.server.in(client.id).emit(
      ROUTES_BASE.CHAT.MESSAGE_HISTORY,
      room.messages.map((message) => {
        const messageForFront: Message = {
          id: message.id,
          author: this.userService.getFrontUsername(message.author),
          time: message.createdAt,
          content: message.content,
        };
        return messageForFront;
      }),
    );
  }

  /* DISCONNECT FROM CHANNEL */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.DISCONNECT_FROM_CHANNEL_REQUEST)
  async disconnectFromChannel(
    @MessageBody() roomId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.chatService.getRoomWithRelations({ id: roomId });
    client.leave(room.roomName);
    this.server
      .in(client.id)
      .emit(ROUTES_BASE.CHAT.CONFIRM_CHANNEL_DISCONNECTION, {
        channelId: room.id,
        channelName: room.channelName,
      });
  }

  /** GET ATTACHED USERS IN CHANNEL */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.ATTACHED_USERS_LIST_REQUEST)
  async attachedUsersList(@MessageBody() roomId: number) {
    const room = await this.chatService.getRoomWithRelations({ id: roomId });

    const attachedUsers = await this.chatService.getAttachedUsersInChannel(
      roomId,
    );

    this.server
      .in(room.roomName)
      .emit(ROUTES_BASE.CHAT.ATTACHED_USERS_LIST_CONFIRMATION, attachedUsers);
  }

  /*MESSAGE LISTENER */
  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.SEND_MESSAGE)
  async messageListener(
    @MessageBody() data: { message: string; channelId: number },
    @UserPayload() payload: any,
  ) {
    if (data.message === '') return;
    const room = await this.chatService.getRoomWithRelations(
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

    const messageForFront: Message = {
      id: newMessage.id,
      author: this.userService.getFrontUsername(newMessage.author),
      time: newMessage.createdAt,
      content: newMessage.content,
    };
    if (room)
      this.server
        .in(room.roomName)
        .emit(ROUTES_BASE.CHAT.RECEIVE_MESSAGE, messageForFront);
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.SET_ADMIN_REQUEST)
  async setAdmin(
    @MessageBody() data: ActionOnUser,
    @UserPayload() payload: any,
  ) {
    if (data.userIdToUpdate === payload.userId)
      throw new BadRequestException('You cannot update yourself');

    const newAdmin = await this.userService.getById(data.userIdToUpdate);

    if (!newAdmin)
      throw new BadRequestException(
        'The user you want to set as admin does not exist',
      );

    const room = await this.chatService.getRoomWithRelations(
      { channelName: data.channelName },
      { owner: true, admins: true },
    );

    if (!room) throw new BadRequestException('Channel does not exist');

    if (room.owner.id !== payload.userId)
      throw new ForbiddenException(
        'You do not have the rights to set an admin',
      );

    this.chatService.setAdmin(room, newAdmin);

    const promotedUser: UserInterface = {
      id: newAdmin.id,
      pongUsername: newAdmin.pongUsername,
    };
    this.server
      .in(room.roomName)
      .emit(ROUTES_BASE.CHAT.SET_ADMIN_CONFIRMATION, promotedUser);
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.UNSET_ADMIN_REQUEST)
  async unsetAdmin(
    @MessageBody() data: ActionOnUser,
    @UserPayload() payload: any,
  ) {
    if (data.userIdToUpdate === payload.userId)
      throw new BadRequestException('You cannot update yourself');

    const oldAdmin = await this.userService.getById(data.userIdToUpdate);

    if (!oldAdmin)
      throw new BadRequestException(
        'The user you want to unset as admin does not exist',
      );

    const room = await this.chatService.getRoomWithRelations(
      { channelName: data.channelName },
      { owner: true, admins: true },
    );
    if (!room) throw new BadRequestException('Channel does not exist');

    if (room.owner.id !== payload.userId)
      throw new ForbiddenException(
        'You do not have the rights to unset an admin',
      );

    this.chatService.unsetAdmin(room, oldAdmin);

    const demotedUser: UserInterface = {
      id: oldAdmin.id,
      pongUsername: oldAdmin.pongUsername,
    };

    this.server
      .in(data.channelName)
      .emit(ROUTES_BASE.CHAT.UNSET_ADMIN_CONFIRMATION, demotedUser);
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage(ROUTES_BASE.CHAT.USER_PRIVILEGES_REQUEST)
  async getUserPrivileges(
    @MessageBody() data: RoomId,
    @UserPayload() payload: any,
  ) {
    const room = await this.chatService.getRoomWithRelations(
      { id: data.roomId },
      { owner: true, admins: true, members: true },
    );

    if (!room) throw new BadRequestException('Channel does not exist');

    const privilege = await this.chatService.getUserPrivileges(
      room,
      payload.userId,
    );

    this.server.emit(ROUTES_BASE.CHAT.USER_PRIVILEGES_CONFIRMATION, privilege);
  }
}
