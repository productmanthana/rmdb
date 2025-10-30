export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 glass px-4 py-3 rounded-2xl w-fit" data-testid="typing-indicator">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span className="text-sm text-white/70 ml-1">AI is thinking...</span>
    </div>
  );
}
