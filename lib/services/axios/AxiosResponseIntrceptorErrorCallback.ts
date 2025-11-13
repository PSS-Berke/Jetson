import type { AxiosError } from "axios";
import { logout as apiLogout } from "@/lib/api";

const unauthorizedCode = [401, 419, 440];

const AxiosResponseIntrceptorErrorCallback = (error: AxiosError) => {
  const { response } = error;

  if (response && unauthorizedCode.includes(response.status)) {
    apiLogout();
    window.location.href = "/login?error=unauthorized";
  }
};

export default AxiosResponseIntrceptorErrorCallback;
