'use client'

import { useState } from 'react'
import DescribeBuilder from '@/components/build/DescribeBuilder'
import StoreBuilder from '@/components/build/StoreBuilder'
import { proposeStoreApp } from '@/app/build/ai-actions'
import type { ModuleDraft } from '@/lib/modules/derive'

/** Describe-it / speak-it, then the same builder, then the store manifest. */
export default function StoreDescribe({ configured }: { configured: boolean }) {
  const [draft, setDraft] = useState<ModuleDraft | null>(null)
  if (draft) return <StoreBuilder initial={draft} describeAvailable={configured} />
  return <DescribeBuilder configured={configured} propose={proposeStoreApp} onAccept={setDraft} backHref="/build" />
}
