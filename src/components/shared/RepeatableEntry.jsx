import { Plus, Trash2 } from 'lucide-react'

export default function RepeatableEntry({ title, items, onAdd, onRemove, renderItem, emptyMessage }) {
  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-slate-500 text-sm italic">{emptyMessage || 'No entries yet. Click + to add one.'}</p>
      )}
      {items.map((item, index) => (
        <div key={item.id} className="bg-slate-800/50 border border-card-border rounded-lg p-4 relative">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-medium text-slate-400">#{index + 1}</span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="text-slate-500 hover:text-accent-red transition-colors p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          {renderItem(item)}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 w-full justify-center py-2.5 rounded-lg border-2 border-dashed border-card-border text-slate-400 hover:border-kanai-blue hover:text-kanai-blue-light transition-colors text-sm"
      >
        <Plus className="w-4 h-4" />
        Add {title}
      </button>
    </div>
  )
}
