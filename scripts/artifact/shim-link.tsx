import { navigate } from './shim-navigation';
const ROUTES = ['/', '/signin', '/onboarding', '/plan'];
export default function Link({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const known = ROUTES.includes(href.split('?')[0]);
  return (
    <a href="#" {...rest} onClick={(e) => { e.preventDefault(); if (known) navigate(href); }}
      style={known ? undefined : { opacity: 0.5, pointerEvents: 'none' }}>{children}</a>
  );
}
