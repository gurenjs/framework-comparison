export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Author {
  id: number;
  name: string;
}

export interface PostSummary {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  author: Author;
}

export interface Comment {
  id: number;
  body: string;
  createdAt: string;
  author: Author;
}

export interface PostDetail extends PostSummary {
  comments: Comment[];
}

export interface Pagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export type FieldErrors = Record<string, string[] | undefined>;
