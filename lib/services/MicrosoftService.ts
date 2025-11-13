import ApiService from "./ApiService";
import type { ExchangeMSCodeForTokenRequestPayload } from "@/types/microsoft";

export const apiExchangeMSCodeForToken = (
  data: ExchangeMSCodeForTokenRequestPayload,
) => {
  return ApiService.fetchDataWithAxios<{ message: string }>({
    url: "/api:jAlgvpTr/exchange_code",
    method: "post",
    data,
  });
};

