"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight, Pause, Play, Sprout } from "lucide-react";
import { HeroSearch } from "./hero-search";

const SLIDES = [
  { image: "paddy", alt: "Golden paddy ripening in the sunlight", label: "Paddy & rice", note: "Good trade starts with a good harvest.", position: "center" },
  { image: "planting", alt: "Farm workers planting young rice in a flooded field", label: "Rooted in the land", note: "Behind every harvest, there is a grower.", position: "center 62%" },
  { image: "maize", alt: "Golden maize growing in a sunlit field", label: "Maize & cereals", note: "From the field to your next opportunity.", position: "center 45%" },
  { image: "chilli-harvest", alt: "A farmer harvesting red chillies", label: "Chillies & spices", note: "Discover what is growing beyond your market.", position: "center 38%" },
  { image: "farmer-sunset", alt: "A farmer walking through a field at sunset", label: "More from the farm", note: "A new season. A more direct connection.", position: "center 40%" },
] as const;

export function HarvestHero() {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [interacting, setInteracting] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReducedMotion(media.matches);
    const visibility = () => setVisible(!document.hidden);
    motion(); visibility();
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => { media.removeEventListener("change", motion); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  const playing = !paused && !interacting && !reducedMotion && visible;
  React.useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % SLIDES.length), 6500);
    return () => window.clearInterval(timer);
  }, [playing, active]);
  const move = (direction: number) => setActive((i) => (i + direction + SLIDES.length) % SLIDES.length);
  return (
    <section className="harvest-hero" aria-label="Welcome to FarmConnect">
      <div className="hero-photographs" aria-hidden="true">{SLIDES.map((slide, i) => <div key={slide.image} className={`hero-photograph ${i === active ? "is-active" : ""}`}><Image src={`/images/${slide.image}.webp`} alt="" fill sizes="100vw" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} style={{ objectFit: "cover", objectPosition: slide.position }} /></div>)}</div>
      <div className="hero-shade" />
      <div className="hero-content site-container">
        <div className="hero-eyebrow"><span /> GROWN WITH CARE. TRADED DIRECTLY.</div>
        <h1>A better connection.<br />A <em>better harvest.</em></h1>
        <p className="hero-description">The people who grow it. The people who need it.<br className="hidden sm:block" /> One place to meet, negotiate, and trade.</p>
        <HeroSearch />
        <div className="hero-actions"><Link href="/register?role=farmer" className="hero-primary">Start selling <ArrowRight className="size-4" /></Link><Link href="/marketplace" className="hero-secondary">Explore the marketplace <ArrowRight className="size-4" /></Link></div>
        <p className="hero-footnote"><Sprout className="size-4" /> Your produce. Your price. Your conversation.</p>
      </div>
      <div className="hero-bottom site-container">
        <a href="#discover" className="hero-scroll"><ArrowDown className="size-4" /><span>Take a look around</span></a>
        <div className="hero-slide-panel" role="region" aria-roledescription="carousel" aria-label="Farm photography" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocusCapture={() => setInteracting(true)} onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setInteracting(false); }}>
          <div className="slide-caption" aria-live={playing ? "off" : "polite"}><span className="slide-number">0{active + 1}<span> / 0{SLIDES.length}</span></span><div><p>{SLIDES[active].label}</p><span>{SLIDES[active].note}</span></div></div>
          <div className="slide-controls"><button type="button" onClick={() => move(-1)} aria-label="Previous photograph"><ChevronLeft className="size-4" /></button><button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused || reducedMotion ? "Play slideshow" : "Pause slideshow"} disabled={reducedMotion} title={reducedMotion ? "Automatic motion is disabled by your device preference" : undefined}>{paused || reducedMotion ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}</button><button type="button" onClick={() => move(1)} aria-label="Next photograph"><ChevronRight className="size-4" /></button></div>
          <div className="slide-dots">{SLIDES.map((slide, i) => <button key={slide.image} type="button" aria-label={`Show ${slide.alt}`} aria-current={i === active ? "true" : undefined} onClick={() => setActive(i)}><span className={i === active ? "active" : ""} /></button>)}</div>
        </div>
      </div>
    </section>
  );
}

