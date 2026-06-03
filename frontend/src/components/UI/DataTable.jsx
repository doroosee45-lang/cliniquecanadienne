import Spinner from './Spinner';

export default function DataTable({ columns, data, loading, emptyMessage = 'Aucun résultat.' }) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map(col => (
              <th key={col.key} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.length === 0
            ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-gray-400">
                  <div className="text-3xl mb-2">📭</div>
                  {emptyMessage}
                </td>
              </tr>
            )
            : data.map((row, i) => (
              <tr key={row._id || i} className="table-row">
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                    {col.render ? col.render(row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, total, limit, onPage }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
      <span>{total} résultat{total > 1 ? 's' : ''}</span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40 hover:bg-gray-50">‹</button>
        <span className="font-semibold text-gray-700">{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40 hover:bg-gray-50">›</button>
      </div>
    </div>
  );
}
