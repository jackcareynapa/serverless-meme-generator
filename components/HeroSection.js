/**
 * Landing: product name, positioning, and stack labels for portfolio review.
 */
export function HeroSection() {
  return (
    <header className="hero-in mb-12 text-center sm:mb-16">
      <p className="mb-3 inline-flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-amber-200/90 sm:text-xs">
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">Next.js</span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">Vercel</span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">S3</span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">Lambda</span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">OpenAI</span>
      </p>
      <h1 className="mb-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
        <span className="bg-gradient-to-r from-rose-200 via-amber-200 to-cyan-200 bg-clip-text text-transparent">
          Meme Studio
        </span>
      </h1>
      <p className="mx-auto max-w-2xl text-balance text-base leading-relaxed text-slate-200/95 sm:text-lg">
        Turn a photo into three share-ready memes. Describe the joke, pick a tone, and let the app pair your image
        with fresh captions—generated on the server, rendered in AWS Lambda, delivered without a long-lived backend.
      </p>
    </header>
  );
}
