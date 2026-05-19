export function parsePaginationParams(searchParams: URLSearchParams) {
  const page = Number(searchParams.get('page') || searchParams.get('pageNumber') || 0) || 1;
  const per_page = Number(searchParams.get('per_page') || searchParams.get('perPage') || searchParams.get('limit') || 0) || 50;
  const date_from = searchParams.get('date_from') || searchParams.get('from') || null;
  const date_to = searchParams.get('date_to') || searchParams.get('to') || null;
  return { page, per_page, date_from, date_to };
}

export function normalizeUpstreamResponse(upstream: any, page: number, per_page: number) {
  if (upstream == null) return { total: 0, page, per_page, items: [] };

  // If upstream already provides items/data + total, use it
  const items = Array.isArray(upstream) ? upstream
    : upstream.items || upstream.data || upstream.records || upstream.transactions || null;

  if (items && Array.isArray(items)) {
    const total = typeof upstream.total === 'number' ? upstream.total : items.length;
    const upstreamPage = upstream.page || upstream.currentPage || upstream.pageNumber || page;
    const upstreamPer = upstream.per_page || upstream.perPage || upstream.limit || per_page;
    const respPage = upstream.page || upstream.currentPage || upstream.pageNumber ? upstreamPage : page;
    const respPer = upstream.per_page || upstream.perPage || upstream.limit ? upstreamPer : per_page;

    // If upstream likely handled pagination, respect its values
    if (upstream.page || upstream.per_page || upstream.total) {
      const has_more = (respPage * respPer) < total;
      const next = has_more ? respPage + 1 : null;
      const prev = respPage > 1 ? respPage - 1 : null;
      return { total, page: respPage || page, per_page: respPer || per_page, items, has_more, links: { next, prev } };
    }

    // Otherwise paginate locally
    const offset = (page - 1) * per_page;
    const pageItems = items.slice(offset, offset + per_page);
    const has_more = (page * per_page) < items.length;
    const next = has_more ? page + 1 : null;
    const prev = page > 1 ? page - 1 : null;
    return { total: items.length, page, per_page, items: pageItems, has_more, links: { next, prev } };
  }

  // If upstream is object with single record
  if (typeof upstream === 'object') {
    return { total: 1, page, per_page, items: [upstream] };
  }

  // Fallback: wrap primitive
  return { total: 1, page, per_page, items: [upstream] };
}
