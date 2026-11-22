import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Sprout,
} from 'lucide-react'
import { useAreas, useItems } from './api'
import { categories, conditions, states, type Filters } from './model'
import { Card, CategoryIcon, Empty, ErrorBox, Skeleton } from './ui'
export default function Catalog() {
  const [params, setParams] = useSearchParams()
  const results = useRef<HTMLHeadingElement>(null)
  const requestedPage = Number(params.get('page'))
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const filters: Filters = {
    search: params.get('search') || '',
    province: params.get('province') || '',
    district: params.get('district') || '',
    category: params.get('category') || '',
    condition: params.get('condition') || '',
    state: params.get('state') || '',
  }
  function change(key: keyof Filters, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'province') next.delete('district')
    next.delete('page')
    setParams(next, { replace: true })
  }
  function changePage(page: number) {
    const next = new URLSearchParams(params)
    if (page === 1) next.delete('page')
    else next.set('page', String(page))
    setParams(next, { preventScrollReset: true })
    results.current?.focus({ preventScroll: true })
    results.current?.scrollIntoView({ block: 'center' })
  }
  const areas = useAreas(),
    items = useItems({ ...filters, search: filters.search.trim() }, page)
  const {
    rows,
    total,
    page: current,
    pages,
  } = items.data ?? {
    rows: [],
    total: 0,
    page: 1,
    pages: 1,
  }
  return (
    <>
      <section className="hero-panel">
        <div className="hero-text">
          <div className="hero-tag">
            <Sprout size={16} />
            ชุมชนแห่งการแบ่งปัน
          </div>
          <h1>
            ของที่ยังดี <em>ส่งต่อกันได้</em>
          </h1>
          <p>แบ่งปันของใช้ให้เพื่อนบ้าน หาของที่ต้องการได้ฟรีในชุมชนของคุณ</p>
          <Link className="primary" to="/items/new">
            <Plus size={18} />
            ลงประกาศส่งต่อ
          </Link>
        </div>
        <div className="hero-art">
          <img src="/images/hero-box.png" alt="กล่องสิ่งของที่พร้อมแบ่งปัน" />
        </div>
      </section>
      <section aria-label="ค้นหาและกรองประกาศ">
        <div className="catalog-heading">
          <h2>ค้นหาของในชุมชน</h2>
        </div>
        <div className="filters">
          <label className="search-wrap">
            <Search size={19} />
            <input
              aria-label="ค้นหาสิ่งของ"
              placeholder="ค้นหาชื่อหรือรายละเอียด..."
              maxLength={140}
              value={filters.search}
              onChange={(e) => change('search', e.target.value)}
            />
          </label>
          <label className="select-wrap">
            <MapPin size={17} />
            <select
              aria-label="จังหวัด"
              value={filters.province}
              onChange={(e) => change('province', e.target.value)}
            >
              <option value="">ทุกจังหวัด</option>
              {[...new Set(areas.data?.map((a) => a.province))].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="select-wrap">
            <select
              aria-label="อำเภอหรือเขต"
              disabled={!filters.province}
              value={filters.district}
              onChange={(e) => change('district', e.target.value)}
            >
              <option value="">ทุกอำเภอ/เขต</option>
              {areas.data
                ?.filter((a) => a.province === filters.province)
                .map((a) => (
                  <option key={a.district}>{a.district}</option>
                ))}
            </select>
          </label>
          <label className="select-wrap">
            <SlidersHorizontal size={16} />
            <select
              aria-label="สถานะ"
              value={filters.state}
              onChange={(e) => change('state', e.target.value)}
            >
              <option value="">ทุกสถานะ</option>
              {Object.entries(states).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="select-wrap">
            <select
              aria-label="สภาพสิ่งของ"
              value={filters.condition}
              onChange={(e) => change('condition', e.target.value)}
            >
              <option value="">ทุกสภาพ</option>
              {conditions.map((condition) => (
                <option key={condition}>{condition}</option>
              ))}
            </select>
          </label>
        </div>
        <ErrorBox error={areas.error} retry={() => void areas.refetch()} />
        <div className="chips">
          {['', ...categories].map((cat) => (
            <button
              key={cat}
              aria-pressed={cat === filters.category}
              className={cat === filters.category ? 'active' : ''}
              onClick={() => change('category', cat)}
            >
              {cat ? <CategoryIcon name={cat} /> : <Grid2X2 size={16} />}
              {cat || 'ทั้งหมด'}
            </button>
          ))}
        </div>
      </section>
      <div className="results-head">
        <h2 ref={results} tabIndex={-1}>
          {Object.values(filters).some(Boolean) ? 'ผลการค้นหา' : 'ประกาศล่าสุด'}
        </h2>
        {items.data && <span>{total} ประกาศ</span>}
      </div>
      {items.isPending ? (
        <Skeleton />
      ) : items.error ? (
        <ErrorBox error={items.error} retry={() => void items.refetch()} />
      ) : rows.length ? (
        <div className="grid-items">
          {rows.map((item) => (
            <Card key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Empty>
          ไม่พบประกาศที่ตรงกับการค้นหา{' '}
          <button onClick={() => setParams({})}>ล้างตัวกรอง</button>
        </Empty>
      )}
      {pages > 1 && (
        <div className="pager">
          <button
            aria-label="หน้าก่อน"
            disabled={current === 1}
            onClick={() => changePage(current - 1)}
          >
            <ChevronLeft />
          </button>
          <span>
            หน้า {current} จาก {pages}
          </span>
          <button
            aria-label="หน้าถัดไป"
            disabled={current === pages}
            onClick={() => changePage(current + 1)}
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </>
  )
}
