export interface Document {
  id: string;
  name: string;
  originalFileName: string;
  contentType: string;
  size: string;
  uploadDate: string;
  status: "uploading" | "processing" | "indexed" | "error" | "pending_indexing" | "failed";
  content?: string;
  url?: string;
  errorMessage?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}