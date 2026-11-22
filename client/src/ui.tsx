import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  Bookmark,
  BookOpen,
  CircleCheck,
  Clock3,
  Grid2X2,
  House,
  MapPin,
  PencilRuler,
  Shirt,
} from 'lucide-react'
import { Link } from 'react-router'
import { type Item, subtitle, categories } from './model'
import { useSaved } from './saved'
export const categoryIcons = [BookOpen, Shirt, PencilRuler, House]
export function CategoryIcon({
  name,
  size = 16,
}: {
  name: string
  size?: number
}) {
  const Icon = categoryIcons[categories.indexOf(name)] || Grid2X2
  return <Icon size={size} aria-hidden />
}
export function ErrorBox({
  error,
  retry,
}: {
  error: Error | null
  retry?: () => void
}) {
  if (!error) return null
  return (
    <div className="alert problem" role="alert">
      <AlertCircle size={19} />
      <span>{error.message}</span>
      {retry && <button onClick={retry}>ลองใหม่</button>}
    </div>
  )
}
export function Skeleton() {
  return (
    <div aria-label="กำลังโหลดข้อมูล" role="status" className="grid-items">
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className="skeleton loading-card" />
      ))}
    </div>
  )
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Grid2X2 size={25} />
      <p>{children}</p>
    </div>
  )
}
export function notify(message: string) {
  window.dispatchEvent(new CustomEvent('haikan-notice', { detail: message }))
}
export function Toast() {
  const [message, set] = useState('')
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const receive = (e: Event) => {
      set((e as CustomEvent<string>).detail)
      clearTimeout(timer)
      timer = setTimeout(() => set(''), 3200)
    }
    window.addEventListener('haikan-notice', receive)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('haikan-notice', receive)
    }
  }, [])
  return (
    <div role="status" aria-live="polite" className="toast-wrap">
      {message && (
        <span>
          <CircleCheck size={17} />
          {message}
        </span>
      )}
    </div>
  )
}
export function Picture({ src, alt }: { src: string; alt: string }) {
  const [failed, set] = useState(false)
  useEffect(() => set(false), [src])
  return failed ? (
    <span className="no-photo">ไม่มีรูปภาพ</span>
  ) : (
    <img src={src} alt={alt} onError={() => set(true)} />
  )
}
export function Save({ id }: { id: string }) {
  const { ids, toggle } = useSaved()
  const saved = ids.includes(id)
  return (
    <button
      className={'save' + (saved ? ' selected' : '')}
      aria-label={saved ? 'นำออกจากรายการบันทึก' : 'บันทึกประกาศ'}
      aria-pressed={saved}
      onClick={() => {
        toggle(id)
        notify(saved ? 'นำออกจากรายการบันทึกแล้ว' : 'บันทึกประกาศแล้ว')
      }}
    >
      <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
    </button>
  )
}
export function Badge({ item }: { item: Item }) {
  return (
    <span className={'item-status s-' + item.state}>
      <i />
      {subtitle(item)}
    </span>
  )
}
export function Card({ item }: { item: Item }) {
  return (
    <article className="item-card">
      <div className="card-media">
        <Link to={'/items/' + item.id} aria-label={item.title}>
          <Picture src={item.image} alt={item.title} />
        </Link>
        <Badge item={item} />
        <Save id={item.id} />
      </div>
      <div className="card-copy">
        <div className="category-label">
          <CategoryIcon name={item.category} />
          {item.category}
          <span>·</span>
          {item.condition}
        </div>
        <h3>
          <Link to={'/items/' + item.id}>{item.title}</Link>
        </h3>
        <p className="location">
          <MapPin size={15} />
          {item.district} · {item.province}
        </p>
        <div className="card-bottom">
          <span className="free">ให้ฟรี</span>
          <span>
            <Clock3 size={14} />
            {item.endsAt ? 'ตามช่วงนัดรับ' : 'นัดรับภายหลัง'}
          </span>
        </div>
      </div>
    </article>
  )
}
