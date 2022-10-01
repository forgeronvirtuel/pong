import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import GameRoom from "/shared/interfaces/GameRoom";
import { ROUTES_BASE } from "/shared/websocketRoutes/routes";
import { GameStep } from "/src/components/PongGame/GameStep.enum";

const GameLobby = (
  {
    socket,
    setStep,
    setGameRoom,
  }:
  {
    socket: Socket,
    setStep: any,
    setGameRoom: any,
  }
) => {
  const [spectableGameList, setSpectableGameList] = useState<GameRoom[]>([])

  /** GAME JOIN */
  const handleJoinGame = () => {
    socket?.emit(ROUTES_BASE.GAME.JOIN_GAME_REQUEST);
    setStep(GameStep.QUEUE);
  }
  /** END GAME JOIN */

  const handleCreateGame = () => {
    socket?.emit(ROUTES_BASE.GAME.CREATE_GAME_REQUEST);
    setStep(GameStep.QUEUE);
  }

  /** SPECTATE */
  const handleSpectate = (roomName: string) => {
    socket?.emit(ROUTES_BASE.GAME.JOIN_SPECTATE_REQUEST, roomName);
    setStep(GameStep.QUEUE)
  }
  /** END SPECTACTE */
  
  /** UPDATE SPECTABLE GAMES */
  useEffect(() => {
    socket?.emit(ROUTES_BASE.GAME.GET_SPECTABLE_GAMES_REQUEST)
    socket?.on(ROUTES_BASE.GAME.UPDATE_SPECTABLE_GAMES, (spectableGameList: GameRoom[]) => {
      setSpectableGameList(spectableGameList);
    });
    return () => {
      socket?.off(ROUTES_BASE.GAME.UPDATE_SPECTABLE_GAMES, (spectableGameList: GameRoom[]) => {
        setSpectableGameList(spectableGameList);
      });
    };
  }, []);
  /** END UPDATE SPECTABLE GAMES */

  const updateStep = (gameRoom: GameRoom) => {
    if (gameRoom.started === true)
      setStep(GameStep.PLAYING);
    else
      setStep(GameStep.QUEUE);
    setGameRoom(gameRoom);
  }
  useEffect(() => {
    socket?.on(ROUTES_BASE.GAME.UPDATE_GAME, updateStep);
    return () => {
      socket?.off(ROUTES_BASE.GAME.UPDATE_GAME, updateStep);
    };
  }, []);

  return <div className="h-7/8 w-full grid content-around">
    <div className="flex justify-around">
      <button
        className="h-1/8 bg-sky-500 hover:bg-sky-700 lg:text-3xl rounded-3xl p-4 shadow-md shadow-blue-500/50 max-h-20"
        onClick={handleCreateGame}
      >Create game</button>
      <button
        className="h-1/8 bg-sky-500 hover:bg-sky-700 lg:text-3xl rounded-3xl p-4 shadow-md shadow-blue-500/50 max-h-20"
        onClick={handleJoinGame}
      >Join game</button>
    </div>

    <div className="grid justify-around">
      <h2 className="text-center">SPECTATE</h2>
      <div>
        {
          spectableGameList.map(gameRoom => 
            <div key={gameRoom.roomName}>
              <button 
                className="bg-sky-500 hover:bg-sky-700 rounded-3xl shadow-md shadow-blue-500/50"
                onClick={() => handleSpectate(gameRoom.roomName)}
              >{gameRoom.gameData.player1.pongUsername} VS {gameRoom.gameData.player1.pongUsername}</button>
            </div>
          )
        }
      </div>
    </div>
  </div>
} 

export default GameLobby;