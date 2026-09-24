"use client"

import { ChangeEvent, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase"
import {
  Activity, Archive, ArrowRight, Bell, CalendarDays, Camera, Check, ChevronDown,
  ChevronRight, CircleHelp, Download, FileImage, FilePlus2, FileText,
  Filter, FlaskConical, HeartPulse, History, LockKeyhole, Menu,
  MoreHorizontal, Plus, Search, Share2, ShieldCheck, SlidersHorizontal, Sparkles,
  Stethoscope, Upload, UserRoundCheck, X, type LucideIcon,
} from "lucide-react"

type DocumentKind = "Receta" | "Laboratorio" | "Imagen" | "Informe" | "Vacuna" | "Otro"
type EventKind = "Consulta" | "Medicación" | "Vacuna" | "Antecedente"

type HealthDocument = {
  id: string | number
  name: string
  kind: DocumentKind
  date: string
  issuer: string
  tags: string[]
  ocr: "Revisado" | "Pendiente" | "No aplica"
  size: string
  tone: "blue" | "sage" | "terracotta" | "ink"
  assetPath?: string
}

type TimelineEvent = {
  id: string | number
  date: string
  title: string
  detail: string
  kind: EventKind | DocumentKind
  icon: "visit" | "lab" | "file" | "vaccine" | "medication"
}

const initialDocuments: HealthDocument[] = [
  { id: 1, name: "Resultados — análisis de rutina", kind: "Laboratorio", date: "2026-09-18", issuer: "Laboratorio Central", tags: ["Control anual", "Sangre"], ocr: "Revisado", size: "1,8 MB", tone: "sage" },
  { id: 2, name: "Receta — control clínico", kind: "Receta", date: "2026-09-04", issuer: "Dra. Ana González", tags: ["Medicación"], ocr: "Pendiente", size: "742 KB", tone: "terracotta" },
  { id: 3, name: "Informe de ecografía abdominal", kind: "Informe", date: "2026-07-22", issuer: "Diagnóstico del Plata", tags: ["Imágenes", "Ecografía"], ocr: "Revisado", size: "2,4 MB", tone: "blue" },
  { id: 4, name: "Certificado de vacunación", kind: "Vacuna", date: "2026-04-11", issuer: "Hospital Municipal", tags: ["Prevención"], ocr: "No aplica", size: "468 KB", tone: "ink" },
]

const initialTimeline: TimelineEvent[] = [
  { id: 1, date: "2026-09-18", title: "Análisis de rutina", detail: "Laboratorio Central · Resultado cargado", kind: "Laboratorio", icon: "lab" },
  { id: 2, date: "2026-09-04", title: "Consulta clínica", detail: "Dra. Ana González · Evento agregado por vos", kind: "Consulta", icon: "visit" },
  { id: 3, date: "2026-09-04", title: "Receta médica", detail: "Control clínico · OCR pendiente de revisión", kind: "Receta", icon: "file" },
  { id: 4, date: "2026-07-22", title: "Ecografía abdominal", detail: "Diagnóstico del Plata · Informe disponible", kind: "Informe", icon: "file" },
]

const navItems: { label: string; icon: LucideIcon; view: View }[] = [
  { label: "Mi resumen", icon: HeartPulse, view: "dashboard" },
  { label: "Documentos", icon: Archive, view: "documents" },
  { label: "Línea de tiempo", icon: History, view: "timeline" },
  { label: "Compartir", icon: Share2, view: "share" },
]

type View = "dashboard" | "documents" | "timeline" | "share" | "privacy"

const kindIcon: Record<HealthDocument["tone"], LucideIcon> = { blue: FileImage, sage: FlaskConical, terracotta: FileText, ink: ShieldCheck }
const eventIcon: Record<TimelineEvent["icon"], LucideIcon> = { visit: Stethoscope, lab: FlaskConical, file: FileText, vaccine: ShieldCheck, medication: Activity }

function formatDate(value: string, short = false) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: short ? "short" : "long", year: short ? undefined : "numeric" }).format(new Date(`${value}T12:00:00`))
}

function toneForKind(kind: DocumentKind): HealthDocument["tone"] {
  if (kind === "Laboratorio") return "sage"
  if (kind === "Receta") return "terracotta"
  if (kind === "Vacuna") return "ink"
  return "blue"
}

