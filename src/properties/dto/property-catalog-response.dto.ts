export interface PropertyCatalogItemDto {
  id: string;
  title: string;
  municipality: string;
  department: string;
  category: string;
  pricePerDay: string;
  images: string[];
}

export interface PropertyCatalogResponseDto {
  data: PropertyCatalogItemDto[];
  total: number;
  page: number;
  pageSize: number;
}
