interface User {
  id: number;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  last_login: string;
}

export type { User };