function iconForKind(kind: TimelineEvent["kind"]): TimelineEvent["icon"] {
  if (kind === "Laboratorio") return "lab"
  if (kind === "Vacuna") return "vaccine"
  if (kind === "Medicación") return "medication"
  if (kind === "Consulta" || kind === "Antecedente") return "visit"
  return "file"
}

export default function Home() {
  const supabase = getSupabaseBrowserClient()
  const configured = isSupabaseConfigured()
  const [view, setView] = useState<View>("dashboard")
  const [documents, setDocuments] = useState(initialDocuments)
  const [timeline, setTimeline] = useState(initialTimeline)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<DocumentKind | "Todos">("Todos")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [notice, setNotice] = useState("")
  const [consent, setConsent] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [sharing, setSharing] = useState([{ id: 1, name: "Dr. Martín Ruiz", relation: "Cardiólogo", expires: "Vence el 30 sep.", active: true }])

  const filteredDocuments = useMemo(() => documents.filter((doc) => {
    const term = search.toLocaleLowerCase("es")
    const matchesSearch = !term || [doc.name, doc.issuer, doc.kind, ...doc.tags].join(" ").toLocaleLowerCase("es").includes(term)
    return matchesSearch && (filter === "Todos" || doc.kind === filter)
  }), [documents, filter, search])

  useEffect(() => {
    if (!supabase) return
    const client = supabase as NonNullable<typeof supabase>
    let active = true
    async function hydrate() {
      const { data } = await client.auth.getUser()
      if (!active) return
      setUser(data.user)
      if (data.user) await loadHealthData(data.user.id)
    }
    void hydrate()
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) void loadHealthData(session.user.id)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  // The singleton Supabase client is stable for the page lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(""), 3600)
  }

  async function loadHealthData(ownerId: string) {
    if (!supabase) return
    setSyncing(true)
    const [documentResult, eventResult] = await Promise.all([
      supabase.from("health_documents").select("id, display_name, document_type, issued_at, issuer, tags, ocr_status, byte_size, asset_path").eq("owner_id", ownerId).order("issued_at", { ascending: false }),
      supabase.from("timeline_events").select("id, occurred_at, title, detail, event_kind").eq("owner_id", ownerId).order("occurred_at", { ascending: false }),
    ])
    if (documentResult.error || eventResult.error) {
      showNotice("No pudimos sincronizar tu información. Volvé a intentarlo.")
    } else {
      setDocuments((documentResult.data ?? []).map((doc) => ({
        id: doc.id, name: doc.display_name, kind: doc.document_type as DocumentKind, date: doc.issued_at,
        issuer: doc.issuer, tags: doc.tags ?? [], ocr: doc.ocr_status as HealthDocument["ocr"],
        size: `${Math.max(1, Math.round(Number(doc.byte_size) / 1024))} KB`, tone: toneForKind(doc.document_type as DocumentKind), assetPath: doc.asset_path,
      })))
      setTimeline((eventResult.data ?? []).map((event) => ({
        id: event.id, date: event.occurred_at, title: event.title, detail: event.detail,
        kind: event.event_kind as TimelineEvent["kind"], icon: iconForKind(event.event_kind as TimelineEvent["kind"]),
      })))
    }
    setSyncing(false)
  }

  async function addDocument(file: File | undefined, kind: DocumentKind, scanned: boolean) {
    if (!file) return
    if (file.size > 15 * 1024 * 1024) return showNotice("El archivo supera el límite seguro de 15 MB.")
    const accepted = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"]
    if (!accepted.includes(file.type)) return showNotice("Solo podés cargar PDF, JPG, PNG o HEIC.")
    if (configured && !user) { setAuthOpen(true); return }
    const date = new Date().toISOString().slice(0, 10)
    if (supabase && user) {
      setSyncing(true)
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const assetPath = `${user.id}/${crypto.randomUUID()}-${cleanName}`
      const { error: uploadError } = await supabase.storage.from("health-documents").upload(assetPath, file, { contentType: file.type, upsert: false })
      if (uploadError) { setSyncing(false); return showNotice("No se pudo subir el archivo. Probá nuevamente.") }
      const { data: created, error: documentError } = await supabase.from("health_documents").insert({
        owner_id: user.id, display_name: file.name.replace(/\.[^/.]+$/, "") || "Documento sin título", document_type: kind,
        issued_at: date, issuer: "Pendiente de completar", tags: scanned ? ["Escaneado"] : ["Nuevo"],
        ocr_status: file.type === "application/pdf" ? "No aplica" : "Pendiente", asset_path: assetPath, mime_type: file.type, byte_size: file.size,
      }).select("id").single()
      if (documentError || !created) { await supabase.storage.from("health-documents").remove([assetPath]); setSyncing(false); return showNotice("No se pudo guardar el documento. El archivo fue descartado.") }
      await supabase.from("timeline_events").insert({ owner_id: user.id, document_id: created.id, occurred_at: date, event_kind: kind, title: file.name.replace(/\.[^/.]+$/, "") || "Documento sin título", detail: `${scanned ? "Documento escaneado" : "Documento cargado"} · Texto pendiente de revisión` })
      await loadHealthData(user.id)
      setSyncing(false)
      setUploadOpen(false); setView("documents")
      return showNotice(scanned ? "Escaneo guardado. Revisá el texto detectado antes de usarlo." : "Documento cargado en tu carpeta privada.")
    }
    const doc: HealthDocument = {
      id: Date.now(), name: file.name.replace(/\.[^/.]+$/, "") || "Documento sin título", kind, date,
      issuer: "Pendiente de completar", tags: scanned ? ["Escaneado"] : ["Nuevo"], ocr: file.type === "application/pdf" ? "No aplica" : "Pendiente",
      size: `${Math.max(1, Math.round(file.size / 1024))} KB`, tone: scanned ? "terracotta" : "blue",
    }
    setDocuments((current) => [doc, ...current])
    setTimeline((current) => [{ id: Date.now() + 1, date, title: doc.name, detail: `${scanned ? "Documento escaneado" : "Documento cargado"} · Texto pendiente de revisión`, kind, icon: "file" }, ...current])
    setUploadOpen(false)
    setView("documents")
    showNotice(scanned ? "Escaneo guardado. Revisá el texto detectado antes de usarlo." : "Documento cargado en tu carpeta privada.")
  }

  async function addEvent(form: FormData) {
    const title = String(form.get("title") || "Evento de salud")
    const kind = String(form.get("kind") || "Consulta") as EventKind
    const date = String(form.get("date") || new Date().toISOString().slice(0, 10))
    if (configured && !user) { setAuthOpen(true); return }
    if (supabase && user) {
      const { error } = await supabase.from("timeline_events").insert({ owner_id: user.id, occurred_at: date, event_kind: kind, title, detail: "Evento agregado por vos · No es una validación médica" })
      if (error) return showNotice("No se pudo guardar el evento. Probá nuevamente.")
      await loadHealthData(user.id)
    } else setTimeline((current) => [{ id: Date.now(), date, title, detail: "Evento agregado por vos · No es una validación médica", kind, icon: kind === "Vacuna" ? "vaccine" : kind === "Medicación" ? "medication" : "visit" }, ...current])
    setEventOpen(false)
    setView("timeline")
    showNotice("El evento se agregó a tu línea de tiempo privada.")
  }

  function addShare(form: FormData) {
    const name = String(form.get("name") || "Contacto autorizado")
    const relation = String(form.get("relation") || "Profesional de salud")
    setSharing((current) => [...current, { id: Date.now(), name, relation, expires: "Vence en 7 días", active: true }])
    setShareOpen(false)
    showNotice("Acceso creado: solo lectura, limitado y revocable.")
  }

  async function previewDocument(doc: HealthDocument) {
    if (!doc.assetPath || !supabase || !user) return showNotice("Iniciá sesión y configurá Supabase para abrir documentos privados.")
    const { data, error } = await supabase.storage.from("health-documents").createSignedUrl(doc.assetPath, 60)
    if (error || !data?.signedUrl) return showNotice("No se pudo generar una vista privada del documento.")
    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null); setDocuments(initialDocuments); setTimeline(initialTimeline)
    showNotice("Sesión cerrada. Estás viendo datos de demostración.")
  }

  return (
    <main className="health-shell">
      <a className="skip-link" href="#main-content">Ir al contenido principal</a>
      <aside className="sidebar" aria-label="Navegación principal">
        <button className="brand" onClick={() => setView("dashboard")} aria-label="Ir a Mi Salud">
          <span className="brand-mark"><span /></span><span>mi<span>salud</span></span>
        </button>
        <p className="side-label">Tu espacio personal</p>
        <nav className="side-nav">
          {navItems.map(({ label, icon: Icon, view: itemView }) => <button key={label} className={view === itemView ? "nav-item active" : "nav-item"} onClick={() => setView(itemView)}><Icon /><span>{label}</span>{itemView === "documents" && <small>{documents.length}</small>}</button>)}
        </nav>
        <div className="side-spacer" />
        <button className={view === "privacy" ? "privacy-link active" : "privacy-link"} onClick={() => setView("privacy")}><LockKeyhole /><span>Privacidad y seguridad</span></button>
        <button className="profile-mini" onClick={() => user ? void signOut() : setAuthOpen(true)}><span className="avatar">{user?.email?.slice(0, 2).toUpperCase() ?? "AB"}</span><div><strong>{user?.email?.split("@")[0] ?? "Modo demo"}</strong><small>{user ? "Cerrar sesión" : configured ? "Ingresar a mi cuenta" : "Configurá Supabase"}</small></div><MoreHorizontal /></button>
      </aside>

      <section className="app-area">
        <header className="topbar">
          <button className="menu-button" aria-label="Abrir navegación"><Menu /></button>
          <label className="global-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en tu historia" aria-label="Buscar en tu historia" /><kbd>⌘ K</kbd></label>
          <div className="top-actions"><button className="icon-button" aria-label="Notificaciones"><Bell /><i /></button><button className="security-status" onClick={() => configured && !user ? setAuthOpen(true) : setView("privacy")}><ShieldCheck /> {syncing ? "Sincronizando" : user ? "Cuenta protegida" : "Modo demo"} <ChevronDown /></button></div>
        </header>

        <div id="main-content" className="content">
          {view === "dashboard" && <Dashboard documents={documents} timeline={timeline} onUpload={() => setUploadOpen(true)} onScan={() => setUploadOpen(true)} onViewDocuments={() => setView("documents")} onViewTimeline={() => setView("timeline")} onAddEvent={() => setEventOpen(true)} />}
          {view === "documents" && <Documents documents={filteredDocuments} filter={filter} setFilter={setFilter} onUpload={() => setUploadOpen(true)} onSelect={(doc) => void previewDocument(doc)} />}
          {view === "timeline" && <Timeline timeline={timeline} onAddEvent={() => setEventOpen(true)} />}
          {view === "share" && <Sharing sharing={sharing} setSharing={setSharing} onAdd={() => setShareOpen(true)} onNotice={showNotice} />}
          {view === "privacy" && <Privacy consent={consent} setConsent={setConsent} onNotice={showNotice} />}
        </div>

        <nav className="mobile-nav" aria-label="Navegación móvil">
          {navItems.map(({ label, icon: Icon, view: itemView }) => <button key={label} onClick={() => setView(itemView)} className={view === itemView ? "active" : ""}><Icon /><span>{label.split(" ")[0]}</span></button>)}
        </nav>
      </section>

      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onAdd={addDocument} />}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} onSubmit={addShare} />}
      {eventOpen && <EventModal onClose={() => setEventOpen(false)} onSubmit={addEvent} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onNotice={showNotice} />}
      {notice && <div className="notice" role="status"><Check />{notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso"><X /></button></div>}
    </main>
  )
}

