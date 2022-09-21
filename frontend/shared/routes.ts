//BEWARE, THIS IS A FAKE IMPORT TO EASE CODE RESOLUTION IN YOUR CODE EDITOR
// ONLY THE BACKEND VERSION OF THIS FLE WILL BE USED

export const ROUTES_BASE = {
  USER: {
    ENDPOINT: "/user/",
    SIGNOUT: "signout",
    SET_PICTURE: "set_picture",
    GET_PICTURE: "get_picture",
    ADD_FRIEND: "add_friend",
    GET_FRIEND_LIST: "get_friends_list",
    SET_NICKNAME: "set_pongUsername",
    GET_NICKNAME: "get_pongUsername",
    GET_USER_RANK: "get_user_rank",
    GET_USER_HISTORY: "get_user_history",
  },
  AUTH: {
    ENDPOINT: "/auth/42/",
    LOGOUT: "logout",
    REFRESH: "refresh",
    REDIRECT: "redirect",
  },
  ROOT: {
    ENDPOINT: "/",
    PROTECTED: "protected",
    REFRESH: "refresh",
    REDIRECT: "redirect",
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
