/* ============================================================
   PINNACLE APARTMENTS — Configuration
   Fill SUPABASE_URL + SUPABASE_ANON_KEY to go live.
   Leave blank to run the built-in local engine (fully working).
   ============================================================ */
window.PINNACLE = {
  SUPABASE_URL: 'https://khzlelahiznpexcixcsu.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_jwnzzTk45cVA3kfJYhAUPg_-08nNCAO',

  BRAND: 'Pinnacle Apartments',
  TZ: 'Africa/Lagos',

  /* Image slots — drop your files at these paths.
     Missing files fall back to generated artwork automatically. */
  IMAGES: {
    authHero: 'assets/img/auth-hero.jpg',
    banners: [
      'assets/img/banner-1.jpg',
      'assets/img/banner-2.jpg',
      'assets/img/banner-3.jpg'
    ],
    units: {
      studio:    'assets/img/units/studio.jpg',
      'one-bed': 'assets/img/units/one-bed.jpg',
      'two-bed': 'assets/img/units/two-bed.jpg',
      'three-bed':'assets/img/units/three-bed.jpg',
      duplex:    'assets/img/units/duplex.jpg',
      penthouse: 'assets/img/units/penthouse.jpg'
    }
  }
};
