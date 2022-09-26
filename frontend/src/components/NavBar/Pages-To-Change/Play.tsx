import { useEffect, useState } from 'react'
import io, { Socket } from "socket.io-client";
import GameCanvas from '/src/components/PongGame/GameCanvas'
import GameLobby from '/src/components/PongGame/GameLobby';
import GameOver from '/src/components/PongGame/GameOver';
import GameQueue from '/src/components/PongGame/GameQueue';
import GameRoom from "/shared/interfaces/GameRoom";
import { ROUTES_BASE } from "/shared/websocketRoutes/routes";


const Play = () => {
  const [step, setStep] = useState<number>(0);

  /** WEBSOCKET */
  const [socket, setSocket] = useState<Socket>();
  const [gameRoom, setGameRoom] = useState<GameRoom | undefined>(undefined)


  useEffect(() => {
    const newSocket = io(myConfig.domain, {
      transports: ["websocket"],
      withCredentials: true,
    });
    setSocket(newSocket);
  }, []);

  const handleGameConfirm = (gameRoom: GameRoom) => {
    // if (gameRoom.started === true) {
    //   const canvas = canvasRef.current
    //   draw(canvas, gameRoom)
    // }
    setGameRoom(gameRoom)
  };
  /** GAME CREATION */
  useEffect(() => {
    socket?.on(ROUTES_BASE.GAME.CONFIRM_GAME_JOINED, handleGameConfirm);
    return () => {
      socket?.off(ROUTES_BASE.GAME.CONFIRM_GAME_JOINED, handleGameConfirm);
    };
  }, [handleGameConfirm]);

  const upgradeStep = () => {
    setStep(step + 1);
  }

  const gameSteps = [
    <GameLobby socket={socket} upgradeStep={upgradeStep} />,
    <GameQueue
      socket={socket}
      upgradeStep={upgradeStep}
      setGameRoom={setGameRoom}
    />,
    <GameCanvas
      socket={socket}
      setGameRoom={setGameRoom}
      upgradeStep={upgradeStep}
      gameRoom={gameRoom}
    />,
    <GameOver/>,
  ];

  return (
    <>
      <h1 className='text-violet-600'>I'm Play page</h1>
      {gameSteps[step]}
    </>
  )
}

export default Play