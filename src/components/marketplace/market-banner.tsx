import Image from "next/image";

export function MarketBanner({ title, subtitle, image, eyebrow }: { title: string; subtitle: string; image: string; eyebrow: string }) {
  return <div className="market-page-banner"><Image src={`/images/${image}.webp`} alt="" fill sizes="100vw" loading="eager" /><div className="market-banner-shade" /><div className="site-container"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div></div>;
}

