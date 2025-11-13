import AxiosBase from "./axios/AxiosBase";
import type { AxiosRequestConfig, AxiosResponse, AxiosError } from "axios";

const ApiService = {
  fetchDataWithAxios<Response = unknown, Request = Record<string, unknown>>(
    param: AxiosRequestConfig<Request>,
  ) {
    return new Promise<Response>((resolve, reject) => {
      AxiosBase(param)
        .then((response: AxiosResponse<Response>) => {
          resolve(response.data);
        })
        .catch((error: AxiosError) => {
          let message = "An unknown error occurred";
          if (error.response && error.response.data) {
            const data = error.response.data as Record<string, unknown>;
            if (typeof data.message === "string") {
              message = data.message;
            } else if (typeof data.error === "string") {
              message = data.error;
            } else {
              message = JSON.stringify(data);
            }
          } else if (error.message) {
            message = error.message;
          }
          reject({ ...error, message });
        });
    });
  },
};

export default ApiService;
