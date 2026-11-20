import type {ReactNode} from 'react';
import Link from 'next/link';
import type {AppRole} from '@/lib/auth/authorizationContract';
import {COMPONENT_PREVIEW_COPY as COPY} from '@/ui/situationCatalog';

/** Owned S19 page frame; domain adapters supply their existing source views. */
export function ComponentPreviewFrame({role,children}:{role:AppRole;children:ReactNode}){
 return <section data-spec-id="vorschau.bausteine" data-preview-role={role}>
  <header><h1>{COPY.title}</h1><p className="muted">{COPY.notice}</p></header>
  {children}<Link href="/orders">{COPY.source}</Link>
 </section>;
}
