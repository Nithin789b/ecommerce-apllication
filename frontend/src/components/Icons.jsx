export function LeafIcon({ className = '' }) {
  return (
    <svg className={'h-5 w-5 ' + className} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <path d="M25.9 5.1C17.4 5.3 9.2 7.8 6 14.7c-2.1 4.5.1 9.3 4.7 10.1 5.7 1 10.8-4.5 12.7-10.8-3.2 3.1-6.4 5.4-10.4 7.2 4.1-4.1 8.3-8.7 12.9-16.1Z" fill="currentColor" />
      <path d="M5.7 27.1c4.3-5.2 8.5-8.6 14-12.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ className = '' }) {
  return (
    <svg className={'h-5 w-5 ' + className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function BagIcon({ className = '' }) {
  return (
    <svg className={'h-5 w-5 ' + className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 8.5h14l1 12H4l1-12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function UserIcon({ className = '' }) {
  return (
    <svg className={'h-5 w-5 ' + className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.8 20c.8-3.4 3.4-5.2 7.2-5.2s6.4 1.8 7.2 5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon({ className = '' }) {
  return (
    <svg className={'h-5 w-5 ' + className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className = '' }) {
  return (
    <svg className={'h-5 w-5 ' + className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
