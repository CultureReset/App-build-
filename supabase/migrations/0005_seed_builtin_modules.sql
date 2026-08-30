-- ============================================================================
-- Seeds the apps that ship with the platform.
--
-- GENERATED FILE — do not edit by hand. Regenerate with:
--   npm run seed:modules
--
-- These rows are ordinary modules. The store, the runtime and the installer
-- treat them exactly like a module a user built; "is_builtin" only marks that
-- they have no author account behind them and cannot be edited or deleted
-- through the authoring policies.
-- ============================================================================

insert into public.module_listings
  (module_id, version, manifest, price_cents, pricing_model, author_id, is_builtin, status, visibility)
select
  seed.module_id,
  seed.version,
  seed.manifest,
  seed.price_cents,
  seed.pricing_model,
  null,
  true,
  'published',
  'public'
from (values
  (
    'listings',
    '1.0.0',
    '{"id":"listings","version":"1.0.0","name":"Listings","tagline":"Show what you have on the market, with a way to reach you on every one.","description":"Properties, vehicles, inventory — anything you list. Each entry gets a photo, a price, a status badge and its own details. Visitors go from the thing they are interested in straight to contacting you.","icon":"🏠","accent":"#1f3b73","category":"commerce","author":{"name":"Platform","handle":"platform"},"pricing":{"model":"free","amountCents":0},"permissions":["store_records","public_page","generate_qr"],"settings":[{"key":"currency","label":"Currency symbol","type":"text","required":false,"maxLength":3,"defaultValue":"$","ownerOnly":false}],"collections":{"properties":{"label":"Listings","labelSingular":"Listing","fields":[{"key":"title","label":"Title","type":"text","required":true,"maxLength":120,"ownerOnly":false},{"key":"address","label":"Address or location","type":"text","required":false,"maxLength":160,"ownerOnly":false},{"key":"price","label":"Price","type":"money","required":false,"min":0,"ownerOnly":false},{"key":"status","label":"Status","type":"select","required":true,"options":[{"value":"active","label":"For sale"},{"value":"pending","label":"Under offer"},{"value":"sold","label":"Sold"},{"value":"rental","label":"For rent"}],"defaultValue":"active","ownerOnly":false},{"key":"image_url","label":"Photo URL","type":"image","required":false,"help":"Paste a link to a hosted photo.","ownerOnly":false},{"key":"beds","label":"Bedrooms","type":"number","required":false,"min":0,"max":99,"ownerOnly":false},{"key":"baths","label":"Bathrooms","type":"number","required":false,"min":0,"max":99,"ownerOnly":false},{"key":"area","label":"Size","type":"text","required":false,"maxLength":40,"ownerOnly":false},{"key":"description","label":"Description","type":"longtext","required":false,"maxLength":800,"ownerOnly":false},{"key":"link_url","label":"Full details link","type":"url","required":false,"help":"Optional — where the listing lives in full.","ownerOnly":false},{"key":"visible","label":"Visible","type":"boolean","required":false,"defaultValue":true,"ownerOnly":false}],"titleField":"title","subtitleField":"price","groupField":"status","sortable":true,"publicRead":true,"publicWrite":false}},"publicSurface":{"template":"listings","collection":"properties","heading":"Listings","defaultVariant":"grid","imageField":"image_url","priceField":"price","metaFields":["beds","baths","area"],"badgeField":"status","linkField":"link_url","bodyField":"description"}}'::jsonb,
    0,
    'free'
  ),
  (
    'action-buttons',
    '1.0.0',
    '{"id":"action-buttons","version":"1.0.0","name":"Action Buttons","tagline":"Call, message, book, save your contact — one tap each.","description":"The row of buttons that turns a visitor into a conversation. Point them at a phone number, a WhatsApp thread, an email, a booking link or anything else you use.","icon":"⚡","accent":"#0f9d6e","category":"content","author":{"name":"Platform","handle":"platform"},"pricing":{"model":"free","amountCents":0},"permissions":["store_records","public_page","generate_qr"],"settings":[],"collections":{"actions":{"label":"Buttons","labelSingular":"Button","fields":[{"key":"label","label":"Button text","type":"text","required":true,"maxLength":40,"ownerOnly":false},{"key":"icon","label":"Icon","type":"select","required":false,"options":[{"value":"arrow","label":"→  Arrow"},{"value":"phone","label":"📞  Phone"},{"value":"message","label":"💬  Message"},{"value":"mail","label":"✉️  Email"},{"value":"calendar","label":"📅  Calendar"},{"value":"map","label":"📍  Location"},{"value":"card","label":"💳  Payment"},{"value":"download","label":"⬇️  Download"},{"value":"star","label":"⭐  Review"}],"defaultValue":"arrow","ownerOnly":false},{"key":"url","label":"Link","type":"url","required":true,"help":"A web link, or a tel:/mailto: style link written out in full.","ownerOnly":false},{"key":"style","label":"Emphasis","type":"select","required":false,"options":[{"value":"primary","label":"Primary"},{"value":"secondary","label":"Secondary"}],"defaultValue":"primary","ownerOnly":false},{"key":"visible","label":"Visible","type":"boolean","required":false,"defaultValue":true,"ownerOnly":false}],"titleField":"label","subtitleField":"url","sortable":true,"publicRead":true,"publicWrite":false}},"publicSurface":{"template":"actions","collection":"actions","heading":"Get in touch","defaultVariant":"buttons","badgeField":"icon","linkField":"url"}}'::jsonb,
    0,
    'free'
  ),
  (
    'social-links',
    '1.0.0',
    '{"id":"social-links","version":"1.0.0","name":"Social Links","tagline":"Every profile you keep, in one compact row.","description":"Instagram, LinkedIn, YouTube, TikTok, X, Facebook and the rest. Sits neatly under your name rather than eating a whole section.","icon":"🌐","accent":"#5b6478","category":"content","author":{"name":"Platform","handle":"platform"},"pricing":{"model":"free","amountCents":0},"permissions":["store_records","public_page","generate_qr"],"settings":[],"collections":{"profiles":{"label":"Profiles","labelSingular":"Profile","fields":[{"key":"network","label":"Network","type":"select","required":true,"options":[{"value":"instagram","label":"Instagram"},{"value":"facebook","label":"Facebook"},{"value":"linkedin","label":"LinkedIn"},{"value":"youtube","label":"YouTube"},{"value":"tiktok","label":"TikTok"},{"value":"x","label":"X"},{"value":"whatsapp","label":"WhatsApp"},{"value":"threads","label":"Threads"},{"value":"pinterest","label":"Pinterest"},{"value":"spotify","label":"Spotify"},{"value":"website","label":"Website"}],"ownerOnly":false},{"key":"url","label":"Link","type":"url","required":true,"ownerOnly":false},{"key":"visible","label":"Visible","type":"boolean","required":false,"defaultValue":true,"ownerOnly":false}],"titleField":"network","subtitleField":"url","sortable":true,"publicRead":true,"publicWrite":false}},"publicSurface":{"template":"socials","collection":"profiles","heading":"Elsewhere","defaultVariant":"icons","linkField":"url"}}'::jsonb,
    0,
    'free'
  ),
  (
    'lead-capture',
    '1.0.0',
    '{"id":"lead-capture","version":"1.0.0","name":"Enquiry Form","tagline":"Catch the people who are ready to talk.","description":"A short form on your page. Every enquiry lands in your dashboard with a status you can work through, so nothing gets lost in a chat thread.","icon":"📥","accent":"#c0562a","category":"operations","author":{"name":"Platform","handle":"platform"},"pricing":{"model":"free","amountCents":0},"permissions":["store_records","public_page","collect_submissions","generate_qr"],"settings":[{"key":"accepting","label":"Accepting enquiries","type":"boolean","required":false,"defaultValue":true,"ownerOnly":false},{"key":"intro","label":"Message above the form","type":"longtext","required":false,"placeholder":"Tell me what you are looking for and I will come back to you today.","maxLength":300,"ownerOnly":false}],"collections":{"enquiries":{"label":"Enquiries","labelSingular":"Enquiry","fields":[{"key":"name","label":"Your name","type":"text","required":true,"maxLength":80,"ownerOnly":false},{"key":"email","label":"Email","type":"email","required":true,"ownerOnly":false},{"key":"phone","label":"Phone","type":"phone","required":false,"ownerOnly":false},{"key":"interest","label":"What can I help with?","type":"select","required":false,"options":[{"value":"buying","label":"Buying"},{"value":"selling","label":"Selling"},{"value":"renting","label":"Renting"},{"value":"valuation","label":"A valuation"},{"value":"other","label":"Something else"}],"ownerOnly":false},{"key":"message","label":"Message","type":"longtext","required":false,"maxLength":800,"ownerOnly":false},{"key":"status","label":"Status","type":"select","required":false,"options":[{"value":"new","label":"New"},{"value":"contacted","label":"Contacted"},{"value":"won","label":"Won"},{"value":"closed","label":"Closed"}],"defaultValue":"new","ownerOnly":true}],"titleField":"name","subtitleField":"interest","groupField":"status","sortable":false,"publicRead":false,"publicWrite":true,"publicWriteCta":"Send enquiry"}},"publicSurface":{"template":"form","collection":"enquiries","submitCollection":"enquiries","heading":"Get in touch","defaultVariant":"feature"}}'::jsonb,
    0,
    'free'
  ),
  (
    'gallery',
    '1.0.0',
    '{"id":"gallery","version":"1.0.0","name":"Gallery","tagline":"Photos of the work, the room, the product.","description":"A grid of images with optional captions. Useful anywhere the thing you do is easier to show than to describe.","icon":"🖼️","accent":"#7a5cc4","category":"content","author":{"name":"Platform","handle":"platform"},"pricing":{"model":"free","amountCents":0},"permissions":["store_records","public_page","generate_qr"],"settings":[],"collections":{"photos":{"label":"Photos","labelSingular":"Photo","fields":[{"key":"image_url","label":"Image URL","type":"image","required":true,"ownerOnly":false},{"key":"caption","label":"Caption","type":"text","required":false,"maxLength":120,"ownerOnly":false},{"key":"link_url","label":"Links to","type":"url","required":false,"ownerOnly":false},{"key":"visible","label":"Visible","type":"boolean","required":false,"defaultValue":true,"ownerOnly":false}],"titleField":"caption","subtitleField":"image_url","sortable":true,"publicRead":true,"publicWrite":false}},"publicSurface":{"template":"gallery","collection":"photos","heading":"Gallery","defaultVariant":"grid","imageField":"image_url","linkField":"link_url"}}'::jsonb,
    0,
    'free'
  ),
  (
    'video',
    '1.0.0',
    '{"id":"video","version":"1.0.0","name":"Video","tagline":"An intro clip, a walkthrough, a tour.","description":"Embed a YouTube or Vimeo video on your page. Nothing else is allowed to embed, so the page stays fast and nothing can track your visitors without you knowing.","icon":"▶️","accent":"#cc3b3b","category":"content","author":{"name":"Platform","handle":"platform"},"pricing":{"model":"free","amountCents":0},"permissions":["store_records","public_page","generate_qr"],"settings":[],"collections":{"videos":{"label":"Videos","labelSingular":"Video","fields":[{"key":"title","label":"Title","type":"text","required":false,"maxLength":120,"ownerOnly":false},{"key":"video_url","label":"YouTube or Vimeo link","type":"url","required":true,"placeholder":"https://www.youtube.com/watch?v=…","ownerOnly":false},{"key":"visible","label":"Visible","type":"boolean","required":false,"defaultValue":true,"ownerOnly":false}],"titleField":"title","subtitleField":"video_url","sortable":true,"publicRead":true,"publicWrite":false}},"publicSurface":{"template":"embed","collection":"videos","heading":"Watch","defaultVariant":"feature","linkField":"video_url"}}'::jsonb,
    0,
    'free'
  ),
  (
    'faq',
    '1.0.0',
    '{"id":"faq","version":"1.0.0","name":"FAQ","tagline":"Answer the questions before they are asked.","description":"A tidy list of questions and answers that expand when tapped. Cuts down the same five messages you answer every week.","icon":"❓","accent":"#3d6d8f","category":"content","author":{"name":"Platform","handle":"platform"},"pricing":{"model":"free","amountCents":0},"permissions":["store_records","public_page","generate_qr"],"settings":[],"collections":{"entries":{"label":"Questions","labelSingular":"Question","fields":[{"key":"question","label":"Question","type":"text","required":true,"maxLength":160,"ownerOnly":false},{"key":"answer","label":"Answer","type":"longtext","required":true,"maxLength":1200,"ownerOnly":false},{"key":"visible","label":"Visible","type":"boolean","required":false,"defaultValue":true,"ownerOnly":false}],"titleField":"question","sortable":true,"publicRead":true,"publicWrite":false}},"publicSurface":{"template":"faq","collection":"entries","heading":"Questions","defaultVariant":"accordion","bodyField":"answer"}}'::jsonb,
    0,
    'free'
  ),
  (
    'link-hub',
    '1.0.0',
    '{"id":"link-hub","version":"1.0.0","name":"Link Hub","tagline":"Every link you hand out, in one block on your page.","description":"A tidy stack of links — booking, socials, your menu, whatever you point people at. Reorder them any time and the public page updates immediately.","icon":"🔗","accent":"#2ba05a","category":"content","author":{"name":"Platform","handle":"platform"},"pricing":{"model":"free","amountCents":0},"permissions":["store_records","public_page","generate_qr"],"settings":[],"collections":{"links":{"label":"Links","labelSingular":"Link","fields":[{"key":"label","label":"Label","type":"text","required":true,"maxLength":80,"ownerOnly":false},{"key":"url","label":"URL","type":"url","required":true,"ownerOnly":false},{"key":"description","label":"Short description","type":"text","required":false,"maxLength":120,"ownerOnly":false},{"key":"visible","label":"Visible","type":"boolean","required":false,"defaultValue":true,"ownerOnly":false}],"titleField":"label","subtitleField":"url","sortable":true,"publicRead":true,"publicWrite":false}},"publicSurface":{"template":"links","collection":"links","heading":"Links","linkField":"url"}}'::jsonb,
    0,
    'free'
  ),
  (
    'qr-menu',
    '1.0.0',
    '{"id":"qr-menu","version":"1.0.0","name":"QR Menu","tagline":"A live menu customers scan at the table.","description":"Keep your menu in one place and let customers scan a QR code to read it on their phone. Change a price and it changes everywhere instantly — no reprinting, no PDFs.","icon":"🍽️","accent":"#e2703a","category":"hospitality","author":{"name":"Platform","handle":"platform"},"pricing":{"model":"free","amountCents":0},"permissions":["store_records","public_page","generate_qr"],"settings":[{"key":"currency","label":"Currency symbol","type":"text","required":false,"maxLength":3,"defaultValue":"$","ownerOnly":false},{"key":"footer_note","label":"Footer note","type":"longtext","required":false,"placeholder":"Allergies? Please tell your server.","maxLength":300,"ownerOnly":false}],"collections":{"items":{"label":"Menu items","labelSingular":"Menu item","fields":[{"key":"name","label":"Name","type":"text","required":true,"maxLength":120,"ownerOnly":false},{"key":"description","label":"Description","type":"longtext","required":false,"maxLength":400,"ownerOnly":false},{"key":"price","label":"Price","type":"money","required":true,"min":0,"ownerOnly":false},{"key":"section","label":"Section","type":"select","required":true,"options":[{"value":"starters","label":"Starters"},{"value":"mains","label":"Mains"},{"value":"sides","label":"Sides"},{"value":"desserts","label":"Desserts"},{"value":"drinks","label":"Drinks"}],"ownerOnly":false},{"key":"available","label":"Available","type":"boolean","required":false,"defaultValue":true,"ownerOnly":false}],"titleField":"name","subtitleField":"price","groupField":"section","sortable":true,"publicRead":true,"publicWrite":false}},"publicSurface":{"template":"catalog","collection":"items","heading":"Menu"}}'::jsonb,
    0,
    'free'
  ),
  (
    'song-request',
    '1.0.0',
    '{"id":"song-request","version":"1.0.0","name":"Song Requests","tagline":"Let the room send you tracks without shouting over the music.","description":"Visitors scan a code and send a request. Every request lands in your queue where you can play it, skip it, or hide it. The crowd never sees the queue unless you want them to.","icon":"🎧","accent":"#7c5cff","category":"events","author":{"name":"Platform","handle":"platform"},"pricing":{"model":"free","amountCents":0},"permissions":["store_records","public_page","collect_submissions","generate_qr"],"settings":[{"key":"accepting","label":"Accepting requests","type":"boolean","required":false,"help":"Turn this off to close the queue between sets.","defaultValue":true,"ownerOnly":false},{"key":"intro","label":"Message above the form","type":"longtext","required":false,"placeholder":"One request per person, please.","maxLength":300,"ownerOnly":false}],"collections":{"requests":{"label":"Requests","labelSingular":"Request","fields":[{"key":"song","label":"Song","type":"text","required":true,"maxLength":120,"ownerOnly":false},{"key":"artist","label":"Artist","type":"text","required":false,"maxLength":120,"ownerOnly":false},{"key":"from","label":"Your name","type":"text","required":false,"maxLength":60,"ownerOnly":false},{"key":"note","label":"Note for the DJ","type":"longtext","required":false,"maxLength":240,"ownerOnly":false},{"key":"status","label":"Status","type":"select","required":false,"options":[{"value":"pending","label":"Pending"},{"value":"queued","label":"Queued"},{"value":"played","label":"Played"},{"value":"hidden","label":"Hidden"}],"defaultValue":"pending","ownerOnly":true}],"titleField":"song","subtitleField":"artist","groupField":"status","sortable":false,"publicRead":false,"publicWrite":true,"publicWriteCta":"Send a request"}},"publicSurface":{"template":"form","collection":"requests","submitCollection":"requests","heading":"Request a song"}}'::jsonb,
    0,
    'free'
  )
) as seed (module_id, version, manifest, price_cents, pricing_model)
on conflict (module_id, version) do update
  set manifest = excluded.manifest,
      price_cents = excluded.price_cents,
      pricing_model = excluded.pricing_model,
      status = 'published',
      visibility = 'public';
