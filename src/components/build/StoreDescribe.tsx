'use client'

import { useState } from 'react'
import DescribeBuilder from '@/components/build/DescribeBuilder'
import StoreBuilder, { type Starter } from '@/components/build/StoreBuilder'
import { proposeStoreApp } from '@/app/build/ai-actions'
import type { ModuleDraft } from '@/lib/modules/derive'

/** Describe-it / speak-it, then the same builder, then the store manifest. */
export default function StoreDescribe({ configured, starters, reservedPublishers }: { configured: boolean; starters?: Starter[]; reservedPublishers?: string[] }) {
  const [draft, setDraft] = useState<ModuleDraft | null>(null)
  if (draft) return <StoreBuilder initial={draft} describeAvailable={configured} starters={starters} reservedPublishers={reservedPublishers} />
  return <DescribeBuilder configured={configured} propose={proposeStoreApp} onAccept={setDraft} backHref="/build" />
}
