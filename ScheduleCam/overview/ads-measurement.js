(() => {
  const tagId = 'AW-18323894522';
  const conversionDestination = tagId + '/roMNCO_9g7odEPrhwaFE';
  const consentKey = 'schedulecam-ads-measurement';
  const banner = document.querySelector('#ads-measurement');
  const settings = document.querySelector('#ads-measurement-settings');
  const denied = {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  };

  let consent;
  try {
    consent = window.localStorage.getItem(consentKey);
  } catch {
    // A browser that blocks storage can still use a choice for this page.
  }

  let tagStarted = false;
  function startTag() {
    if (tagStarted) return;
    tagStarted = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', denied);
    window.gtag('consent', 'update', { ...denied, ad_storage: 'granted', ad_user_data: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', tagId, { allow_ad_personalization_signals: false });

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + tagId;
    document.head.append(script);
  }

  banner.addEventListener('click', (event) => {
    const choice = event.target.closest('button[data-ads-consent]')?.dataset.adsConsent;
    if (!choice) return;
    consent = choice;
    let saved = false;
    try {
      window.localStorage.setItem(consentKey, choice);
      saved = true;
    } catch {
      // Keep the in-memory choice when storage is unavailable.
    }
    banner.hidden = true;
    if (choice === 'granted') {
      startTag();
    } else if (tagStarted) {
      window.gtag('consent', 'update', denied);
      if (saved) window.location.reload();
    }
    if (settings.getAttribute('aria-expanded') === 'true') settings.focus();
    settings.setAttribute('aria-expanded', 'false');
  });

  settings.addEventListener('click', () => {
    banner.hidden = false;
    settings.setAttribute('aria-expanded', 'true');
    banner.querySelector('h2').focus();
  });
  settings.hidden = false;
  banner.hidden = consent === 'granted' || consent === 'denied';
  if (consent === 'granted') startTag();

  function trackPlayClick(event) {
    const link = event.target.closest('a[data-ads-play-link]');
    if (!link || consent !== 'granted' || event.defaultPrevented) return;

    const params = { send_to: conversionDestination };
    if (event.type === 'click' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      let navigated = false;
      function openPlay() {
        if (navigated) return;
        navigated = true;
        window.clearTimeout(timeout);
        window.location.assign(link.href);
      }
      const timeout = window.setTimeout(openPlay, 700);
      params.event_callback = openPlay;
      params.event_timeout = 700;
    }
    window.gtag('event', 'conversion', params);
  }

  document.addEventListener('click', trackPlayClick);
  document.addEventListener('auxclick', (event) => {
    if (event.button === 1) trackPlayClick(event);
  });
})();
