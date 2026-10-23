export interface PaginationMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  from: number | null;
  to: number | null;
}

export function paginationMeta(page: number, perPage: number, total: number, count: number): PaginationMeta {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = count === 0 ? null : (page - 1) * perPage + 1;
  return { currentPage: page, lastPage, perPage, total, from, to: from === null ? null : from + count - 1 };
}
