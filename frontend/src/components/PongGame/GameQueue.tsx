import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import Position from "/shared/interfaces/Position";
import GameRoom from "/shared/interfaces/GameRoom";
import { ROUTES_BASE } from "/shared/websocketRoutes/routes";
import myConfig from '../../myConfig';

const GameQueue = (
  {
    socket,
    upgradeStep,
    setGameRoom,
  }:
  {
    socket: Socket,
    upgradeStep: () => void,
    setGameRoom: any,
  }
) => {


  const handleGameUpdate = (gameRoom: GameRoom) => {
    setGameRoom(gameRoom)
    upgradeStep();
  };
  useEffect(() => {
    socket?.on(ROUTES_BASE.GAME.UPDATE_GAME, handleGameUpdate);
    return () => {
      socket?.off(ROUTES_BASE.GAME.UPDATE_GAME, handleGameUpdate);
    };
  }, [handleGameUpdate]);
  /** END GAME LOOP */

  return <div>
    GameQueue
  </div>
} 

export default GameQueue;