// The engine's own words: buttons, empty states, counts. A screen passes
// `copy` to override any of them (another language, its own tone). Apps
// bring their own words through the manifest (labels, headings, emptyText).

export const DEFAULT_COPY = {
  add: 'Add {item}',
  edit: 'Edit',
  delete: 'Delete',
  moveUp: 'Move up',
  moveDown: 'Move down',
  cancel: 'Cancel',
  save: 'Save changes',
  saveSettings: 'Save settings',
  settings: 'Settings',
  send: 'Send',
  sent: 'Thanks — that was sent.',
  closed: 'Closed for now — check back soon.',
  empty: 'Nothing here yet.',
  count: '{n} entries',
  countOne: '1 entry',
  other: 'Other',
  noAccess: 'This app has not been given access to {resource}.',
  readOnly: 'Shown from your business data. Change it under Business.',
  justNow: 'just now',
  minutesAgo: '{n}m ago',
  hoursAgo: '{n}h ago',
  yes: 'Yes',
  no: 'No',
  // Templates (views/*.js)
  call: 'Call',
  sms: 'Text',
  email: 'Email',
  website: 'Website',
  book: 'Book',
  directions: 'Directions',
  soldOut: 'Sold out',
  markSoldOut: 'Mark sold out',
  markAvailable: 'Mark available',
  setCover: 'Make cover',
  cover: 'Cover',
  show: 'Show',
  hide: 'Hide',
  priceUnit: '{price} {unit}',
  upTo: 'Up to {n}',
  all: 'All',
  details: 'Details',
  close: 'Close',
  open: 'Open',
  previous: 'Previous',
  next: 'Next',
}

export function copyWith(overrides) {
  return { ...DEFAULT_COPY, ...(overrides || {}) }
}

export function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => (values[k] !== undefined ? String(values[k]) : ''))
}
