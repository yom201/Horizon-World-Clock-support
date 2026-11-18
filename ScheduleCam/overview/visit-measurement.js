(() => {
  const adsId = 'AW-18323894522';
  const analyticsId = 'G-JSWR4ZBJK9';
  const conversionDestination = adsId + '/roMNCO_9g7odEPrhwaFE';
  const adsKey = 'schedulecam-ads-measurement';
  const analyticsKey = 'schedulecam-web-analytics';
  const banner = document.querySelector('#ads-measurement');
  const settings = document.querySelector('#ads-measurement-settings');
  const adsOption = banner.querySelector('#allow-ad-measurement');
  const analyticsOption = banner.querySelector('#allow-visit-measurement');
  const denied = {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  };

  function readChoice(key) {
    try {
      const value = window.localStorage.getItem(key);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch {
      return null;
    }
  }

  let adsConsent = readChoice(adsKey);
  let analyticsConsent = readChoice(analyticsKey);
  let tagStarted = false;
  let adsConfigured = false;
  let analyticsConfigured = false;
  let visitSent = false;

  function isGoogleAdsArrival() {
    const query = new URLSearchParams(window.location.search);
    const hasClickId = ['gclid', 'gbraid', 'wbraid']
      .some((key) => Boolean(query.get(key)?.trim()));
    const source = query.get('utm_source')?.toLowerCase();
    const medium = query.get('utm_medium')?.toLowerCase();
    return hasClickId || (source === 'google' && ['cpc', 'ppc', 'display'].includes(medium));
  }

  function updateTags() {
    const allowAds = adsConsent === 'granted';
    const allowAnalytics = analyticsConsent === 'granted';
    if (!tagStarted && !allowAds && !allowAnalytics) return;

    const firstTag = !tagStarted;
    if (firstTag) {
      tagStarted = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      window.gtag('consent', 'default', denied);
    }
    window['ga-disable-' + analyticsId] = !allowAnalytics;
    window.gtag('consent', 'update', {
      ...denied,
      ad_storage: allowAds ? 'granted' : 'denied',
      ad_user_data: allowAds ? 'granted' : 'denied',
      analytics_storage: allowAnalytics ? 'granted' : 'denied'
    });
    if (firstTag) window.gtag('js', new Date());

    if (allowAds && !adsConfigured) {
      adsConfigured = true;
      window.gtag('config', adsId, { allow_ad_personalization_signals: false });
    }
    if (allowAnalytics && !analyticsConfigured) {
      analyticsConfigured = true;
      window.gtag('config', analyticsId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
    }
    if (allowAnalytics && !visitSent) {
      visitSent = true;
      window.gtag('event', 'page_view', { send_to: analyticsId });
      if (isGoogleAdsArrival()) {
        window.gtag('event', 'google_ads_lp_visit', { send_to: analyticsId });
      }
    }
    if (firstTag) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + (allowAds ? adsId : analyticsId);
      document.head.append(script);
    }
  }

  banner.addEventListener('click', (event) => {
    const action = event.target.closest('button[data-measurement-choice]')?.dataset.measurementChoice;
    if (action !== 'save' && action !== 'decline') return;
    const nextAds = action === 'save' && adsOption.checked ? 'granted' : 'denied';
    const nextAnalytics = action === 'save' && analyticsOption.checked ? 'granted' : 'denied';
    const withdrew = (adsConsent === 'granted' && nextAds === 'denied')
      || (analyticsConsent === 'granted' && nextAnalytics === 'denied');
    adsConsent = nextAds;
    analyticsConsent = nextAnalytics;
    let saved = false;
    try {
      window.localStorage.setItem(adsKey, adsConsent);
      window.localStorage.setItem(analyticsKey, analyticsConsent);
      saved = true;
    } catch {
      // Keep the in-memory choices when storage is unavailable.
    }
    banner.hidden = true;
    updateTags();
    if (withdrew && saved) {
      window.location.reload();
      return;
    }
    if (settings.getAttribute('aria-expanded') === 'true') settings.focus();
    settings.setAttribute('aria-expanded', 'false');
  });

  settings.addEventListener('click', () => {
    adsOption.checked = adsConsent === 'granted';
    analyticsOption.checked = analyticsConsent === 'granted';
    banner.hidden = false;
    settings.setAttribute('aria-expanded', 'true');
    banner.querySelector('h2').focus();
  });
  settings.hidden = false;
  adsOption.checked = adsConsent === 'granted';
  analyticsOption.checked = analyticsConsent === 'granted';
  banner.hidden = adsConsent !== null && analyticsConsent !== null;
  updateTags();

  function trackPlayClick(event) {
    const link = event.target.closest('a[data-ads-play-link]');
    if (!link || adsConsent !== 'granted' || event.defaultPrevented) return;

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
