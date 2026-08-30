import { z } from 'zod'

/**
 * The module manifest is the single contract of this platform.
 *
 * A module is a *declaration*, never executable code. It says what data it
 * stores, what screens its owner gets, and what (if anything) the public sees.
 * One shared runtime renders every module from this description, which is what
 * lets modules sit side by side without any path to break each other, and lets
 * security be enforced once, centrally, for all of them.
 */

/** Field types the runtime knows how to store, validate and render. */
export const fieldTypeSchema = z.enum([
  'text',
  'longtext',
  'number',
  'money',
  'boolean',
  'select',
  'date',
  'time',
  'email',
  'phone',
  'url',
  'color',
  'image',
])

export type FieldType = z.infer<typeof fieldTypeSchema>

export const fieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(48)
    .regex(/^[a-z][a-z0-9_]*$/, 'Field keys must be snake_case.'),
  label: z.string().min(1).max(80),
  type: fieldTypeSchema,
  required: z.boolean().default(false),
  help: z.string().max(200).optional(),
  placeholder: z.string().max(120).optional(),
  /** Options for `select` fields. */
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  /** Bounds for `number` / `money`, max length for text types. */
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().int().positive().max(10_000).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  /** Hide from the public-facing form even when the collection is public. */
  ownerOnly: z.boolean().default(false),
})

export type ModuleField = z.infer<typeof fieldSchema>

export const collectionSchema = z.object({
  label: z.string().min(1).max(60),
  labelSingular: z.string().min(1).max(60),
  fields: z.array(fieldSchema).min(1).max(40),
  /** Which field to show as the row title in lists. */
  titleField: z.string(),
  /** Optional supporting field shown beside the title. */
  subtitleField: z.string().optional(),
  /** Optional select field used to group rows into sections. */
  groupField: z.string().optional(),
  /** Owner can drag to reorder rows; otherwise newest first. */
  sortable: z.boolean().default(false),
  /** Anyone with the public link can read these rows. */
  publicRead: z.boolean().default(false),
  /** Anyone with the public link can create rows (a form, a request box). */
  publicWrite: z.boolean().default(false),
  /** Copy shown above a public submission form. */
  publicWriteCta: z.string().max(120).optional(),
})

export type ModuleCollection = z.infer<typeof collectionSchema>

/**
 * Capabilities a module must declare up front. These are surfaced to the user
 * as a plain-language prompt at install time, and are the only things the
 * runtime will let the module do.
 */
export const permissionSchema = z.enum([
  'public_page',
  'collect_submissions',
  'store_records',
  'generate_qr',
])

export type ModulePermission = z.infer<typeof permissionSchema>

export const PERMISSION_COPY: Record<ModulePermission, string> = {
  public_page: 'Show a page on your public profile that anyone can visit',
  collect_submissions: 'Let visitors send you entries through that page',
  store_records: 'Store the entries and content you create in this app',
  generate_qr: 'Generate a QR code that links to your public page',
}

/** Public surface templates the runtime ships. A module picks one; it cannot bring its own. */
export const publicTemplateSchema = z.enum(['catalog', 'form', 'links', 'board'])

export type PublicTemplate = z.infer<typeof publicTemplateSchema>

export const publicSurfaceSchema = z.object({
  template: publicTemplateSchema,
  /** Collection rendered by the template. */
  collection: z.string(),
  /** Collection that a visitor submission is written into (form/board only). */
  submitCollection: z.string().optional(),
  /** Default heading, overridable per install. */
  heading: z.string().max(80).optional(),
})

export type PublicSurface = z.infer<typeof publicSurfaceSchema>

export const manifestSchema = z
  .object({
    id: z
      .string()
      .min(2)
      .max(40)
      .regex(/^[a-z][a-z0-9-]*$/, 'Module ids must be kebab-case.'),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Use semantic versioning.'),
    name: z.string().min(1).max(48),
    tagline: z.string().min(1).max(90),
    description: z.string().min(1).max(600),
    icon: z.string().min(1).max(8),
    accent: z.string().regex(/^#[0-9a-f]{6}$/i),
    category: z.enum(['hospitality', 'events', 'commerce', 'content', 'operations', 'personal']),
    author: z.object({
      name: z.string().min(1).max(60),
      handle: z.string().min(1).max(40),
    }),
    /** Carried from day one so the marketplace never needs a schema retrofit. */
    pricing: z.object({
      model: z.enum(['free', 'one_time', 'subscription']),
      amountCents: z.number().int().min(0).default(0),
      interval: z.enum(['month', 'year']).optional(),
    }),
    permissions: z.array(permissionSchema).min(1),
    /** Per-install configuration the owner edits in Settings. */
    settings: z.array(fieldSchema).max(20).default([]),
    collections: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), collectionSchema),
    /** Omitted entirely for headless / back-office-only modules. */
    publicSurface: publicSurfaceSchema.optional(),
  })
  .superRefine((manifest, ctx) => {
    const collectionKeys = Object.keys(manifest.collections)

    for (const [key, collection] of Object.entries(manifest.collections)) {
      const fieldKeys = collection.fields.map((field) => field.key)

      if (new Set(fieldKeys).size !== fieldKeys.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Collection "${key}" has duplicate field keys.`,
        })
      }

      for (const reference of [collection.titleField, collection.subtitleField, collection.groupField]) {
        if (reference && !fieldKeys.includes(reference)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Collection "${key}" references unknown field "${reference}".`,
          })
        }
      }

      if (collection.publicWrite && !manifest.permissions.includes('collect_submissions')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Collection "${key}" accepts public writes but the module never declared "collect_submissions".`,
        })
      }

      if (
        (collection.publicRead || collection.publicWrite) &&
        !manifest.permissions.includes('public_page')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Collection "${key}" is public but the module never declared "public_page".`,
        })
      }
    }

    if (manifest.publicSurface) {
      const surface = manifest.publicSurface

      if (!collectionKeys.includes(surface.collection)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Public surface reads unknown collection "${surface.collection}".`,
        })
      }

      if (surface.submitCollection && !collectionKeys.includes(surface.submitCollection)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Public surface writes to unknown collection "${surface.submitCollection}".`,
        })
      }

      if (!manifest.permissions.includes('public_page')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A module with a public surface must declare the "public_page" permission.',
        })
      }
    }
  })

export type ModuleManifest = z.infer<typeof manifestSchema>

/**
 * Every manifest passes through here before the platform will touch it —
 * whether it is one of ours, one a user built, or one bought from the store.
 * Nothing unvalidated ever reaches the runtime or the database.
 */
export function parseManifest(input: unknown): ModuleManifest {
  return manifestSchema.parse(input)
}

export function safeParseManifest(input: unknown) {
  return manifestSchema.safeParse(input)
}

/** Collections the runtime will expose to anonymous readers, derived at install time. */
export function publicReadCollections(manifest: ModuleManifest): string[] {
  return Object.entries(manifest.collections)
    .filter(([, collection]) => collection.publicRead)
    .map(([key]) => key)
}

/** Collections anonymous visitors may write into, derived at install time. */
export function publicWriteCollections(manifest: ModuleManifest): string[] {
  return Object.entries(manifest.collections)
    .filter(([, collection]) => collection.publicWrite)
    .map(([key]) => key)
}