function Dashboard({ documents, timeline, onUpload, onScan, onViewDocuments, onViewTimeline, onAddEvent }: { documents: HealthDocument[]; timeline: TimelineEvent[]; onUpload: () => void; onScan: () => void; onViewDocuments: () => void; onViewTimeline: () => void; onAddEvent: () => void }) {
  const recent = documents.slice(0, 3)
  return <>
    <section className="welcome-row enter"><div><p className="eyebrow">Martes, 23 de septiembre</p><h1>Hola, Agustín<span className="dot">.</span></h1><p className="intro">Tu información de salud, reunida y bajo tu control.</p></div><div className="welcome-actions"><button className="button secondary" onClick={onAddEvent}><Plus />Agregar evento</button><button className="button primary" onClick={onUpload}><Upload />Subir documento</button></div></section>
    <section className="health-card enter" style={{ animationDelay: "70ms" }}><div className="health-card-copy"><span className="card-eyebrow"><span className="live-dot" />Tu carpeta clínica</span><h2>Todo lo importante,<br />en un mismo lugar.</h2><p>Guardá estudios, recetas e imágenes. Vos decidís cuándo y con quién compartirlos.</p><button className="text-button" onClick={onViewDocuments}>Ver mi carpeta <ArrowRight /></button></div><div className="folder-art" aria-hidden="true"><div className="folder-tab">Historia personal</div><div className="folder-page page-one"><span /><span /><span /></div><div className="folder-page page-two"><i /><span /><span /></div><div className="folder-front"><div className="folder-cross">+</div><span>MI SALUD</span></div></div></section>
    <section className="quick-actions enter" style={{ animationDelay: "120ms" }}><button onClick={onScan}><span className="quick-icon scan"><Camera /></span><span><strong>Escanear</strong><small>Con la cámara</small></span><ChevronRight /></button><button onClick={onUpload}><span className="quick-icon upload"><FilePlus2 /></span><span><strong>Subir archivo</strong><small>PDF o imagen</small></span><ChevronRight /></button><button onClick={onAddEvent}><span className="quick-icon event"><CalendarDays /></span><span><strong>Agregar evento</strong><small>Consulta o vacuna</small></span><ChevronRight /></button></section>
    <section className="dashboard-grid"><div className="panel enter" style={{ animationDelay: "170ms" }}><div className="panel-heading"><div><p className="eyebrow">Actividad reciente</p><h2>Línea de tiempo</h2></div><button className="small-link" onClick={onViewTimeline}>Ver todo</button></div><div className="timeline-list">{timeline.slice(0, 4).map((item) => <TimelineItem key={item.id} item={item} />)}</div></div>
      <div className="panel documents-panel enter" style={{ animationDelay: "220ms" }}><div className="panel-heading"><div><p className="eyebrow">Tu información</p><h2>Documentos recientes</h2></div><button className="small-link" onClick={onViewDocuments}>Ver todos</button></div><div className="document-list">{recent.map((doc) => <DocumentRow key={doc.id} doc={doc} />)}</div><button className="drop-zone" onClick={onUpload}><Upload /><span>Soltá un archivo o <b>elegilo desde tu dispositivo</b></span><small>PDF, JPG, PNG o HEIC · Máximo 15 MB</small></button></div></section>
    <section className="disclaimer"><CircleHelp /><p><strong>Un espacio para organizarte.</strong> Mi Salud no reemplaza la historia clínica de una institución ni el consejo de profesionales de salud.</p></section>
  </>
}

