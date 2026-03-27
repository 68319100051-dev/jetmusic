import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';

interface SectionProps {
  title: string;
  href: string;
  children: ReactNode;
}

export default function Section({ title, href, children }: SectionProps) {
  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <Link href={href} className="see-all">
          <span>ดูทั้งหมด</span>
          <ChevronRight size={16} />
        </Link>
      </div>
      {children}
    </section>
  );
}
