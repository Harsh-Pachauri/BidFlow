interface LogoProps {
  className?: string;
}

export function Logo({ className = "h-8 w-8" }: LogoProps) {
  return <img src="/logo.png" alt="BidFlow" className={`${className} object-contain`} />;
}
