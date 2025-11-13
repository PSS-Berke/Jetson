import type { InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

const AxiosRequestIntrceptorConfigCallback = (
  config: InternalAxiosRequestConfig,
) => {
  const storage: "localStorage" | "sessionStorage" | "cookies" = "cookies";
  const TOKEN_NAME_IN_STORAGE_KEY = "xano_auth_token";
  const REQUEST_HEADER_AUTH_KEY = "Authorization";
  const TOKEN_TYPE = "Bearer";
  if (storage === "cookies") {
    let accessToken = "";

    if (storage === "cookies") {
      accessToken = Cookies.get(TOKEN_NAME_IN_STORAGE_KEY) || "";
    }

    /* if (storage === 'sessionStorage') {
            accessToken = sessionStorage.getItem(TOKEN_NAME_IN_STORAGE_KEY) || ''
        }*/

    if (accessToken) {
      config.headers[REQUEST_HEADER_AUTH_KEY] = `${TOKEN_TYPE} ${accessToken}`;
    }
  }

  // Dynamically set X-Team-Id header from localStorage
  const teamId = localStorage.getItem("team_id");
  if (teamId) {
    config.headers["X-Team-Id"] = teamId;
  }

  return config;
};

export default AxiosRequestIntrceptorConfigCallback;
