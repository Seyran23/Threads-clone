import { ThreadRings } from './thread-rings';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <ThreadRings />
      <main>{children}</main>
    </div>
  );
}
