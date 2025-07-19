type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children, className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`bg-gradient-to-br from-zinc-700 to-zinc-600 hover:from-zinc-500 hover:to-zinc-400 text-white font-semibold py-2 px-5 rounded-xl shadow-md transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
