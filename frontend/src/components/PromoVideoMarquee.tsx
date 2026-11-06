import React from 'react';

// Videos are served from /public/videos
const PROMO_VIDEOS: string[] = [
  '/videos/Create_a_premium_cinematic_pro.mp4',
  '/videos/Create_a_premium_cinematic_pro_1.mp4',
  '/videos/hero-bg.mp4',
];

const PromoVideoMarquee: React.FC = () => {
  if (PROMO_VIDEOS.length === 0) return null;
  // Duplicate the list twice so the translate animation loops seamlessly.
  const strip: string[] = [...PROMO_VIDEOS, ...PROMO_VIDEOS];

  return (
    <section className="promo-marquee reveal">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">Featured</span>
          <h2>See Nexora in motion</h2>
          <p>A closer look at how the system works end to end.</p>
        </div>
        <div className="promo-track-viewport">
          <div className="promo-track">
            {strip.map((src, i) => (
              <div className="promo-card" key={`${src}-${i}`}>
                <video
                  src={src}
                  poster="/videos/hero-poster.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  ref={(el) => {
                    if (el) {
                      el.muted = true;
                      el.play().catch(() => {});
                    }
                  }}
                >
                  <source src={src} type="video/mp4" />
                  Your browser does not support embedded videos.
                </video>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromoVideoMarquee;
