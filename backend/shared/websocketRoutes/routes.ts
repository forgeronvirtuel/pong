export const ROUTES_BASE = {
  CHAT: {
    ENDPOINT: '/chat/',
    /** LOBBY */
    JOIN_CHANNEL_LOBBY_REQUEST: 'joinChannelLobbyRequest',
    LIST_ALL_CHANNELS: 'listAllChannels',
    /** CREATE CHANNEL */
    CREATE_CHANNEL_REQUEST: 'createChannelRequest',
    CONFIRM_CHANNEL_CREATION: 'confirmChannelCreation',
    /** JOIN CHANNEL */
    JOIN_CHANNE_REQUEST: 'joinChannelRequest',
    CONFIRM_CHANNEL_ENTRY: 'confirmChannelEntry',
    /** DISCONNECT FROM CHANNEL */
    DISCONNECT_FROM_CHANNEL_REQUEST: 'disconnectFromChannelRequest',
    CONFIRM_CHANNEL_DISCONNECTION: 'confirmChannelDisconnection',
    /** SEND MESSAGE */
    SEND_MESSAGE: 'sendMessage',
    RECEIVE_MESSAGE: 'receiveMessage',
  },
};
const generate_full_routes = (routes_base) => {
  let accumulator = {};
  for (const key_base_route in routes_base) {
    let { ENDPOINT, ...current_sub_routes } = routes_base[key_base_route];
    accumulator[key_base_route] = { ENDPOINT };
    for (const key_end_route in current_sub_routes) {
      accumulator[key_base_route][key_end_route] =
        ENDPOINT + current_sub_routes[key_end_route];
    }
  }
  return accumulator;
};
export const FULL_ROUTE = generate_full_routes(ROUTES_BASE);
