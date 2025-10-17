export interface LoginRequest {
  cpf: string;
  password: string;
}

export interface LoginResponse {
  requiresTwoFactor: boolean;
  message: string;
}

export interface VerifyTwoFactorRequest {
  cpf: string;
  code: string;
}

export interface VerifyTwoFactorResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    cpf: string;
    nome: string;
    email: string;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}
