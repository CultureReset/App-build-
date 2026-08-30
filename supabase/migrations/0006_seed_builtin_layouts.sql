-- ============================================================================
-- Seeds the page layouts that ship with the platform.
--
-- GENERATED FILE — do not edit by hand. Regenerate with:
--   npm run seed:layouts
-- ============================================================================

insert into public.page_templates
  (slug, name, description, category, theme, plan, author_id, is_builtin, is_public)
select
  seed.slug,
  seed.name,
  seed.description,
  seed.category,
  seed.theme,
  seed.plan,
  null,
  true,
  true
from (values
  (
    'real-estate-agent',
    'Real Estate Agent',
    'Profile, one-tap contact, live listings, an intro video and an enquiry form. Built for turning property interest into a conversation.',
    'commerce',
    '{"preset":"agent","mode":"light","background":"gradient","bgColor":"#eef1f6","bgColorAlt":"#ffffff","accent":"#1f3b73","textColor":"#131722","mutedColor":"#5b6478","surface":"card","surfaceColor":"#ffffff","font":"serif","radius":"sm","density":"normal","width":"wide","buttonStyle":"solid","header":"cover","avatarShape":"circle","headings":"uppercase"}'::jsonb,
    '[{"module_id":"social-links","heading":"","display_variant":"icons"},{"module_id":"action-buttons","name":"Contact me","heading":"","display_variant":"grid"},{"module_id":"listings","name":"My listings","heading":"Listings","display_variant":"grid"},{"module_id":"video","name":"About me","heading":"About me","display_variant":"feature"},{"module_id":"lead-capture","name":"Enquiries","heading":"Get in touch","display_variant":"feature"},{"module_id":"faq","name":"FAQ","heading":"Common questions","display_variant":"accordion"}]'::jsonb
  ),
  (
    'restaurant',
    'Restaurant or Café',
    'A scannable menu, a photo gallery, booking and directions buttons, and your socials.',
    'hospitality',
    '{"preset":"warm","mode":"light","background":"solid","bgColor":"#f6f1e8","bgColorAlt":"#fffdf9","accent":"#b5562a","textColor":"#231a12","mutedColor":"#7b6a58","surface":"card","surfaceColor":"#fffdf9","font":"serif","radius":"md","density":"roomy","width":"standard","buttonStyle":"soft","header":"centered","avatarShape":"rounded","headings":"plain"}'::jsonb,
    '[{"module_id":"action-buttons","name":"Quick actions","heading":"","display_variant":"grid"},{"module_id":"qr-menu","name":"Menu","heading":"Menu","display_variant":"list"},{"module_id":"gallery","name":"Photos","heading":"The room","display_variant":"strip"},{"module_id":"social-links","heading":"","display_variant":"icons"}]'::jsonb
  ),
  (
    'dj-night',
    'DJ & Nightlife',
    'Take requests from the floor, push your socials, show the gallery.',
    'events',
    '{"preset":"neon","mode":"dark","background":"spotlight","bgColor":"#0a0612","bgColorAlt":"#1d1030","accent":"#c46bff","textColor":"#f7f2ff","mutedColor":"#a596c0","surface":"glass","surfaceColor":"#1a1228","font":"sans","radius":"lg","density":"roomy","width":"standard","buttonStyle":"pill","header":"centered","avatarShape":"rounded","headings":"uppercase"}'::jsonb,
    '[{"module_id":"song-request","name":"Requests","heading":"Request a song","display_variant":"feature"},{"module_id":"action-buttons","name":"Links","heading":"","display_variant":"buttons"},{"module_id":"gallery","name":"Gallery","heading":"Recent nights","display_variant":"grid"},{"module_id":"social-links","heading":"","display_variant":"icons"}]'::jsonb
  ),
  (
    'creator',
    'Creator',
    'A clean link page with socials, a featured video and a gallery.',
    'personal',
    '{"preset":"clean","mode":"light","background":"solid","bgColor":"#f6f7f9","bgColorAlt":"#ffffff","accent":"#636ef1","textColor":"#171a21","mutedColor":"#65728e","surface":"card","surfaceColor":"#ffffff","font":"sans","radius":"md","density":"normal","width":"standard","buttonStyle":"solid","header":"centered","avatarShape":"rounded","headings":"plain"}'::jsonb,
    '[{"module_id":"social-links","heading":"","display_variant":"icons"},{"module_id":"link-hub","name":"Links","heading":"","display_variant":"buttons"},{"module_id":"video","name":"Latest","heading":"Latest","display_variant":"feature"},{"module_id":"gallery","name":"Work","heading":"Work","display_variant":"grid"}]'::jsonb
  ),
  (
    'trades-services',
    'Trades & Services',
    'Show the work, answer the usual questions, and make quoting one tap away.',
    'operations',
    '{"preset":"brutal","mode":"light","background":"solid","bgColor":"#ffffff","bgColorAlt":"#ffffff","accent":"#111111","textColor":"#000000","mutedColor":"#555555","surface":"outline","surfaceColor":"#ffffff","font":"mono","radius":"none","density":"compact","width":"standard","buttonStyle":"outline","header":"left","avatarShape":"square","headings":"uppercase"}'::jsonb,
    '[{"module_id":"action-buttons","name":"Contact","heading":"","display_variant":"buttons"},{"module_id":"gallery","name":"Recent work","heading":"Recent work","display_variant":"grid"},{"module_id":"faq","name":"FAQ","heading":"Questions","display_variant":"accordion"},{"module_id":"lead-capture","name":"Quote requests","heading":"Request a quote","display_variant":"feature"}]'::jsonb
  ),
  (
    'dark-hub',
    'Dark Hub',
    'High-contrast dark page. Works for anything — start here and swap the blocks.',
    'general',
    '{"preset":"midnight","mode":"dark","background":"spotlight","bgColor":"#0b0d12","bgColorAlt":"#161a24","accent":"#3d8bff","textColor":"#f4f6fa","mutedColor":"#98a2b8","surface":"outline","surfaceColor":"#141821","font":"sans","radius":"lg","density":"normal","width":"standard","buttonStyle":"solid","header":"cover","avatarShape":"rounded","headings":"plain"}'::jsonb,
    '[{"module_id":"social-links","heading":"","display_variant":"icons"},{"module_id":"action-buttons","name":"Actions","heading":"","display_variant":"grid"},{"module_id":"link-hub","name":"Links","heading":"Links","display_variant":"list"}]'::jsonb
  )
) as seed (slug, name, description, category, theme, plan)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      category = excluded.category,
      theme = excluded.theme,
      plan = excluded.plan,
      is_public = true;
