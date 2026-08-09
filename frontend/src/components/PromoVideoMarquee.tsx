import React from 'react';

// Videos are served from /public/videos. Add your .mp4 filenames here when added.
const PROMO_VIDEOS: string[] = [
  '/videos/Create_a_premium_cinematic_pro.mp4',
  '/videos/Create_a_premium_cinematic_pro%20(1).mp4',
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
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  ref={(el) => { if (el) el.muted = true; }}
                >
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