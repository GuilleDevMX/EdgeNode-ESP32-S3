interface SecurityConfig {
  current_pass: string;
  new_pass: string;
  confirm_pass: string;
  jwt_exp: string;
  allowlist_enabled: boolean;
  allowlist: string;
}

export type { SecurityConfig };