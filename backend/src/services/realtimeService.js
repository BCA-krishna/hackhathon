let io = null;

function setIo(instance) {
  io = instance;
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(String(userId)).emit(event, payload);
}

function registerSocketHandlers(socketServer) {
  socketServer.on('connection', (socket) => {
    socket.on('join', (userId) => {
      if (userId) {
        socket.join(String(userId));
      }
    });
  });
}

module.exports = { setIo, emitToUser, registerSocketHandlers };
