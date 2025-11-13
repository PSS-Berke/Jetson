import axios from "axios";
import AxiosResponseIntrceptorErrorCallback from "./AxiosResponseIntrceptorErrorCallback";
import AxiosRequestIntrceptorConfigCallback from "./AxiosRequestIntrceptorConfigCallback";
import type { AxiosError } from "axios";
const BASE_URL = "https://xnpm-iauo-ef2d.n7e.xano.io/";
const AxiosBase = axios.create({
  timeout: 60000,
  baseURL: BASE_URL,
});

AxiosBase.interceptors.request.use(
  (config) => {
    return AxiosRequestIntrceptorConfigCallback(config);
  },
  (error) => {
    return Promise.reject(error);
  },
);

AxiosBase.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    AxiosResponseIntrceptorErrorCallback(error);
    return Promise.reject(error);
  },
);

export default AxiosBase;
