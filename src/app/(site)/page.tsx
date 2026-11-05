import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Gavel, Handshake, MessageSquare, ShieldCheck, Sprout } from "lucide-react";
import { HarvestHero } from "@/components/landing/harvest-hero";
import { AuctionsPreview, CategoryGrid, FeaturedProducts } from "@/components/landing/live-sections";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const QUESTIONS = [
  { q: "How do I start selling my produce?", a: "Create a farmer account, add your location and contact details, and publish a listing with your quantity, photos and asking price. Buyers can then message you or make an offer." },
  { q: "Can I negotiate the listed price?", a: "Yes. A listing shows the farmer’s asking price. Buyers can start a private conversation and send an offer with a quantity, price and terms. Either side can counter until you agree." },
  { q: "How does an auction work?", a: "A farmer reserves a quantity from a listing and sets a starting price, minimum increment and closing time. The highest valid bid wins if it meets any reserve price. All bids are checked against the server clock." },
  { q: "Who arranges payment and delivery?", a: "You do. When an offer is accepted or an auction is won, an agreement is recorded and the parties can view each other’s contact details. Payment, inspection, transport and delivery are arranged directly. FarmConnect does not handle money." },
  { q: "When is a trade marked complete?", a: "An agreement records the agreed price and quantity. The trade is marked completed when both parties confirm fulfilment, or an administrator records a resolution." },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <HarvestHero />
      <ScrollReveal><div className="market-principles"><div className="site-container"><span><Sprout /> Direct from growers</span><span><MessageSquare /> Real conversations</span><span><Gavel /> Transparent bidding</span><span><Handshake /> Trade on your terms</span></div></div></ScrollReveal>
      <ScrollReveal><section id="discover" className="landing-section site-container scroll-mt-24">
        <div className="section-heading"><div><p className="eyebrow">A MARKETPLACE ROOTED IN POSSIBILITY</p><h2>Find your next <em>good thing.</em></h2></div><p className="section-intro">From everyday staples to the season’s harvest.<br />Discover produce, and the people behind it.</p></div>
        <CategoryGrid />
      </section></ScrollReveal>
      <ScrollReveal><section className="produce-section"><div className="landing-section site-container">
        <div className="section-heading"><div><p className="eyebrow">FRESH OPPORTUNITIES</p><h2>From the farm.<br className="sm:hidden" /> <em>To your business.</em></h2></div><Link href="/marketplace" className="text-action">Browse all produce <ArrowRight /></Link></div>
        <FeaturedProducts /><p className="section-note">Listings come directly from farmers. Speak with the grower about quality, inspection and availability.</p>
      </div></section></ScrollReveal>
      <ScrollReveal><section id="how-it-works" className="landing-section site-container scroll-mt-24"><div className="how-layout">
        <div className="grower-photo"><Image src="/images/farmer-sunset.webp" alt="A farmer walking across a field at sunset" fill sizes="(max-width: 800px) 100vw, 45vw" /><div className="grower-photo-shade" /><div className="grower-photo-note"><Sprout /><p>Every harvest has a story.<br /><em>Start a conversation.</em></p></div><span className="photo-label">THE WORK BEHIND THE HARVEST</span></div>
        <div className="how-copy"><p className="eyebrow">LESS DISTANCE. MORE CONNECTION.</p><h2>Good trade starts<br />with <em>common ground.</em></h2><p className="section-intro">A straightforward way to find produce, agree a price, and build your next trading relationship.</p>
          <ol className="trade-steps">{[
            ["01", "Discover what’s growing", "Browse by crop, location, quality and quantity. Find produce that fits what you’re looking for."],
            ["02", "Talk. Negotiate. Agree.", "Message the farmer, exchange offers, or take part in a time-limited auction. You decide your terms."],
            ["03", "Make the connection", "An accepted offer or auction win records your agreement. Connect directly to arrange payment and delivery."],
          ].map(([n, title, body]) => <li key={n}><span>{n}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
          <Link href="/help" className="text-action">A little more about how it works <ArrowRight /></Link>
        </div>
      </div></section></ScrollReveal>
      <ScrollReveal><section className="auction-section"><div className="landing-section site-container"><div className="section-heading"><div><p className="eyebrow"><span className="live-dot" /> THE NEXT OPPORTUNITY IS OPEN</p><h2>A fair chance.<br className="sm:hidden" /> <em>An open auction.</em></h2></div><Link href="/auctions" className="text-action">Explore auctions <ArrowRight /></Link></div><AuctionsPreview /><p className="section-note">Clear quantities. Published increments. Bids checked on the server.</p></div></section></ScrollReveal>
      <ScrollReveal><section className="landing-section site-container">
        <div className="field-stories-heading"><p className="eyebrow">CONNECTED TO THE LAND</p><h2>Many crops. <em>One connection.</em></h2><p className="section-intro">Explore the fields behind the produce. Find your next conversation in the marketplace.</p></div>
        <div className="field-stories">{[
          { image: "rice-planting", title: "The everyday essentials", tag: "PADDY & RICE", query: "rice" },
          { image: "chilli-harvest", title: "A little more character", tag: "CHILLIES & SPICES", query: "chillies" },
          { image: "maize", title: "Golden opportunities", tag: "MAIZE & CEREALS", query: "maize" },
          { image: "harvest", title: "Fresh from the soil", tag: "VEGETABLES & MORE", query: "vegetables" },
        ].map((story) => <Link key={story.image} href={`/marketplace?q=${story.query}`} className="field-story"><Image src={`/images/${story.image}.webp`} alt={story.tag.toLowerCase() + " growing in a field"} fill sizes="(max-width: 640px) 90vw, 33vw" /><div className="story-shade" /><div className="story-copy"><span>{story.tag}</span><h3>{story.title}</h3><p>Explore produce <ArrowRight /></p></div></Link>)}</div>
      </section></ScrollReveal>
      <ScrollReveal><section className="trust-section site-container"><div className="trust-heading"><ShieldCheck /><p className="eyebrow">BUILT FOR A CLEARER TRADE</p><h2>Confidence in<br /><em>every connection.</em></h2></div><div className="trust-items">{[
        { icon: BadgeCheck, title: "Verification with meaning", body: "Farmer badges appear after an administrator reviews a verification request." },
        { icon: ShieldCheck, title: "Your details stay private", body: "Contact details are shared with your trading counterparty through an agreement. Administrators also have access for account support." },
        { icon: Handshake, title: "Agreed terms. A clear record.", body: "Accepted offers and auction wins record the quantity and price. Both parties confirm when fulfilment is complete." },
      ].map(({ icon: Icon, title, body }) => <div key={title}><Icon /><h3>{title}</h3><p>{body}</p></div>)}</div></section></ScrollReveal>
      <ScrollReveal><section className="landing-section site-container faq-layout"><div><p className="eyebrow">A FEW THINGS YOU MIGHT ASK</p><h2>Let’s make<br /><em>things clear.</em></h2><Link href="/help" className="text-action">Visit the help centre <ArrowRight /></Link></div><div className="landing-faq">{QUESTIONS.map((item, i) => <details key={item.q} name="farmconnect-faq"><summary><span className="faq-number">0{i + 1}</span>{item.q}<span className="faq-plus">+</span></summary><p>{item.a}</p></details>)}</div></section></ScrollReveal>
      <ScrollReveal><section className="site-container landing-final-wrap"><div className="landing-final"><Image src="/images/cotton.webp" alt="Cotton fields at sunset" fill sizes="100vw" /><div className="final-shade" /><div className="final-content"><p className="eyebrow">GROW YOUR NEXT CONNECTION</p><h2>A new way forward.<br /><em>For everyone in the field.</em></h2><p>Whether you grow it or source it, your next opportunity starts here.</p><div><Link href="/register?role=farmer" className="hero-primary">I’m here to sell <ArrowRight /></Link><Link href="/register?role=buyer" className="hero-secondary">I’m here to buy <ArrowRight /></Link></div></div></div></section></ScrollReveal>
    </div>
  );
}
