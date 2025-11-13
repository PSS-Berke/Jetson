import ApiService from "./ApiService";
import type {
  CompanyRequestPayload,
  ExchangeMSCodeForTokenRequestPayload,
  MicrosoftCompany,
} from "@/types/microsoft";

export const apiExchangeMSCodeForToken = (
  data: ExchangeMSCodeForTokenRequestPayload,
) => {
  return ApiService.fetchDataWithAxios<{ message: string }>({
    url: "/api:jAlgvpTr/exchange_code",
    method: "post",
    data,
  });
};

export const apiGetCompanies = () => {
  return ApiService.fetchDataWithAxios<MicrosoftCompany[]>({
    url: "/api:AZZYF_3C/companies",
    method: "get",
  });
};

export const apiUpdateCompany = (
  id: number,
  data: Partial<CompanyRequestPayload>,
) => {
  return ApiService.fetchDataWithAxios<{ message: string }>({
    url: `/api:AZZYF_3C/companies/${id}`,
    method: "patch",
    data,
  });
};

export const apiDeleteCompany = (id: number) => {
  return ApiService.fetchDataWithAxios<{ message: string }>({
    url: `/api:AZZYF_3C/companies/${id}`,
    method: "delete",
  });
};

