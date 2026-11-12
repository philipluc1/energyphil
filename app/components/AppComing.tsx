import Icon from "./Icon";
import s from "./appcoming.module.css";

/**
 * Apps coming (12 Nov 2026, Phil). Plain buttons, not the store badges (those
 * are Apple's and Google's; use them only once the apps are live). Until then,
 * Utilo already adds to a phone's home screen like an app.
 */
export default function AppComing() {
  return (
    <section className={s.wrap} aria-labelledby="app-h" data-motion="">
      <div className={s.text}>
        <span className={s.kicker}><Icon name="phone" size={14} /> Coming soon</span>
        <h2 id="app-h" className={s.h2}>Utilo apps for iPhone and Android</h2>
        <p className={s.lede}>Snap a bill and get alerts straight from your phone. Until the apps are out, add Utilo to your home screen and it works just like one.</p>
        <ul className={s.how}>
          <li><b>iPhone:</b> open utilo.com.au in Safari, tap Share, then Add to Home Screen.</li>
          <li><b>Android:</b> open it in Chrome, tap the ⋮ menu, then Install app.</li>
        </ul>
      </div>
      <div className={s.badges} aria-label="Apps coming soon">
        <span className={s.badge}><Icon name="phone" size={20} /><span><small>Coming soon for</small>iPhone</span></span>
        <span className={s.badge}><Icon name="phone" size={20} /><span><small>Coming soon for</small>Android</span></span>
      </div>
    </section>
  );
}