function Documents({ documents, filter, setFilter, onUpload, onSelect }: { documents: HealthDocument[]; filter: DocumentKind | "Todos"; setFilter: (kind: DocumentKind | "Todos") => void; onUpload: () => void; onSelect: (document: HealthDocument) => void }) {
  const kinds: (DocumentKind | "Todos")[] = ["Todos", "Laboratorio", "Receta", "Imagen", "Informe", "Vacuna", "Otro"]
  return <><section className="page-heading"><div><p className="eyebrow">Carpeta personal</p><h1>Mis documentos</h1><p>Originales preservados y accesibles solamente por vos.</p></div><button className="button primary" onClick={onUpload}><Upload />Subir documento</button></section><div className="filter-bar"><Filter />{kinds.map((kind) => <button key={kind} className={filter === kind ? "selected" : ""} onClick={() => setFilter(kind)}>{kind}</button>)}<button className="filter-control"><SlidersHorizontal />Filtros</button></div><section className="document-grid">{documents.map((doc, index) => <button className="document-card enter" style={{ animationDelay: `${index * 45}ms` }} key={doc.id} onClick={() => onSelect(doc)}><DocumentPreview doc={doc} /><div className="doc-card-meta"><span className={`kind-badge ${doc.tone}`}>{doc.kind}</span><h2>{doc.name}</h2><p>{formatDate(doc.date, true)} · {doc.issuer}</p><div>{doc.tags.map((tag) => <small key={tag}>#{tag}</small>)}</div></div><span className={doc.ocr === "Pendiente" ? "ocr-state pending" : "ocr-state"}>{doc.ocr === "Pendiente" ? <Sparkles /> : <Check />}{doc.ocr}</span></button>)}{documents.length === 0 && <div className="empty-state"><Archive /><h2>No encontramos documentos</h2><p>Probá con otra búsqueda o subí un archivo nuevo.</p></div>}</section></>
}

function Timeline({ timeline, onAddEvent }: { timeline: TimelineEvent[]; onAddEvent: () => void }) {
  const sorted = [...timeline].sort((a, b) => b.date.localeCompare(a.date))
  return <><section className="page-heading"><div><p className="eyebrow">Historia personal</p><h1>Línea de tiempo</h1><p>Un registro cronológico creado con tus documentos y eventos.</p></div><button className="button primary" onClick={onAddEvent}><Plus />Agregar evento</button></section><div className="timeline-toolbar"><button className="active">Todo</button><button>Consultas</button><button>Estudios</button><button>Medicaciones</button><span /><button><CalendarDays />2026 <ChevronDown /></button></div><section className="full-timeline">{sorted.map((item) => <TimelineItem item={item} key={item.id} large />)}</section><section className="disclaimer"><CircleHelp /><p>Los eventos ingresados manualmente por vos se identifican como tales. No constituyen un diagnóstico ni una validación médica.</p></section></>
}

function Sharing({ sharing, setSharing, onAdd, onNotice }: { sharing: { id: number; name: string; relation: string; expires: string; active: boolean }[]; setSharing: React.Dispatch<React.SetStateAction<{ id: number; name: string; relation: string; expires: string; active: boolean }[]>>; onAdd: () => void; onNotice: (notice: string) => void }) {
  return <><section className="page-heading"><div><p className="eyebrow">Acceso bajo tu control</p><h1>Compartir información</h1><p>Elegí qué ver, por cuánto tiempo y revocá el acceso cuando quieras.</p></div><button className="button primary" onClick={onAdd}><Share2 />Crear acceso</button></section><section className="share-hero"><div className="share-symbol"><Share2 /></div><div><h2>Tu información no se comparte por defecto.</h2><p>Cada acceso es de solo lectura, queda registrado y vence automáticamente.</p></div><ShieldCheck /></section><section className="panel share-list"><div className="panel-heading"><div><p className="eyebrow">Accesos activos</p><h2>Personas autorizadas</h2></div><span className="access-count">{sharing.filter((item) => item.active).length} activos</span></div>{sharing.map((item) => <div className="share-row" key={item.id}><span className="person-avatar">{item.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{item.name}</strong><p>{item.relation} · <span>{item.expires}</span></p></div><div className="shared-docs"><FileText />2 documentos seleccionados</div>{item.active ? <button className="revoke" onClick={() => { setSharing((current) => current.map((share) => share.id === item.id ? { ...share, active: false } : share)); onNotice("Acceso revocado. La persona ya no puede ver tus documentos.") }}>Revocar</button> : <span className="revoked">Revocado</span>}</div>)}</section><section className="audit-strip"><LockKeyhole /><p>Último acceso registrado: Dr. Martín Ruiz consultó <strong>Resultados — análisis de rutina</strong> el 22 de septiembre a las 16:42.</p><button onClick={() => onNotice("El registro de auditoría se exportará con el backend seguro.")}>Ver actividad</button></section></>
}

function Privacy({ consent, setConsent, onNotice }: { consent: boolean; setConsent: (value: boolean) => void; onNotice: (notice: string) => void }) {
  return <><section className="page-heading"><div><p className="eyebrow">Tu información, tus reglas</p><h1>Privacidad y seguridad</h1><p>Administrá tus datos, consentimientos y dispositivos desde un solo lugar.</p></div><span className="secure-pill"><ShieldCheck />Cuenta protegida</span></section><section className="privacy-grid"><div className="privacy-card featured"><ShieldCheck /><div><span>Protección de datos</span><h2>Tu carpeta está privada</h2><p>Los documentos se guardan con acceso limitado a tu cuenta. Cada descarga, cambio y acceso compartido debe quedar auditado.</p></div><button onClick={() => onNotice("La arquitectura de producción debe verificar esta protección en el servidor.")}>Conocer controles <ArrowRight /></button></div><div className="privacy-card"><UserRoundCheck /><div><span>Consentimientos</span><h2>Uso para OCR</h2><p>Autorizás el análisis de texto de documentos nuevos para ayudarte a organizarlos.</p></div><label className="switch"><input checked={consent} onChange={(event) => { setConsent(event.target.checked); onNotice(event.target.checked ? "Consentimiento actualizado." : "El OCR se desactivó para próximas cargas.") }} type="checkbox" /><i /></label></div></section><section className="panel security-panel"><div className="panel-heading"><div><p className="eyebrow">Sesiones activas</p><h2>Dispositivos conectados</h2></div><button className="small-link" onClick={() => onNotice("Se cerrarán las sesiones remotas cuando exista autenticación de servidor.")}>Cerrar otras sesiones</button></div><div className="session-row"><div className="device-icon">⌘</div><div><strong>MacBook Pro · Chrome</strong><p>Buenos Aires, AR · Sesión actual</p></div><span className="current-session">Actual</span></div><div className="privacy-actions"><button onClick={() => onNotice("Preparando una exportación cifrada de tus datos.")}><Download /><span><strong>Exportar mis datos</strong><small>Recibí una copia portable de tu información</small></span><ChevronRight /></button><button className="danger" onClick={() => onNotice("La solicitud de eliminación requiere una confirmación segura en producción.")}><X /><span><strong>Solicitar eliminación</strong><small>Iniciá una solicitud para borrar tu cuenta y datos</small></span><ChevronRight /></button></div></section><p className="legal-note">Esta demo no reemplaza una revisión legal ni de seguridad. Para producción, validá los controles con profesionales y el marco regulatorio aplicable.</p></>
}

function TimelineItem({ item, large = false }: { item: TimelineEvent; large?: boolean }) { const Icon = eventIcon[item.icon]; return <article className={large ? "timeline-item large" : "timeline-item"}><div className="timeline-date">{formatDate(item.date, true)}</div><div className="timeline-marker"><span><Icon /></span></div><div className="timeline-content"><span className="event-kind">{item.kind}</span><h3>{item.title}</h3><p>{item.detail}</p>{large && <button>Ver detalle <ChevronRight /></button>}</div></article> }

function DocumentRow({ doc }: { doc: HealthDocument }) { const Icon = kindIcon[doc.tone]; return <article className="document-row"><span className={`file-icon ${doc.tone}`}><Icon /></span><div><h3>{doc.name}</h3><p>{doc.issuer} · {formatDate(doc.date, true)}</p></div><span className="row-size">{doc.size}</span><ChevronRight /></article> }

function DocumentPreview({ doc }: { doc: HealthDocument }) { const Icon = kindIcon[doc.tone]; return <div className={`document-preview ${doc.tone}`}><div className="paper-lines"><span /><span /><span /><span /></div><Icon /></div> }

function UploadModal({ onClose, onAdd }: { onClose: () => void; onAdd: (file: File | undefined, kind: DocumentKind, scanned: boolean) => void }) {
  const [kind, setKind] = useState<DocumentKind>("Laboratorio")
  const [file, setFile] = useState<File>()
  const [scan, setScan] = useState(false)
  function onFile(event: ChangeEvent<HTMLInputElement>) { setFile(event.target.files?.[0]); setScan(Boolean(event.currentTarget.capture)) }
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title"><button className="modal-close" onClick={onClose} aria-label="Cerrar"><X /></button><span className="modal-kicker"><Upload />Carpeta privada</span><h2 id="upload-title">Sumá un documento</h2><p>El original se conserva tal como lo subís. Podés revisar los datos detectados antes de guardarlos.</p><label className="select-label">Tipo de documento<select value={kind} onChange={(event) => setKind(event.target.value as DocumentKind)}>{["Laboratorio", "Receta", "Imagen", "Informe", "Vacuna", "Otro"].map((option) => <option key={option}>{option}</option>)}</select></label><div className="upload-choices"><label className="upload-choice"><input type="file" accept=".pdf,image/jpeg,image/png,image/heic,image/heif" onChange={onFile} /><Upload /><strong>Elegir archivo</strong><span>PDF, imagen o HEIC</span></label><label className="upload-choice scan-choice"><input type="file" accept="image/*" capture="environment" onChange={onFile} /><Camera /><strong>Escanear ahora</strong><span>Usá la cámara</span></label></div>{file && <div className="selected-file"><FileText /><div><strong>{file.name}</strong><span>{Math.ceil(file.size / 1024)} KB · {scan ? "Escaneo de cámara" : "Archivo seleccionado"}</span></div><Check /></div>}<button disabled={!file} className="button primary full" onClick={() => onAdd(file, kind, scan)}>{scan ? "Guardar escaneo" : "Guardar documento"}<ArrowRight /></button><small className="modal-note"><LockKeyhole />Máximo 15 MB. En producción, el archivo se valida y analiza antes de quedar disponible.</small></section></div>
}

function ShareModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (form: FormData) => void }) { return <div className="modal-backdrop"><form className="modal" action={onSubmit}><button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar"><X /></button><span className="modal-kicker"><Share2 />Acceso temporal</span><h2>Compartir con alguien</h2><p>Crearemos un acceso de solo lectura, limitado a los documentos que elijas.</p><label className="select-label">Nombre completo<input name="name" required placeholder="Ej. Dra. Valentina Pérez" /></label><label className="select-label">Vínculo<select name="relation"><option>Profesional de salud</option><option>Familiar autorizado</option></select></label><label className="select-label">Vencimiento<select><option>En 7 días</option><option>En 30 días</option><option>Fecha personalizada</option></select></label><div className="share-selection"><Check />Compartir 2 documentos seleccionados · Solo lectura</div><button className="button primary full">Crear acceso <ArrowRight /></button></form></div> }

function EventModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (form: FormData) => void | Promise<void> }) { return <div className="modal-backdrop"><form className="modal" action={onSubmit}><button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar"><X /></button><span className="modal-kicker"><CalendarDays />Registro personal</span><h2>Agregar evento de salud</h2><p>Esta información es ingresada por vos y no reemplaza una validación profesional.</p><label className="select-label">Tipo<select name="kind"><option>Consulta</option><option>Medicación</option><option>Vacuna</option><option>Antecedente</option></select></label><label className="select-label">Título<input name="title" required placeholder="Ej. Consulta de control" /></label><label className="select-label">Fecha<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><button className="button primary full">Agregar a mi línea de tiempo <ArrowRight /></button></form></div> }

function AuthModal({ onClose, onNotice }: { onClose: () => void; onNotice: (message: string) => void }) {
  const supabase = getSupabaseBrowserClient()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [loading, setLoading] = useState(false)

  async function submit(form: FormData) {
    if (!supabase) return onNotice("Completá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY antes de ingresar.")
    const email = String(form.get("email") ?? "")
    const password = String(form.get("password") ?? "")
    setLoading(true)
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      setLoading(false)
      if (error) return onNotice(error.message)
      onClose(); onNotice("Revisá tu email para confirmar la cuenta y volver a ingresar.")
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return onNotice("No pudimos ingresar. Revisá tu email y contraseña.")
    onClose(); onNotice("Sesión iniciada. Tu información se sincronizó de forma privada.")
  }

  return <div className="modal-backdrop"><form className="modal" action={submit}><button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar"><X /></button><span className="modal-kicker"><LockKeyhole />Tu espacio privado</span><h2>{mode === "signin" ? "Ingresá a Mi Salud" : "Creá tu cuenta"}</h2><p>Usamos tu cuenta para separar tu información de la de otras personas. Nunca compartas tu contraseña.</p><label className="select-label">Correo electrónico<input name="email" type="email" autoComplete="email" required placeholder="vos@email.com" /></label><label className="select-label">Contraseña<input name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required placeholder="Al menos 8 caracteres" /></label><button disabled={loading} className="button primary full">{loading ? "Procesando…" : mode === "signin" ? "Ingresar" : "Crear cuenta"}<ArrowRight /></button><button type="button" className="auth-switch" onClick={() => setMode((current) => current === "signin" ? "signup" : "signin")}>{mode === "signin" ? "¿No tenés cuenta? Crearla" : "¿Ya tenés cuenta? Ingresar"}</button><small className="modal-note"><ShieldCheck />Este MVP usa Supabase Auth. Configurá la confirmación de correo antes de invitar testers.</small></form></div>
}
