interface LogoProps {
  className?: string;
}

// Self-hosted (frontend/public/logo.png) rather than linked to the
// Cloudinary URL directly -- keeps the app working even if that account or
// URL ever changes, and avoids an external network dependency for
// something this central to every page.
export function Logo({ className = "h-8 w-8" }: LogoProps) {
  return <img src="/logo.png" alt="BidFlow" className={`${className} object-contain`} />;
}
