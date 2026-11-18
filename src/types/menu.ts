export interface MenuItem {
  id: number;
  name: string;
  price: number;
  description: string;
}

export interface MenuApiError {
  error: string;
}