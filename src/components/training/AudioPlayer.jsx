import { Volume2 } from 'lucide-react'

export default function AudioPlayer({ url }) {
  if (!url) {
    return (
      <div className="bg-slate-800/50 border border-card-border rounded-lg p-4 text-center">
        <Volume2 className="w-5 h-5 text-slate-600 mx-auto mb-1" />
        <p className="text-xs text-slate-500">No recording available</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 border border-card-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Volume2 className="w-4 h-4 text-kanai-blue-light" />
        <span className="text-xs font-medium text-slate-300">Call Recording</span>
      </div>
      <audio controls className="w-full h-10" preload="metadata">
        <source src={url} />
        Your browser does not support audio playback.
      </audio>
    </div>
  )
}
