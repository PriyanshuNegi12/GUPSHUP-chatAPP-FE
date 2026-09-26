export default function VartalaMark({ size = 44, className = '' }) {
  return (
    <img
      src="/logo.png"
      alt="Vartala logo"
      width={size}
      height={size}
      className={className}
    />
  );
}