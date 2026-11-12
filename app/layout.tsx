import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ComfyNode Sentinel - ComfyUI Node Manager & Studio',
  description: 'Desktop companion and custom node manager for ComfyUI with offline inspector, Torch Shield, lockfile diffing, health doctor, and issue exporter.',
  openGraph: {
    title: 'ComfyNode Sentinel - ComfyUI Node Manager & Studio',
    description: 'Desktop companion and custom node manager for ComfyUI with offline inspector, Torch Shield, lockfile diffing, health doctor, and issue exporter.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ComfyNode Sentinel - ComfyUI Node Manager & Studio',
    description: 'Desktop companion and custom node manager for ComfyUI with offline inspector, Torch Shield, lockfile diffing, health doctor, and issue exporter.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0b0f17] text-slate-100 font-sans antialiased selection:bg-indigo-500/20 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
